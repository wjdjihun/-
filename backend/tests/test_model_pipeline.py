from pathlib import Path
import pytest
from app.config import ROOT
from ml.train import train
from ml.predict import PredictionEngine


def test_synthetic_pipeline_train_save_evaluate_reload_predict(tmp_path):
    data = ROOT / "data/demo/training.csv"
    metrics = train(data, tmp_path, allow_demo=True)
    assert metrics["status"] == "demo_trained"
    assert metrics["data_mode"] == "demo"
    assert set(metrics["models"]) == {"baseline", "model_a", "model_b"}
    assert len({m["count"] for m in metrics["models"].values()}) == 1
    assert metrics["backtest"]
    assert (
        metrics["splits"]["train"]["label_end"]
        < metrics["splits"]["validation"]["start"]
    )
    assert (
        metrics["splits"]["validation"]["label_end"]
        < metrics["splits"]["test"]["start"]
    )
    engine = PredictionEngine(tmp_path, data)
    for id in ("rice", "cabbage", "onion"):
        prediction = engine.predict(id, "2026-11-14")
        assert (
            0 < prediction["lower"] <= prediction["prediction"] <= prediction["upper"]
        )
        assert prediction["data_mode"] == "demo"
    with pytest.raises(ValueError, match="학습 종료일"):
        engine.predict("rice", "2026-10-01")
    with pytest.raises(ValueError, match="allow-demo"):
        train(data, tmp_path / "not-allowed", allow_demo=False)


def test_model_a_can_train_and_predict_without_news_columns(tmp_path):
    import pandas as pd

    source = pd.read_csv(ROOT / "data/demo/training.csv")
    source = source.drop(columns=source.filter(regex="^news_").columns)
    prices = tmp_path / "prices.csv"
    source.to_csv(prices, index=False)

    metrics = train(prices, tmp_path, allow_demo=True, model_a_only=True, refit=True)
    assert set(metrics["models"]) == {"baseline", "model_a"}
    assert metrics["product_metrics"]["onion"]["model_a"]["count"] > 0
    assert not (tmp_path / "model_b.joblib").exists()
    cutoff = str(source["date"].max())
    assert metrics["splits"]["test"]["label_end"] <= cutoff
    refit = metrics["refits"]["model_a"]
    assert refit["label_end"] <= cutoff
    assert refit["fit_rows"] > metrics["rows"]
    assert (tmp_path / refit["file"]).is_file()
    engine = PredictionEngine(tmp_path, prices, model_name="model_a")
    assert engine.predict("onion", "2026-11-14")["prediction"] > 0
