import json
from pathlib import Path
import joblib
import pandas as pd
from ml.preprocessing import load_prices
from ml.feature_engineering import engineer_features


class PredictionEngine:
    def __init__(self, directory: Path, prices: Path):
        # Load only trusted, locally generated artifacts. Never unpickle visitor uploads.
        self.bundle = joblib.load(directory / "model_b.joblib")
        self.metrics = json.loads((directory / "metrics.json").read_text())
        self.source = load_prices(prices, allow_demo=self.bundle["data_mode"] == "demo")

    def predict(self, product_id: str, as_of: str):
        cutoff = pd.Timestamp(as_of)
        if pd.Timestamp(self.bundle["training_cutoff"]) > cutoff:
            raise ValueError("학습 종료일 이전 기준일을 이 모델로 추론할 수 없습니다.")
        source = self.source[
            (self.source["date"] <= cutoff) & (self.source["product_id"] == product_id)
        ]
        if source.empty:
            raise ValueError("해당 품목의 기준일 이전 데이터가 없습니다.")
        metadata = self.bundle["reference_metadata"].get(product_id)
        if not metadata or any(
            str(source[k].iloc[-1]) != v for k, v in metadata.items()
        ):
            raise ValueError("학습 시 품목 규격·등급·지역과 추론 데이터가 다릅니다.")
        features = engineer_features(source, include_target=False)
        row = features[features["date"] == cutoff].copy()
        if row.empty:
            raise ValueError("예측 기준일의 과거 30일 피처가 부족합니다.")
        for column in self.bundle["features"]:
            if column.startswith("product_") and column not in row:
                row[column] = 0.0
        price = max(
            1,
            int(
                round(
                    float(self.bundle["model"].predict(row[self.bundle["features"]])[0])
                )
            ),
        )
        radius = self.bundle["product_radius"].get(product_id, self.bundle["radius"])
        return {
            "prediction": price,
            "lower": max(1, int(round(price - radius))),
            "upper": int(round(price + radius)),
            "input_price": int(row["price"].iloc[0]),
            "method": "xgboost",
            "data_mode": self.bundle["data_mode"],
            "reference_date": as_of,
            "horizon_days": 30,
            "interval_method": "validation_abs_residual_90pct_not_guaranteed",
        }
