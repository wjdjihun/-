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
