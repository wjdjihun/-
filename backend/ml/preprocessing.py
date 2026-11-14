from pathlib import Path
import numpy as np
import pandas as pd

REQUIRED = [
    "date",
    "product_id",
    "price",
    "usd_krw",
    "commodity_index",
    "news_count",
    "news_up",
    "news_down",
    "news_supply",
    "news_demand",
    "data_mode",
    "available_at",
    "spec",
    "grade",
    "region",
    "source",
]


def load_prices(path: Path, allow_demo=False):
    df = pd.read_csv(path)
    missing = sorted(set(REQUIRED) - set(df.columns))
    if missing:
        raise ValueError("누락된 열: " + ", ".join(missing))
    if not set(df["data_mode"].unique()) <= (
        {"live", "demo"} if allow_demo else {"live"}
    ):
        raise ValueError(
            "합성 데이터 학습은 --allow-demo를 명시해야 합니다. 실제 성능으로 사용하지 마세요."
        )
    if df["data_mode"].nunique() != 1:
        raise ValueError("실제 데이터와 데모 데이터를 혼합할 수 없습니다.")
    df["date"] = pd.to_datetime(df["date"], format="%Y-%m-%d")
    known = (
        pd.to_datetime(df["available_at"], utc=True)
        .dt.tz_convert("Asia/Seoul")
        .dt.tz_localize(None)
        .dt.normalize()
    )
    if (known > df["date"]).any():
        raise ValueError("기준일 이후 공개된 입력 데이터가 있습니다.")
    if df.duplicated(["product_id", "date"]).any():
        raise ValueError(
            "같은 품목·날짜의 중복 행이 있습니다. 규격·등급·지역을 먼저 정규화하세요."
        )
    if df[["spec", "grade", "region", "source"]].isna().any().any():
        raise ValueError("규격·등급·지역·출처가 필요합니다.")
    for id, g in df.groupby("product_id"):
        if any(g[c].nunique() != 1 for c in ("spec", "grade", "region")):
            raise ValueError(
                f"{id}: 서로 다른 규격을 하나의 시계열에 혼합할 수 없습니다."
            )
    numeric = [
        "price",
        "usd_krw",
        "commodity_index",
        "news_count",
        "news_up",
        "news_down",
        "news_supply",
        "news_demand",
    ]
    df[numeric] = df[numeric].apply(pd.to_numeric, errors="raise")
    if not np.isfinite(df[numeric].to_numpy()).all() or (df["price"] <= 0).any():
        raise ValueError("유효한 수치와 양수 가격이 필요합니다.")
    return df.sort_values(["product_id", "date"]).reset_index(drop=True)
