import json
from datetime import date
from pathlib import Path
from app.config import ROOT
from app.providers.base import ProviderError


class DemoProvider:
    def load(self):
        return json.loads((ROOT / "data/demo/dataset.json").read_text())


class FileDataProvider:
    """Load normalized, verified official data. No implicit demo fallback."""

    def __init__(self, path: Path):
        self.path = path

    def load(self):
        try:
            data = json.loads(self.path.read_text())
        except (OSError, ValueError) as exc:
            raise ProviderError(
                "실제 데이터 파일을 읽을 수 없습니다. 수집·정규화 작업을 먼저 실행하세요."
            ) from exc
        if data.get("mode") != "live":
            raise ProviderError("실제 데이터 파일의 mode는 live여야 합니다.")

        def require(condition):
            if not condition:
                raise ValueError("데이터 계약 위반")

        try:
            reference = date.fromisoformat(data["reference_date"])
            ids = [p["id"] for p in data["products"]]
            require(ids and len(ids) == len(set(ids)))
            for p in data["products"]:
                require(p["price"] > 0 and p["mode"] == "live")
                require(
                    all(p.get(k) for k in ("spec", "grade", "region", "source", "unit"))
                )
                require(date.fromisoformat(p["reference_date"]) <= reference)
                require(p["id"] in data["history"])
                for row in data["history"][p["id"]]:
                    require(
                        date.fromisoformat(row["date"]) <= reference
                        and row["price"] > 0
                    )
            for article in data["news"]:
                require(article["mode"] == "live")
                require(date.fromisoformat(article["published_at"][:10]) <= reference)
                require(set(article["product_ids"]) <= set(ids))
                require(article["original_url"].startswith("https://"))
                require(article["direction"] in ("up", "down", "neutral"))
        except (KeyError, TypeError, ValueError) as exc:
            raise ProviderError(
                "실제 데이터의 날짜·규격·출처 또는 형식이 올바르지 않습니다."
            ) from exc
        return data
