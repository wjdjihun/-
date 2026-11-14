"""Reproducible synthetic data for testing the pipeline, never for real performance claims."""

import argparse
import json
import math
from datetime import date, timedelta
from pathlib import Path
import pandas as pd


def generate(output: Path):
    fixture = json.loads(
        (Path(__file__).resolve().parents[1] / "data/demo/dataset.json").read_text()
    )
    end = date.fromisoformat(fixture["reference_date"])
    rows = []
    for j, p in enumerate(fixture["products"]):
        for i in range(540):
            day = end - timedelta(days=539 - i)
            rows.append(
                {
                    "date": str(day),
                    "product_id": p["id"],
                    "price": round(
                        p["price"]
                        * (
                            0.9
                            + 0.00017 * i
                            + 0.035 * math.sin(i / 25 + j)
                            + 0.012 * math.cos(i / 8 + j)
                        )
                    ),
                    "usd_krw": round(1350 + 35 * math.sin(i / 65), 2),
                    "commodity_index": round(100 + 8 * math.sin(i / 73), 2),
                    "news_count": int((i + j) % 4 == 0),
                    "news_up": int((i + j) % 7 == 0),
                    "news_down": int((i + j) % 11 == 0),
                    "news_supply": int((i + j) % 7 == 0) - int((i + j) % 11 == 0),
                    "news_demand": int((i + j) % 13 == 0),
                    "available_at": str(day) + "T09:00:00+09:00",
                    "data_mode": "demo",
                    "spec": p["spec"],
                    "grade": p["grade"],
                    "region": p["region"],
                    "source": "deterministic_synthetic_demo",
                }
            )
    output.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows).to_csv(output, index=False)
    print(
        f"합성 데이터 {len(rows)}행 생성: {output}. 실제 모델 성능 검증에 사용하지 마세요."
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("data/demo/training.csv"))
    generate(parser.parse_args().output)
