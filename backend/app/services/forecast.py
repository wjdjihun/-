from decimal import Decimal, ROUND_HALF_UP


def scale_price(current: int, amount: int, original: int) -> int:
    return int(
        (Decimal(current) * Decimal(amount) / Decimal(original)).quantize(
            Decimal("1"), rounding=ROUND_HALF_UP
        )
    )


def basket_forecast(
    items: list[dict], products: list[dict], mode="demo", reference_date=""
):
    lookup = {p["id"]: p for p in products}
    current = future = lower = upper = 0
    details = []
    for item in items:
        if item["product_id"] not in lookup:
            raise ValueError("지원하지 않는 품목입니다: " + item["product_id"])
        p = lookup[item["product_id"]]
        price, quantity = item["current_price"], item["quantity"]
        predicted = scale_price(price, p["forecast"], p["price"])
        low = scale_price(price, p["lower"], p["price"])
        high = scale_price(price, p["upper"], p["price"])
        current += price * quantity
        future += predicted * quantity
        lower += low * quantity
        upper += high * quantity
        details.append(
            {**item, "forecast_price": predicted, "future_total": predicted * quantity}
        )
    difference = future - current
    return dict(
        current=current,
        future=future,
        difference=difference,
        change=difference / current * 100 if current else 0,
        lower=lower,
        upper=upper,
        items=details,
        mode=mode,
        reference_date=reference_date,
        horizon_days=30,
        interval_method="시연 범위" if mode == "demo" else "검증 잔차 범위",
        note="동일 수량 기준. 미래 가격 및 범위는 보장되지 않습니다.",
    )
