from copy import deepcopy
from threading import RLock
from app.config import Settings
from app.providers.base import DataProvider
from app.providers.dataset import DemoProvider, FileDataProvider


class DatasetService:
    def __init__(self, settings: Settings, provider: DataProvider | None = None):
        self.settings = settings
        if settings.data_provider not in ("demo", "file"):
            raise ValueError("DATA_PROVIDER는 demo 또는 file이어야 합니다.")
        self.provider = provider or (
            DemoProvider()
            if settings.data_provider == "demo"
            else FileDataProvider(settings.dataset_path)
        )
        self._signature = None
        self._cached = None
        self._lock = RLock()

    def load(self):
        paths = [
            self.settings.dataset_path,
            self.settings.training_data_path,
            self.settings.model_dir / "model_b.joblib",
            self.settings.model_dir / "metrics.json",
        ]
        signature = tuple(
            (str(p), p.stat().st_mtime_ns if p.exists() else None) for p in paths
        )
        with self._lock:
            if self._cached is not None and self._signature == signature:
                return deepcopy(self._cached)
            data = self._load()
            self._cached, self._signature = data, signature
            return deepcopy(data)

    def _load(self):
        data = deepcopy(self.provider.load())
        if data["mode"] == "live":
            from ml.predict import PredictionEngine

            engine = PredictionEngine(
                self.settings.model_dir, self.settings.training_data_path
            )
            if engine.metrics.get("data_mode") != "live":
                raise ValueError(
                    "실제 데이터에는 실제 데이터로 학습한 모델이 필요합니다."
                )
            for p in data["products"]:
                metadata = engine.bundle["reference_metadata"].get(p["id"], {})
                if any(str(p.get(k)) != v for k, v in metadata.items()):
                    raise ValueError("웹 데이터와 모델의 규격·등급·지역이 다릅니다.")
                result = engine.predict(p["id"], data["reference_date"])
                if p["price"] != result["input_price"]:
                    raise ValueError("웹 데이터와 추론 입력의 현재 가격이 다릅니다.")
                p.update(
                    forecast=result["prediction"],
                    lower=result["lower"],
                    upper=result["upper"],
                    change=(result["prediction"] / p["price"] - 1) * 100,
                    forecast_method="xgboost",
                    interval_method="validation_residual",
                )
        return data
