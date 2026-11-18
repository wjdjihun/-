"""Build the web app's retail-price snapshot from an official KAMIS CSV or ZIP."""

import argparse
import csv
import io
import json
from contextlib import ExitStack
from datetime import date
from pathlib import Path
from zipfile import ZipFile

STORE = "경동"
REGION = "서울"
PRODUCTS = (
    ("cabbage", "배추", "봄", "1", "포기"),
    ("onion", "양파", "양파", "1", "kg"),
    ("potato", "감자", "수미(노지)", "100", "g"),
)
REQUIRED_FIELDS = {
    "가격등록일자", "시장명", "시도명", "품목명", "품종명", "조사구분명",
    "산물등급명", "품목가격", "소매출하단위크기", "소매출하단위명",
}
OUTPUT = Path(__file__).resolve().parents[1] / "frontend/lib/kamis-prices.json"


def read_prices(path):
    products_by_name = {name: (kind, size, unit) for _, name, kind, size, unit in PRODUCTS}
    observations = {name: {} for name in products_by_name}

    with ExitStack() as stack:
        if path.suffix.lower() == ".zip":
            archive = stack.enter_context(ZipFile(path))
            members = [
                member for member in archive.infolist()
                if not member.is_dir() and member.filename.lower().endswith(".csv")
                and not member.filename.startswith("__MACOSX/")
            ]
            if len(members) != 1:
                raise ValueError("압축 파일에는 KAMIS CSV 한 개가 필요합니다.")
            stream = stack.enter_context(archive.open(members[0]))
        else:
            stream = stack.enter_context(path.open("rb"))
        header = stream.readline()
        stream.seek(0)
        try:
            header.decode("utf-8-sig")
            encoding = "utf-8-sig"
        except UnicodeDecodeError:
            encoding = "cp949"
        reader = csv.DictReader(io.TextIOWrapper(stream, encoding=encoding, newline=""))
        missing = REQUIRED_FIELDS.difference(reader.fieldnames or [])
        if missing:
            raise ValueError(f"KAMIS CSV 열이 없습니다: {', '.join(sorted(missing))}")

        for row in reader:
            name = row["품목명"]
            if (
                name not in products_by_name
                or row["조사구분명"] != "소매"
                or row["시장명"] != STORE
                or row["시도명"] != REGION
                or row["산물등급명"] != "상품"
            ):
                continue
            spec = (row["품종명"], row["소매출하단위크기"], row["소매출하단위명"])
            if spec != products_by_name[name]:
                continue
            value = row["품목가격"].strip().replace(",", "")
            if not value.isdecimal() or int(value) <= 0:
                continue
            day = date.fromisoformat(row["가격등록일자"]).isoformat()
            price = int(value)
            previous = observations[name].setdefault(day, price)
            if previous != price:
                raise ValueError(f"{name} {day}의 가격이 중복되며 값이 다릅니다.")

    products = []
    for product_id, name, kind, size, unit in PRODUCTS:
        history = [
            {"date": day, "price": price}
            for day, price in sorted(observations[name].items())
        ]
        if not history:
            raise ValueError(f"{name}의 서울 경동시장 상품 소매가격이 없습니다.")
        products.append({
            "id": product_id,
            "name": name,
            "variety": "봄배추" if kind == "봄" else kind,
            "unit": f"{size}{unit}",
            "history": history,
        })

    return {
        "source": "한국농수산식품유통공사 KAMIS",
        "sourceUrl": "https://www.data.go.kr/data/15072357/fileData.do",
        "market": "서울 경동시장",
        "grade": "상품",
        "products": products,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    args = parser.parse_args()
    snapshot = read_prices(args.source)
    OUTPUT.write_text(
        json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    for product in snapshot["products"]:
        print(product["name"], product["unit"], len(product["history"]), product["history"][-1])
