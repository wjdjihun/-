"""Fit next-calendar-month price models and export selectable forecasts."""

import argparse
import json
import sys
from pathlib import Path
from tempfile import TemporaryDirectory
from zipfile import ZipFile

import numpy as np
import pandas as pd
from xgboost import XGBRegressor

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "backend"))

from ml.preprocessing import load_prices


def monthly_features(source):
    rows = []
    for product, observations in source.groupby("product_id"):
        months = observations["date"].dt.to_period("M")
        grouped = observations.groupby(months)
        counts = grouped["price"].count()
        prices = grouped["price"].mean().where(counts >= 3)
        last = grouped.last()
        for month, recent in last.iterrows():
            if pd.isna(prices.loc[month]):
                continue
            target = month + 1
            rows.append({
                "product": product,
                "target": target,
                "actual": prices.get(target, np.nan),
                "count": counts.get(target, 0),
                "previous_mean": prices[month],
                "previous_close": recent["price"],
                "last_year_mean": prices.get(target - 12, np.nan),
                "usd_krw": recent["usd_krw"],
                "commodity_index": recent["commodity_index"],
                "month_sin": np.sin(2 * np.pi * target.month / 12),
                "month_cos": np.cos(2 * np.pi * target.month / 12),
            })
    return pd.get_dummies(pd.DataFrame(rows), columns=["product"], dtype=float).assign(
        product=[row["product"] for row in rows],
    )


def run_forecast(frame, target, *, model_path=None):
    inputs = frame.columns.difference(["product", "target", "actual", "count"])
    # Only targets completed before the forecast month enter training.
    train = frame.loc[(frame["target"] < target) & frame["actual"].notna()]
    current = frame.loc[frame["target"] == target]
    if current.empty or train.empty:
        raise ValueError(f"{target}: not enough monthly data")
    model = XGBRegressor(
        n_estimators=120, max_depth=2, learning_rate=0.035, n_jobs=2, random_state=42,
    )
    model.fit(train[inputs], train["actual"])
    if model_path is not None:
        model.save_model(model_path)
    estimates = model.predict(current[inputs])
    return {
        row.product: {
            "forecast": max(1, round(float(estimate))),
            "previousMonth": round(row.previous_mean),
            **({"actual": round(row.actual), "count": int(row.count)} if pd.notna(row.actual) else {}),
        }
        for row, estimate in zip(current.itertuples(), estimates)
    }, len(train)


def selectable_forecasts(source, latest_month, *, model_path=None):
    monthly = source.groupby(["product_id", source["date"].dt.to_period("M")])["price"].agg(["mean", "count"])
    product_ids = sorted(source["product_id"].unique())
    months = {}
    for target in pd.period_range("2023-01", latest_month + 12, freq="M"):
        cutoff = min(target.start_time - pd.Timedelta(days=1), source["date"].max())
        known = source[source["date"] <= cutoff]
        predictions = {}
        training_count = 0
        if target <= latest_month + 1:
            features = monthly_features(known)
            if features["target"].eq(target).any():
                predictions, training_count = run_forecast(
                    features, target, model_path=model_path if target == latest_month + 1 else None,
                )

        products = {}
        for product in product_ids:
            actual = monthly.loc[(product, target)] if (product, target) in monthly.index else None
            historical_means = [
                (target - 12 * offset, monthly.loc[(product, target - 12 * offset), "mean"])
                for offset in range(1, 5)
                if (product, target - 12 * offset) in monthly.index
                and monthly.loc[(product, target - 12 * offset), "count"] >= 3
                and (target - 12 * offset).end_time.normalize() <= cutoff
            ]
            forecast = predictions.get(product)
            estimate = forecast["forecast"] if forecast else (
                round(float(np.mean([value for _, value in historical_means])), 2)
                if historical_means else None
            )
            previous = monthly.loc[(product, target - 1)] if (product, target - 1) in monthly.index else None
            products[product] = {
                "estimate": estimate,
                "method": "xgboost" if forecast else ("seasonal" if estimate is not None else "unavailable"),
                "seasonalYears": [int(month.year) for month, _ in historical_means] if not forecast else [],
                "actual": round(float(actual["mean"]), 2) if actual is not None else None,
                "observations": int(actual["count"]) if actual is not None else 0,
                "previousMean": round(float(previous["mean"]), 2)
                if previous is not None and previous["count"] >= 3 else None,
            }
        months[str(target)] = {
            "asOf": str(cutoff.date()),
            "trainingCount": training_count,
            "products": products,
        }
    return months


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prices", type=Path, help="Prepared KAMIS retail CSV")
    parser.add_argument("--model", type=Path, help="Optional export path for the latest monthly XGBoost model")
    args = parser.parse_args()
    archive_path = root / "frontend/public/downloads/kamis-grocery-monthly-model.zip"
    if args.prices:
        source = load_prices(args.prices, include_news=False)
    else:
        with TemporaryDirectory() as tmp, ZipFile(archive_path) as archive:
            source = load_prices(Path(archive.extract("prices.csv", tmp)), include_news=False)
    latest_month = source["date"].max().to_period("M")
    selectable = root / "frontend/lib/kamis-selectable-months.json"
    forecasts = selectable_forecasts(source, latest_month, model_path=args.model)
    selectable.write_text(json.dumps(forecasts, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
