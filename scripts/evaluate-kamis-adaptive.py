"""Fit a shared, regularized seasonal blend and evaluate it against the site forecast."""

import argparse
import json
from pathlib import Path
from zipfile import ZipFile

import numpy as np
import pandas as pd
from scipy.optimize import least_squares
from scipy.special import expit

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "frontend/public/downloads/kamis-grocery-monthly-model.zip"
SITE_FORECASTS = ROOT / "frontend/lib/kamis-selectable-months.json"
FEATURES = ["recent_volatility", "previous_seasonal_gap"]
CALIBRATION_END = pd.Period("2024-12", freq="M")
LATEST_TEST = pd.Period("2026-06", freq="M")
MIN_OBSERVATIONS = 3


def build_cases(prices, forecasts, *, include_forecasts=False):
    monthly = prices.groupby(["product_id", prices["date"].dt.to_period("M")])["price"].agg(["mean", "size"])
    averages = monthly.loc[monthly["size"] >= MIN_OBSERVATIONS, "mean"].to_dict()
    cases = []
    keys = set(averages)
    if include_forecasts:
        keys.update((product, pd.Period(month, freq="M"))
                    for month, forecast in forecasts.items() for product in forecast["products"])
    for product, target in sorted(keys):
        if not include_forecasts and (str(target) not in forecasts or target > LATEST_TEST):
            continue
        deployed = forecasts.get(str(target), {}).get("products", {}).get(product, {})
        actual = averages.get((product, target), np.nan)
        previous = averages.get((product, target - 1), np.nan)
        historical = [
            averages[(product, target - 12 * years)]
            for years in range(1, 5)
            if (product, target - 12 * years) in averages
        ]
        seasonal = np.mean(historical) if historical else np.nan
        changes = [
            abs(np.log(averages[(product, target - offset)] / averages[(product, target - offset - 1)]))
            for offset in (1, 2)
            if (product, target - offset) in averages and (product, target - offset - 1) in averages
        ]
        cases.append({
            "product": product,
            "month": target,
            "actual": actual,
            "observations": int(monthly.loc[(product, target), "size"]) if (product, target) in monthly.index else 0,
            "site": deployed.get("estimate"),
            "site_method": deployed.get("method"),
            "previous": previous,
            "seasonal": seasonal,
            "seasonal_year_count": len(historical),
            "recent_volatility": np.mean(changes) if changes else np.nan,
            "previous_seasonal_gap": np.log(previous / seasonal),
        })
    return pd.DataFrame(cases)


def fit_rule(calibration, cutoff=CALIBRATION_END):
    features = calibration[FEATURES]
    fill = features.median()
    features = features.fillna(fill)
    center, scale = features.mean(), features.std(ddof=0).replace(0, 1)
    design = ((features - center) / scale).to_numpy()
    previous, seasonal, actual = (calibration[c].to_numpy() for c in ["previous", "seasonal", "actual"])

    def residuals(parameters):
        weight = expit(parameters[0] + design @ parameters[1:])
        error = (seasonal + weight * (previous - seasonal) - actual) / actual
        # Penalize steep feature effects so an isolated price spike cannot set the rule.
        return np.r_[error / np.sqrt(len(error)), 0.03 * parameters[1:]]

    options = {"bounds": (-6, 6), "loss": "soft_l1", "f_scale": 0.1 / np.sqrt(len(calibration))}
    fit = least_squares(residuals, x0=np.zeros(3), **options)
    fixed = least_squares(lambda x: residuals(np.r_[x, 0, 0]), x0=np.zeros(1), **options)
    if not fit.success or not fixed.success:
        raise RuntimeError(f"Weight fit failed: {fit.message}; fixed comparator: {fixed.message}")
    return {
        "features": FEATURES,
        "fill": fill.to_dict(),
        "center": center.to_dict(),
        "scale": scale.to_dict(),
        "intercept": fit.x[0],
        "fixed_previous_weight": expit(fixed.x[0]),
        "coefficients": dict(zip(FEATURES, fit.x[1:])),
        "last_calibration_month": str(cutoff),
        "calibration_cases": len(calibration),
    }


def predict(cases, rule):
    features = cases[FEATURES].fillna(rule["fill"])
    design = (features - pd.Series(rule["center"])) / pd.Series(rule["scale"])
    weight = pd.Series(expit(rule["intercept"] + design @ pd.Series(rule["coefficients"])), index=cases.index)
    weight = weight.where(cases["seasonal"].notna(), 1).where(cases["previous"].notna(), 0)
    estimate = (weight * cases["previous"].fillna(0) + (1 - weight) * cases["seasonal"].fillna(0))
    estimate = estimate.where(cases[["previous", "seasonal"]].notna().any(axis=1))
    return estimate, weight.where(estimate.notna())


def metrics(cases, column):
    errors = (cases[column] - cases["actual"]).abs() / cases["actual"] * 100
    return {"cases": len(errors), "at_least_10_pct": int((errors >= 10).sum()), "mape": errors.mean(), "max": errors.max()}



def export_site(prices, forecasts, output):
    cases = build_cases(prices, forecasts, include_forecasts=True)
    eligible = cases.dropna(subset=["previous", "seasonal", "actual"])
    latest = prices["date"].max().to_period("M")
    full_rule = fit_rule(eligible, latest)
    full_estimates, full_weights = predict(cases, full_rule)
    release = {}
    for month in forecasts:
        target = pd.Period(month, freq="M")
        rows = cases.loc[cases["month"].eq(target)]
        historical = eligible.loc[eligible["month"].lt(target)]
        rule = fit_rule(historical, target - 1) if rows["actual"].notna().any() and len(historical) >= 24 else None
        if rule:
            estimates, _ = predict(rows, rule)
        else:
            estimates = rows["previous"].combine_first(rows["seasonal"])
        products = {}
        for index, row in rows.iterrows():
            estimate = full_estimates.loc[index]
            weight = full_weights.loc[index]
            validation_estimate = estimates.loc[index] if pd.notna(row.actual) else np.nan
            previous = pd.notna(row.previous)
            seasonal = pd.notna(row.seasonal)
            method = (
                "adaptive" if previous and seasonal
                else "previous" if previous
                else "seasonal" if seasonal
                else "unavailable"
            )
            products[row["product"]] = {
                "estimate": round(float(estimate), 2) if pd.notna(estimate) else None,
                "method": method,
                "previousWeight": round(float(weight), 4) if pd.notna(estimate) else None,
                "validationEstimate": round(float(validation_estimate), 2) if pd.notna(validation_estimate) else None,
            }
        release[month] = {
            "validationFitMonth": rule["last_calibration_month"] if rule and target <= latest else None,
            "validationTrainingCount": rule["calibration_cases"] if rule and target <= latest else 0,
            "products": products,
        }

    evaluation = cases.loc[cases["actual"].notna() & cases["month"].gt(CALIBRATION_END)].copy()
    evaluation["adaptive"] = [
        release[str(month)]["products"][product]["validationEstimate"]
        for month, product in zip(evaluation["month"], evaluation["product"])
    ]
    evaluation["fit_month"] = [release[str(month)]["validationFitMonth"] for month in evaluation["month"]]
    evaluation["training_count"] = [release[str(month)]["validationTrainingCount"] for month in evaluation["month"]]
    for name in ("site", "adaptive"):
        evaluation[f"{name}_error_pct"] = (evaluation[name] - evaluation["actual"]).abs() / evaluation["actual"] * 100
    evaluation.to_csv(output / "rolling-monthly-comparison.csv", index=False, float_format="%.8f")
    matched = evaluation.dropna(subset=["site", "adaptive"])
    evaluation_summary = {
        "matched": {name: metrics(matched, name) for name in ("site", "adaptive")},
        "june": {
            str(month): {name: metrics(group, name) for name in ("site", "adaptive")}
            for month, group in matched[matched["month"].dt.month.eq(6)].groupby("month")
        },
    }
    (output / "rolling-evaluation-summary.json").write_text(json.dumps(evaluation_summary, indent=2) + "\n")
    (output / "adaptive-model-full.json").write_text(json.dumps(full_rule, indent=2) + "\n")
    (ROOT / "frontend/lib/kamis-adaptive-months.json").write_text(
        json.dumps({"fitMonth": str(latest), "trainingCount": len(eligible), "months": release}, separators=(",", ":")) + "\n"
    )

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--export-site", action="store_true", help="Export historical and future forecasts for the web app")
    args = parser.parse_args()
    with ZipFile(ARCHIVE) as archive, archive.open("prices.csv") as stream:
        prices = pd.read_csv(stream, parse_dates=["date"])
    forecasts = json.loads(SITE_FORECASTS.read_text())
    cases = build_cases(prices, forecasts)
    calibration = cases.loc[cases["month"].le(CALIBRATION_END)].dropna(subset=["previous", "seasonal"])
    rule = fit_rule(calibration)
    tests = cases.loc[cases["month"].gt(CALIBRATION_END)].copy()
    tests["adaptive"], tests["previous_weight"] = predict(tests, rule)
    tests["fixed_75_25"] = 0.75 * tests["previous"] + 0.25 * tests["seasonal"]
    fixed_weight = rule["fixed_previous_weight"]
    tests["fixed_calibrated"] = fixed_weight * tests["previous"] + (1 - fixed_weight) * tests["seasonal"]
    matched = tests.dropna(subset=["site", "adaptive"])
    common = matched.dropna(subset=["fixed_75_25"])
    methods = ["site", "adaptive", "previous", "fixed_75_25", "fixed_calibrated"]
    for method in methods:
        tests[f"{method}_error_pct"] = (tests[method] - tests["actual"]).abs() / tests["actual"] * 100
    summary = {
        "coverage": {"eligible": len(tests), "site": int(tests["site"].count()), "adaptive": int(tests["adaptive"].count())},
        "matched": {m: metrics(matched, m) for m in methods[:2]},
        "common": {m: metrics(common, m) for m in methods},
        "june": {str(month): {m: metrics(group, m) for m in methods}
                 for month, group in common[common["month"].dt.month.eq(6)].groupby("month")},
        "weight_range_mixed": [float(common["previous_weight"].min()), float(common["previous_weight"].max())],
    }
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "adaptive-model.json").write_text(json.dumps(rule, indent=2) + "\n")
    (args.output / "evaluation-summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    tests.to_csv(args.output / "monthly-comparison.csv", index=False, float_format="%.8f")
    if args.export_site:
        export_site(prices, forecasts, args.output)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
