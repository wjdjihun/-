from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import create_router
from app.config import Settings
from app.database.basket import BasketRepository
from app.services.dataset import DatasetService


def create_app(
    db_path: Path | None = None, provider=None, settings: Settings | None = None
):
    settings = settings or Settings()
    app = FastAPI(
        title="PriceRadar AI · 물가레이더 API",
        description="동일 수량 기준 미래 장바구니 비용. 기본값은 명시적인 시연 데이터입니다.",
        version="1.0.0",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[v.strip() for v in settings.cors_origins.split(",")],
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )
    app.include_router(
        create_router(
            DatasetService(settings, provider),
            BasketRepository(db_path or settings.database_path),
        )
    )
    return app


app = create_app()
