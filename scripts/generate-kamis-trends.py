"""Build the chart estimates from the published KAMIS training data and fitted model."""

import json
import sys
from pathlib import Path
from tempfile import TemporaryDirectory
from zipfile import ZipFile

import pandas as pd
from xgboost import XGBRegressor

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "backend"))

from ml.feature_engineering import engineer_features
from ml.preprocessing import load_prices


def gap_estimates(observations, predictions):
    """Anchor supported short gaps to their observed prices on both sides."""
    history = list(observations[["date", "price"]].itertuples(index=False, name=None))
    gaps = []
    for (start, start_price), (end, end_price) in zip(history, history[1:]):
        days = (end - start).days
        if start.year != end.year or not 14 < days <= 60:
            continue

        inside = predictions.loc[(predictions.index > start) & (predictions.index < end)]
        dates = [start, *inside.index, end]
        # Long stretches without any model output are still shown as gaps.
        if len(inside) < 3 or max((b - a).days for a, b in zip(dates, dates[1:])) > days / 2:
            continue

        start_delta = start_price - inside.iloc[0]
        end_delta = end_price - inside.iloc[-1]
        points = [{"date": str(start.date()), "price": int(start_price)}]
        for date, estimate in inside.items():
            fraction = (date - start).days / days
            delta = (1 - fraction) * start_delta + fraction * end_delta
            points.append({"date": str(date.date()), "price": max(1, round(estimate + delta))})
        points.append({"date": str(end.date()), "price": int(end_price)})
        gaps.append(points)
    return gaps


def main():
    lib = root / "frontend/lib"
    forecast = json.loads((lib / "kamis-forecast.json").read_text())
    as_of = pd.Timestamp(forecast["asOf"])
    target = pd.Timestamp(forecast["targetDate"])
    archive_path = root / "frontend/public/downloads/kamis-five-year-model.zip"

    with TemporaryDirectory() as temporary, ZipFile(archive_path) as archive:
        price_path = archive.extract("prices.csv", temporary)
        model_path = archive.extract("model_a_refit.ubj", temporary)
        source = load_prices(Path(price_path), include_news=False)
        model = XGBRegressor()
        model.load_model(model_path)

    source = source[source["date"] <= as_of]
    features = engineer_features(
        source, include_target=False, include_news=False,
        lag_tolerance_days=3, allow_sparse_prices=True,
    )
    features["estimate"] = model.predict(features[model.get_booster().feature_names]).astype(float)
    features["target_date"] = features["date"] + pd.Timedelta(days=30)
    trends = {}
    for product, rows in features.groupby("product_id", sort=True):
        estimates = rows.set_index("target_date")["estimate"]
        future = estimates.loc[(estimates.index > as_of) & (estimates.index <= target)]
        if round(future.loc[target]) != forecast["prices"][product]:
            raise ValueError(f"{product}: unexpected final forecast price")
        trends[product] = {
            "gaps": gap_estimates(source[source["product_id"] == product], estimates),
            "outlook": [
                {"date": str(date.date()), "price": max(1, round(estimate))}
                for date, estimate in future.items()
            ],
        }
    (lib / "kamis-trends.json").write_text(json.dumps(trends, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
