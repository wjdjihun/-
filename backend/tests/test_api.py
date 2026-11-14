import pytest
from app.services.forecast import basket_forecast, scale_price


def test_totals_use_fixed_quantities(client):
    products = {p["id"]: p for p in client.get("/api/products").json()}
    items = [
        {
            "product_id": "cabbage",
            "quantity": 3,
            "current_price": products["cabbage"]["price"],
        },
        {
            "product_id": "milk",
            "quantity": 2,
            "current_price": products["milk"]["price"],
        },
    ]
    result = client.post("/api/basket/forecast", json={"items": items}).json()
    assert result["current"] == 4280 * 3 + 2980 * 2
    assert (
        result["future"]
        == products["cabbage"]["forecast"] * 3 + products["milk"]["forecast"] * 2
    )
    assert result["change"] == pytest.approx(
        (result["future"] / result["current"] - 1) * 100
    )
    assert result["lower"] <= result["future"] <= result["upper"]
    assert result["mode"] == "demo"


def test_quantity_change_recalculates_exactly(client):
    payload = {"items": [{"product_id": "rice", "quantity": 1, "current_price": 32900}]}
    first = client.post("/api/basket/forecast", json=payload).json()
    payload["items"][0]["quantity"] = 4
    fourth = client.post("/api/basket/forecast", json=payload).json()
    assert fourth["current"] == first["current"] * 4
    assert fourth["future"] == first["future"] * 4


def test_custom_price_rounding_and_empty_basket(client):
    p = client.get("/api/products/eggs").json()
    result = client.post(
        "/api/basket/forecast",
        json={"items": [{"product_id": "eggs", "quantity": 2, "current_price": 7000}]},
    ).json()
    assert result["future"] == scale_price(7000, p["forecast"], p["price"]) * 2
    empty = client.post("/api/basket/forecast", json={"items": []}).json()
    assert empty["current"] == empty["future"] == empty["change"] == 0


@pytest.mark.parametrize(
    "item",
    [
        {"product_id": "rice", "quantity": 0, "current_price": 100},
        {"product_id": "rice", "quantity": -1, "current_price": 100},
        {"product_id": "rice", "quantity": 1.5, "current_price": 100},
        {"product_id": "rice", "quantity": True, "current_price": 100},
        {"product_id": "rice", "quantity": 1, "current_price": 0},
        {"product_id": "missing", "quantity": 1, "current_price": 100},
        {"product_id": "rice", "quantity": 1000, "current_price": 100},
    ],
)
def test_invalid_baskets_rejected(client, item):
    assert (
        client.post("/api/basket/forecast", json={"items": [item]}).status_code == 422
    )


def test_duplicate_rejected_and_sqlite_persists(client):
    item = {"product_id": "apple", "quantity": 2, "current_price": 12000}
    assert client.post("/api/basket", json={"items": [item, item]}).status_code == 422
    assert client.post("/api/basket", json={"items": [item]}).status_code == 200
    assert client.get("/api/basket").json()["items"] == [item]


def test_prediction_metadata_and_news_route_order(client):
    forecast = client.get("/api/products/cabbage/forecast").json()
    assert forecast["method"] == "demo_ratio"
    assert forecast["reference_date"] == "2026-11-14"
    assert forecast["spec"] and forecast["region"] and forecast["grade"]
    assert forecast["interval_method"] == "illustrative_not_calibrated"
    assert client.get("/api/news/analysis").status_code == 200
    assert (
        client.get("/api/news?product_id=cabbage&direction=up").json()[0]["id"] == "n1"
    )
    assert len(client.get("/api/products/rice/history?days=7").json()) == 7
    assert client.get("/api/products/unknown").status_code == 404
    assert client.get("/api/news/unknown").status_code == 404


def test_untrained_metrics_are_not_invented(client):
    metrics = client.get("/api/model/metrics").json()
    assert metrics["status"] == "not_trained"
    assert metrics["models"] == {}
    assert metrics["feature_importance"] is None
    assert client.get("/docs").status_code == 200
    assert client.get("/api/health").json()["mode"] == "demo"
