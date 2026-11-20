"""Train and export source-dated news adjustments for the KAMIS forecast."""

import argparse
import json
import runpy
from pathlib import Path
from zipfile import ZipFile

import numpy as np
import pandas as pd
from scipy.optimize import lsq_linear

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "frontend/public/downloads/kamis-adaptive-model.zip"
INPUTS = ROOT / "experiments/news-prices"
SITE_DATA = ROOT / "frontend/lib/kamis-news-adjustments.json"
START = pd.Period("2021-07", freq="M")
END = pd.Period("2026-06", freq="M")
HOLDOUT_START = pd.Period("2026-01", freq="M")
RIDGE_PENALTY = 5.0
MAX_LOG_ADJUSTMENT = np.log(1.15)
FEATURES = ["news", "report"]


def read_events(path, products):
    events = pd.read_csv(path, keep_default_na=False)
    events["published"] = pd.to_datetime(events["published"], format="%Y-%m-%d", errors="raise")
    if not events["direction"].isin([-1, 0, 1]).all() or not events["product"].isin(products).all():
        raise ValueError("Events must use a supported product and a direction of -1, 0 or 1")
    if events.duplicated(["url", "product"]).any():
        raise ValueError("Each source URL may appear only once per product")
    events["month"] = events["published"].dt.to_period("M") + 1
    return events


def build_signals(news, reports):
    keys = ["product", "month"]
    news_active = news[news["direction"].ne(0)]
    report_active = reports.sort_values("published").drop_duplicates(keys, keep="last")
    news_features = news_active.groupby(keys)["direction"].mean().rename("news")
    report_features = report_active.set_index(keys)["direction"].rename("report")
    signals = pd.concat([news_features, report_features], axis=1).reset_index()
    sources = pd.concat([news_active, report_active[report_active["direction"].ne(0)]])
    sources = {
        key: [
            {"date": row.published.date().isoformat(), "publisher": row.publisher,
             "url": row.url, "evidence": row.evidence}
            for row in group.sort_values("published", ascending=False).itertuples()
        ]
        for key, group in sources.groupby(keys)
    }
    return signals, sources


def build_price_cases(prices, release):
    # Reuse the price model's feature construction and early-month fallback.
    adaptive = runpy.run_path(str(ROOT / "scripts/evaluate-kamis-adaptive.py"))
    cases = adaptive["build_cases"](prices, {}, include_forecasts=True)
    eligible = cases.dropna(subset=["previous", "seasonal", "actual"])
    cases = cases.loc[cases["actual"].notna() & cases["month"].between(START, END)].copy()
    cases["adaptive"] = cases["previous"].combine_first(cases["seasonal"])
    for month, group in cases.groupby("month"):
        if str(month) in release["months"]:
            forecasts = release["months"][str(month)]
            fit_month = forecasts["validationFitMonth"]
            if fit_month and pd.Period(fit_month, freq="M") >= month:
                raise ValueError(f"Baseline fitted on or after {month}")
            cases.loc[group.index, "adaptive"] = [
                forecasts["products"][product]["validationEstimate"] for product in group["product"]
            ]
        else:
            prior = eligible.loc[eligible["month"].lt(month)]
            if len(prior) >= 24:
                model = adaptive["fit_rule"](prior, month - 1)
                cases.loc[group.index, "adaptive"] = adaptive["predict"](group, model)[0]
    return cases.dropna(subset=["adaptive"])[["product", "month", "actual", "adaptive"]]


def fit_weights(cases):
    design = cases[FEATURES].to_numpy()
    residuals = np.log(cases["actual"] / cases["adaptive"]).to_numpy()
    penalty = np.sqrt(RIDGE_PENALTY) * np.eye(len(FEATURES))
    fit = lsq_linear(np.vstack([design, penalty]), np.r_[residuals, np.zeros(len(FEATURES))],
                     bounds=(0, MAX_LOG_ADJUSTMENT))
    if not fit.success:
        raise RuntimeError(f"News weight fit failed: {fit.message}")
    return np.where(fit.x > 1e-6, fit.x, 0)


def factors(cases, weights):
    log_adjustment = np.clip(cases[FEATURES].to_numpy() @ weights,
                             -MAX_LOG_ADJUSTMENT, MAX_LOG_ADJUSTMENT)
    return np.exp(log_adjustment)


def metrics(cases):
    return {
        "count": len(cases),
        **{
            label: {
                "mape": float(cases[label].mean()),
                "min": float(cases[label].min()),
                "max": float(cases[label].max()),
                "over10": int(cases[label].gt(10).sum()),
            }
            for label in ["baselineError", "newsError"]
        },
    }


def validate(cases):
    holdout = cases.loc[cases["month"].ge(HOLDOUT_START)].copy()
    holdout["factor"] = 1.0
    holdout["fitMonth"] = ""
    for month, rows in holdout.groupby("month"):
        cutoff = cases.loc[cases["month"].lt(month)]
        holdout.loc[rows.index, "factor"] = factors(rows, fit_weights(cutoff))
        holdout.loc[rows.index, "fitMonth"] = str(cutoff["month"].max())
    holdout["adjusted"] = holdout["adaptive"] * holdout["factor"]
    holdout["baselineError"] = (holdout["adaptive"] / holdout["actual"] - 1).abs() * 100
    holdout["newsError"] = (holdout["adjusted"] / holdout["actual"] - 1).abs() * 100
    return holdout


def export_adjustments(release, signals, sources, cases, holdout, weights, metadata):
    validations = holdout.set_index(["product", "month"])["factor"]
    data = {}
    for key, forecast in release["months"].items():
        month = pd.Period(key, freq="M")
        current = signals.loc[signals["month"].eq(month)].copy()
        if current.empty:
            continue
        current["factor"] = factors(current, weights)
        if month < HOLDOUT_START:
            prior = cases.loc[cases["month"].lt(month)]
            current["validationFactor"] = factors(current, fit_weights(prior)) if len(prior) else 1
        else:
            current["validationFactor"] = [
                validations.get((product, month), 1.0) for product in current["product"]
            ]
        data[key] = {
            row.product: {
                "factor": round(row.factor, 9),
                "validationFactor": round(row.validationFactor, 9),
                "sources": sources.get((row.product, month), []),
            }
            for row in current.itertuples()
            if row.product in forecast["products"] and (row.factor != 1 or row.validationFactor != 1
                                                       or sources.get((row.product, month)))
        }
    return {**metadata, "months": data}


def evaluate(output, export_site):
    with ZipFile(ARCHIVE) as archive, archive.open("prices.csv") as source:
        prices = pd.read_csv(source, parse_dates=["date"])
        release = json.loads(archive.read("service-forecasts.json"))
    prices = prices[prices["date"].dt.to_period("M").between(START, END)]
    news = read_events(INPUTS / "events.csv", prices["product_id"].unique())
    reports = read_events(INPUTS / "reports.csv", prices["product_id"].unique())
    signals, sources = build_signals(news, reports)
    cases = build_price_cases(prices, release).merge(
        signals, on=["product", "month"], how="left", validate="one_to_one"
    ).fillna({feature: 0 for feature in FEATURES})
    if cases[["actual", "adaptive"]].le(0).any().any():
        raise ValueError("Backtesting requires positive prices")
    cases = cases.sort_values(["month", "product"])
    signals = signals.fillna({feature: 0 for feature in FEATURES})
    holdout = validate(cases)
    weights = fit_weights(cases)
    applied = holdout.loc[holdout["factor"].ne(1)]
    all_events = pd.concat([news, reports])
    summary = {
        "priceStart": str(START),
        "priceEnd": str(END),
        "calibrationStart": str(cases["month"].min()),
        "calibrationEnd": str(cases["month"].max()),
        "calibrationCases": len(cases),
        "newsCases": int(cases["news"].ne(0).sum()),
        "reportCases": int(cases["report"].ne(0).sum()),
        "sourceStart": all_events["published"].min().date().isoformat(),
        "sourceEnd": all_events["published"].max().date().isoformat(),
        "newsSources": int(news["url"].nunique()),
        "reportSources": int(reports["url"].nunique()),
        "weights": dict(zip(FEATURES, weights.tolist())),
        "holdout": metrics(holdout),
        "holdoutAdjusted": metrics(applied) if len(applied) else None,
        "validationByMonth": {str(month): metrics(group) for month, group in holdout.groupby("month")},
    }
    output.mkdir(parents=True, exist_ok=True)
    (output / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    holdout["sourceUrls"] = [
        " | ".join(source["url"] for source in sources.get((product, month), []))
        for product, month in zip(holdout["product"], holdout["month"])
    ]
    holdout.to_csv(output / "holdout-prices.csv", index=False, float_format="%.8f", encoding="utf-8-sig")
    if export_site:
        data = export_adjustments(release, signals, sources, cases, holdout, weights, summary)
        SITE_DATA.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n",
                             encoding="utf-8")
    print(json.dumps(summary, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--export-site", action="store_true")
    args = parser.parse_args()
    evaluate(args.output, args.export_site)


if __name__ == "__main__":
    main()
