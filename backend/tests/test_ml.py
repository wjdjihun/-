import json
import numpy as np
import pandas as pd
import pytest
from ml.feature_engineering import engineer_features, time_split
from ml.news_analysis import analyze_news, aggregate_news
from app.config import ROOT
from app.providers.dataset import FileDataProvider
from app.providers.base import ProviderError
from app.main import create_app
from app.config import Settings
from fastapi.testclient import TestClient


def fixture_frame(n=400):
    dates = pd.date_range("2025-01-01", periods=n)
    return pd.DataFrame(
        {
            "date": dates,
            "product_id": ["rice"] * n,
            "price": np.arange(n) + 1000,
            "usd_krw": [1380] * n,
            "commodity_index": [100] * n,
            "news_count": [1] * n,
            "news_up": [1] * n,
            "news_down": [0] * n,
            "news_supply": [1] * n,
            "news_demand": [0] * n,
        }
    )


def test_temporal_gap_prevents_target_overlap():
    frame = engineer_features(fixture_frame())
    train, val, test = time_split(frame)
    assert train.label_end.max() < val.date.min()
    assert val.label_end.max() < test.date.min()
    assert train.date.max() < val.date.min() < test.date.min()


def test_future_values_cannot_change_past_features():
    df = fixture_frame()
    cutoff = pd.Timestamp("2025-07-01")
    before = engineer_features(df, include_target=False)
    df.loc[df.date > cutoff, "price"] = 999999
    after = engineer_features(df, include_target=False)
    pd.testing.assert_frame_equal(
        before[before.date <= cutoff], after[after.date <= cutoff]
    )


def test_calendar_lags_do_not_use_wrong_day():
    df = fixture_frame(100)
    missing = df.date.iloc[50]
    df = df[df.date != missing]
    frame = engineer_features(df, include_target=False)
    assert missing + pd.Timedelta(days=7) not in set(frame.date)


def test_event_direction_dedup_and_publication_cutoff():
    article = {
        "id": "1",
        "title": "폭우로 배추 생산량 감소, 도매가격 상승",
        "published_at": "2026-11-10T09:00:00+09:00",
    }
    analysis = analyze_news(article)
    assert analysis["event"] == "공급량 감소"
    assert analysis["direction"] == "up" and analysis["product_ids"] == ["cabbage"]
    future = {
        **article,
        "id": "2",
        "title": "배추 공급 부족",
        "published_at": "2026-11-15T09:00:00+09:00",
    }
    late = {
        **article,
        "id": "3",
        "title": "배추 수요 증가",
        "available_at": "2026-11-16T09:00:00+09:00",
    }
    result = aggregate_news(
        [article, {**article, "id": "4"}, future, late], "2026-11-14"
    )
    assert result["cabbage"]["news_count"] == 1
    assert result["cabbage"]["news_up"] == 2


def test_live_provider_rejects_demo_and_future_news(tmp_path):
    data = json.loads((ROOT / "data/demo/dataset.json").read_text())
    path = tmp_path / "live.json"
    path.write_text(json.dumps(data))
    with pytest.raises(ProviderError):
        FileDataProvider(path).load()
    data["mode"] = "live"
    for p in data["products"]:
        p["mode"] = "live"
    for n in data["news"]:
        n["mode"] = "live"
        n["original_url"] = "https://example.org/news/" + n["id"]
    data["news"][0]["published_at"] = "2027-01-01T00:00:00+09:00"
    path.write_text(json.dumps(data))
    with pytest.raises(ProviderError):
        FileDataProvider(path).load()


def test_real_mode_never_falls_back_to_a_demo_model(tmp_path):
    data = json.loads((ROOT / "data/demo/dataset.json").read_text())
    data["mode"] = "live"
    for p in data["products"]:
        p["mode"] = "live"
    for n in data["news"]:
        n["mode"] = "live"
        n["original_url"] = "https://example.org/news/" + n["id"]
    path = tmp_path / "live.json"
    path.write_text(json.dumps(data))
    settings = Settings(
        data_provider="file",
        dataset_path=path,
        model_dir=tmp_path / "missing-model",
        _env_file=None,
    )
    with TestClient(
        create_app(tmp_path / "basket.sqlite3", settings=settings)
    ) as client:
        assert client.get("/api/products").status_code == 503


def test_sparse_price_mode_keeps_missing_lags_as_missing():
    source = fixture_frame(100)
    missing_day = source.date.iloc[50]
    source = source[source.date.ne(missing_day)]
    result = engineer_features(
        source, include_target=False, allow_sparse_prices=True
    )
    following = result[result.date.eq(missing_day + pd.Timedelta(days=7))]
    assert len(following) == 1
    assert following["lag_7"].isna().all()
    assert following["change_7"].isna().all()
