from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT.parent / ".env", extra="ignore")
    data_provider: str = "demo"
    dataset_path: Path = ROOT / "data/raw/live_dataset.json"
    database_path: Path = ROOT / "data/basket.sqlite3"
    model_dir: Path = ROOT / "ml/artifacts"
    training_data_path: Path = ROOT / "data/raw/prices.csv"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    kamis_cert_id: str = ""
    kamis_cert_key: str = ""
    ecos_api_key: str = ""
    kosis_api_key: str = ""
    weather_api_key: str = ""
    news_api_key: str = ""
