import argparse
import json
from pathlib import Path
import joblib
import numpy as np
from xgboost import XGBRegressor
from ml.preprocessing import load_prices
from ml.feature_engineering import (
    engineer_features,
    time_split,
    PRICE_FEATURES,
    ECON_FEATURES,
    NEWS_FEATURES,
)
from ml.evaluate import evaluate


def train(path: Path, output: Path, allow_demo=False, *, model_a_only=False, refit=False, allow_sparse_prices=False):
    # TODO[AI-04] [C] 학습 파이프라인은 구현됨. 실제 정규화 CSV로 학습·평가하고 산출물과 재현 설정을 전달하세요.
    # data/demo/training.csv 결과는 합성 자료의 실행 검증이며 실제 모델 성능이 아닙니다.
    feature_options = {
        "include_news": not model_a_only,
        "allow_sparse_prices": allow_sparse_prices,
        "lag_tolerance_days": 3 if model_a_only else 0,
        "min_target_observations": 3 if model_a_only else 7,
    }
    source = load_prices(path, allow_demo=allow_demo, include_news=not model_a_only)
    cutoff = source["date"].max()
    frame = engineer_features(source, **feature_options)
    frame = frame[frame["label_end"] <= cutoff]
    training, validation, test = time_split(frame)
    identity = sorted(
        c for c in frame if c.startswith("product_") and c != "product_id"
    )
    a = PRICE_FEATURES + ECON_FEATURES + identity
    b = a + NEWS_FEATURES
    result = {
        "status": "trained"
        if source["data_mode"].iloc[0] == "live"
        else "demo_trained",
        "data_mode": source["data_mode"].iloc[0],
        "rows": len(training),
        "period": f"{training.date.min().date()} ~ {training.date.max().date()}",
        "models": {"baseline": evaluate(test["target"], test["price"])},
        "splits": {
            label: {
                "start": str(df.date.min().date()),
                "end": str(df.date.max().date()),
                "rows": len(df),
                "label_end": str(df.label_end.max().date()),
            }
            for label, df in [
                ("train", training),
                ("validation", validation),
                ("test", test),
            ]
        },
        "target": "mean observed retail price on days +27 through +33",
        "min_target_observations": feature_options["min_target_observations"],
        "horizon_days": 30,
        "news_window_days": None if model_a_only else 7,
        "feature_importance": {},
        "training_cutoff": str(cutoff.date()),
        "source_observations": len(source),
        "source_period": {
            "start": str(source.date.min().date()),
            "end": str(cutoff.date()),
        },
    }
    output.mkdir(parents=True, exist_ok=True)
    models = [("model_a", a)] if model_a_only else [("model_a", a), ("model_b", b)]
    for name, features in models:
        model = XGBRegressor(
            n_estimators=350,
            max_depth=4,
            learning_rate=0.045,
            subsample=0.9,
            colsample_bytree=0.9,
            objective="reg:squarederror",
            random_state=42,
            n_jobs=2,
            early_stopping_rounds=25,
        )
        model.fit(
            training[features],
            training["target"],
            eval_set=[(validation[features], validation["target"])],
            verbose=False,
        )
        test_predictions = model.predict(test[features])
        result["models"][name] = evaluate(test["target"], test_predictions)
        if model_a_only:
            result["product_metrics"] = {
                product_id: {
                    "baseline": evaluate(test.loc[mask, "target"], test.loc[mask, "price"]),
                    "model_a": evaluate(test.loc[mask, "target"], test_predictions[mask]),
                }
                for product_id in sorted(test.product_id.unique())
                if (mask := (test.product_id == product_id).to_numpy()).any()
            }
        # Fit interval radii on validation only; test labels never tune the model or interval.
        # TODO[AI-06] [C] 실제 자료로 예측 범위의 테스트 포함률·품목별 지표를 확인하세요. 포함 확률을 보장하지 않습니다.
        residual = np.abs(
            validation["target"].to_numpy() - model.predict(validation[features])
        )
        radius = float(np.quantile(residual, 0.9, method="higher"))
        per_product = {}
        for id in sorted(validation.product_id.unique()):
            mask = validation.product_id == id
            per_product[id] = float(np.quantile(residual[mask], 0.9, method="higher"))
        joblib.dump(
            {
                "model": model,
                "features": features,
                "feature_options": feature_options,
                "radius": radius,
                "product_radius": per_product,
                "data_mode": result["data_mode"],
                "training_cutoff": result["training_cutoff"],
                "reference_metadata": {
                    id: {k: str(g[k].iloc[0]) for k in ("spec", "grade", "region")}
                    for id, g in source.groupby("product_id")
                },
            },
            output / f"{name}.joblib",
        )
        if name == "model_b" or model_a_only:
            result["feature_importance"] = dict(
                sorted(
                    zip(features, map(float, model.feature_importances_)),
                    key=lambda x: x[1],
                    reverse=True,
                )
            )
            radii = np.array([per_product.get(id, radius) for id in test.product_id])
            result["interval_test_coverage"] = float(
                np.mean(
                    np.abs(test["target"].to_numpy() - model.predict(test[features]))
                    <= radii
                )
            )
            first_product = sorted(test.product_id.unique())[0]
            subset = test[test.product_id == first_product]
            estimates = model.predict(subset[features])
            result["backtest"] = [
                {
                    "date": str(row.target_date.date()),
                    "actual": float(row.target),
                    "predicted": float(estimate),
                    "product_id": first_product,
                }
                for (_, row), estimate in zip(subset.iterrows(), estimates)
            ]
        if refit:
            iterations = model.best_iteration + 1
            final = XGBRegressor(**{
                **model.get_params(),
                "n_estimators": iterations,
                "early_stopping_rounds": None,
            })
            final.fit(frame[features], frame["target"], verbose=False)
            filename = f"{name}_refit.ubj"
            final.save_model(output / filename)
            result.setdefault("refits", {})[name] = {
                "file": filename,
                "fit_rows": len(frame),
                "label_end": str(frame.label_end.max().date()),
                "iterations": iterations,
            }
    if not model_a_only:
        result["news_improvement_mape"] = (
            result["models"]["model_a"]["MAPE"] - result["models"]["model_b"]["MAPE"]
        )
    (output / "metrics.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2)
    )
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="시계열 경계 구간을 둔 30일 후 가격 모델 학습"
    )
    parser.add_argument("--data", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("ml/artifacts"))
    parser.add_argument("--allow-demo", action="store_true")
    parser.add_argument("--model-a-only", action="store_true")
    parser.add_argument("--allow-sparse-prices", action="store_true")
    parser.add_argument("--refit", action="store_true", help="검증 모델과 별도로 전체 학습 가능 사례로 재학습")
    args = parser.parse_args()
    result = train(
        args.data,
        args.output,
        args.allow_demo,
        model_a_only=args.model_a_only,
        refit=args.refit,
        allow_sparse_prices=args.allow_sparse_prices,
    )
    print(
        json.dumps(
            {
                "status": result["status"],
                "data_mode": result["data_mode"],
                "models": result["models"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )
