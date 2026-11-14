import json
from datetime import date
from fastapi import APIRouter, HTTPException, Query
from app.schemas.basket import BasketPayload
from app.services.forecast import basket_forecast


def create_router(service, repository):
    router = APIRouter(prefix="/api")

    def dataset():
        try:
            return service.load()
        except (ValueError, RuntimeError, FileNotFoundError) as exc:
            raise HTTPException(
                503,
                "데이터 또는 모델을 사용할 수 없습니다. 서버 설정과 수집 파일을 확인하세요.",
            ) from exc

    def product(data, product_id):
        p = next((p for p in data["products"] if p["id"] == product_id), None)
        if not p:
            raise HTTPException(404, "품목을 찾을 수 없습니다.")
        return p

    def forecast(payload, data):
        try:
            return basket_forecast(
                [i.model_dump() for i in payload.items],
                data["products"],
                data["mode"],
                data["reference_date"],
            )
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc

    @router.get("/health", tags=["상태"])
    def health():
        data = dataset()
        return {
            "status": "ok",
            "mode": data["mode"],
            "reference_date": data["reference_date"],
            "model_status": "not_trained" if data["mode"] == "demo" else "trained",
        }

    @router.get("/products", tags=["품목"])
    def products():
        return dataset()["products"]

    @router.get("/products/{product_id}", tags=["품목"])
    def detail(product_id: str):
        return product(dataset(), product_id)

    @router.get("/products/{product_id}/history", tags=["품목"])
    def history(product_id: str, days: int = Query(90, ge=1, le=3650)):
        data = dataset()
        product(data, product_id)
        return data["history"][product_id][-days:]

    @router.get("/products/{product_id}/forecast", tags=["예측"])
    def product_prediction(product_id: str):
        data = dataset()
        p = product(data, product_id)
        return {
            "product_id": p["id"],
            "prediction": p["forecast"],
            "lower": p["lower"],
            "upper": p["upper"],
            "change": p["change"],
            "mode": data["mode"],
            "method": "demo_ratio" if data["mode"] == "demo" else "xgboost",
            "reference_date": data["reference_date"],
            "horizon_days": 30,
            "spec": p["spec"],
            "grade": p["grade"],
            "region": p["region"],
            "source": p["source"],
            "interval_method": "illustrative_not_calibrated"
            if data["mode"] == "demo"
            else "validation_residual_90pct",
            "reason": p["reason"],
        }

    @router.get("/news", tags=["뉴스"])
    def news(
        product_id: str | None = None,
        direction: str | None = None,
        event: str | None = None,
        start_date: date | None = None,
    ):
        data = dataset()
        return [
            n
            for n in data["news"]
            if (not product_id or product_id in n["product_ids"])
            and (not direction or n["direction"] == direction)
            and (not event or n["event"] == event)
            and (not start_date or n["published_at"][:10] >= str(start_date))
        ]

    @router.get("/news/analysis", tags=["뉴스"])
    def news_analysis():
        data = dataset()
        return {
            "mode": data["mode"],
            "products": [
                {
                    "product_id": p["id"],
                    "name": p["name"],
                    "count": sum(p["id"] in n["product_ids"] for n in data["news"]),
                    "up": sum(
                        p["id"] in n["product_ids"] and n["direction"] == "up"
                        for n in data["news"]
                    ),
                    "down": sum(
                        p["id"] in n["product_ids"] and n["direction"] == "down"
                        for n in data["news"]
                    ),
                }
                for p in data["products"]
            ],
        }

    @router.get("/news/{news_id}", tags=["뉴스"])
    def news_detail(news_id: str):
        n = next((n for n in dataset()["news"] if n["id"] == news_id), None)
        if not n:
            raise HTTPException(404, "기사를 찾을 수 없습니다.")
        return n

    @router.get("/basket", tags=["장바구니"])
    def basket():
        stored = repository.read()
        if stored:
            return stored
        return {
            "items": [
                {
                    "product_id": p["id"],
                    "quantity": p.get("default_quantity", 1),
                    "current_price": p["price"],
                }
                for p in dataset()["products"]
            ],
            "updated_at": None,
        }

    @router.post("/basket", tags=["장바구니"])
    def save_basket(payload: BasketPayload):
        forecast(payload, dataset())
        return repository.save([i.model_dump() for i in payload.items])

    @router.post("/basket/forecast", tags=["예측"])
    def predict_basket(payload: BasketPayload):
        return forecast(payload, dataset())

    @router.get("/model/metrics", tags=["모델"])
    def metrics():
        path = service.settings.model_dir / "metrics.json"
        if path.exists():
            result = json.loads(path.read_text())
            result["status"] = (
                "trained" if result.get("data_mode") == "live" else "demo_trained"
            )
            return result
        return {
            "status": "not_trained",
            "data_mode": "demo",
            "models": {},
            "rows": 0,
            "period": None,
            "feature_importance": None,
            "news_improvement_mape": None,
            "message": "학습된 모델이 없습니다. 데모 전망은 모델 예측이 아닙니다.",
        }

    return router
