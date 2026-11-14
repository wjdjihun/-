import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.main import create_app
from app.config import Settings

@pytest.fixture
def client(tmp_path):
    settings=Settings(data_provider='demo',model_dir=tmp_path/'no-model',_env_file=None)
    with TestClient(create_app(tmp_path/'basket.sqlite3',settings=settings)) as client:
        yield client
