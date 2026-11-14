import numpy as np
import pandas as pd

PRICE_FEATURES = [
    "price",
    "lag_7",
    "lag_14",
    "lag_30",
    "mean_7",
    "mean_30",
    "change_7",
    "month_sin",
    "month_cos",
]
ECON_FEATURES = ["usd_krw", "commodity_index"]
NEWS_FEATURES = ["news_count", "news_up", "news_down", "news_supply", "news_demand"]


def engineer_features(df: pd.DataFrame, include_target=True):
    groups = []
    for product_id, g in df.groupby("product_id", sort=True):
        g = g.sort_values("date").copy().set_index("date")
        # Calendar joins rather than row shifts: missing dates never become "7 days ago".
        original = g["price"]
        for lag in (7, 14, 30):
            g[f"lag_{lag}"] = original.reindex(
                g.index - pd.Timedelta(days=lag)
            ).to_numpy()
        g["mean_7"] = original.rolling("7D", min_periods=4).mean()
        g["mean_30"] = original.rolling("30D", min_periods=15).mean()
        g["change_7"] = g["price"] / g["lag_7"] - 1
        g["month_sin"] = np.sin(2 * np.pi * g.index.month / 12)
        g["month_cos"] = np.cos(2 * np.pi * g.index.month / 12)
        if include_target:
            # TODO[AI-02] [C] 현재 +27~+33일 7개 관측값이 모두 있어야 목표값을 만듭니다.
            # 실제 휴일/결측 자료에서는 유효 목표가 없어질 수 있습니다. 최소 관측 수 규칙과 검증 테스트를 확정하세요.
            # A 7-day mean centered on day +30; the entire label interval must precede the next split.
            future = [
                original.reindex(g.index + pd.Timedelta(days=d)).to_numpy()
                for d in range(27, 34)
            ]
            stacked = np.array(future)
            complete = np.isfinite(stacked).all(axis=0)
            g["target"] = np.where(complete, stacked.mean(axis=0), np.nan)
            g["target_date"] = g.index + pd.Timedelta(days=30)
            g["label_end"] = g.index + pd.Timedelta(days=33)
        groups.append(g.reset_index())
    frame = pd.concat(groups, ignore_index=True)
    # Identity is a stable input, never a target-derived category encoding.
    for product_id in sorted(df["product_id"].unique()):
        frame["product_" + str(product_id)] = (
            frame["product_id"] == product_id
        ).astype(float)
    # TODO[AI-03] [C] 전처리와 함께 이 검사도 모델별로 분리해야 뉴스 없는 모델 A를 학습할 수 있습니다.
    required = (
        PRICE_FEATURES
        + ECON_FEATURES
        + NEWS_FEATURES
        + (["target"] if include_target else [])
    )
    return (
        frame.dropna(subset=required)
        .sort_values(["date", "product_id"])
        .reset_index(drop=True)
    )


def time_split(frame: pd.DataFrame):
    dates = np.array(sorted(frame["date"].unique()))
    if len(dates) < 180:
        raise ValueError(
            "30일 경계 구간을 둔 검증에는 최소 180개의 유효 기준일이 필요합니다."
        )
    val_start = pd.Timestamp(dates[int(len(dates) * 0.6)])
    test_start = pd.Timestamp(dates[int(len(dates) * 0.8)])
    train = frame[frame["label_end"] < val_start].copy()
    validation = frame[
        (frame["date"] >= val_start) & (frame["label_end"] < test_start)
    ].copy()
    test = frame[frame["date"] >= test_start].copy()
    if min(len(train), len(validation), len(test)) < 30:
        raise ValueError("학습/검증/테스트 데이터가 부족합니다.")
    assert train["label_end"].max() < validation["date"].min()
    assert validation["label_end"].max() < test["date"].min()
    return train, validation, test
