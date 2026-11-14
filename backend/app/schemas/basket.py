from pydantic import BaseModel, Field, model_validator


class BasketItem(BaseModel):
    product_id: str = Field(min_length=1, max_length=40)
    quantity: int = Field(ge=1, le=999, strict=True)
    current_price: int = Field(ge=1, le=10_000_000, strict=True)


class BasketPayload(BaseModel):
    items: list[BasketItem] = Field(max_length=100)

    @model_validator(mode="after")
    def unique_products(self):
        ids = [i.product_id for i in self.items]
        if len(ids) != len(set(ids)):
            raise ValueError("같은 품목을 중복 등록할 수 없습니다.")
        return self
