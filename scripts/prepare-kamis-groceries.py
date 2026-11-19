"""Extract the six retail grocery series from official KAMIS archives."""

import argparse
import json
from pathlib import Path
from runpy import run_path
from zipfile import ZipFile


CATALOG = [
    ("onion", "양파", "양파", "양파", "1", "kg"),
    ("green-onion", "파", "대파", "대파", "1", "kg"),
    ("zucchini", "호박", "애호박", "애호박", "1", "개"),
    ("cucumber", "오이", "다다기오이", "다다기계통", "10", "개"),
    ("garlic", "깐마늘(국산)", "국산 깐마늘", "깐마늘(국산)", "1", "kg"),
    ("enoki", "팽이버섯", "팽이버섯", "팽이버섯", "150", "g"),
]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("inputs", type=Path, nargs="+")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    collect = run_path(str(Path(__file__).with_name("import-kamis-prices.py")))["collect_observations"]
    specs = {name: (variety, size, unit) for _, name, _, variety, size, unit in CATALOG}
    observations = {name: {} for name in specs}
    for path in args.inputs:
        if path.suffix.lower() != ".zip":
            with path.open("rb") as stream:
                collect(stream, specs, observations)
            continue
        with ZipFile(path) as archive:
            members = [entry for entry in archive.namelist() if entry.lower().endswith(".csv")]
            if len(members) > 1:
                members = [entry for entry in members if Path(entry).name[:4].isdigit() and int(Path(entry).name[:4]) >= 2021]
            for entry in members:
                with archive.open(entry) as stream:
                    collect(stream, specs, observations)

    products = []
    for product_id, source_name, name, variety, size, unit in CATALOG:
        history = [
            {"date": day, "price": price}
            for day, price in sorted(observations[source_name].items())
            if "2021-07-01" <= day <= "2026-06-30"
        ]
        if not history or history[-1]["date"] != "2026-06-30":
            raise ValueError(f"{name}: latest observation is missing")
        products.append({"id": product_id, "name": name, "variety": variety, "unit": size + unit, "history": history})
    snapshot = {
        "source": "한국농수산식품유통공사 KAMIS",
        "sourceUrl": "https://www.data.go.kr/data/15072357/fileData.do",
        "market": "서울 경동시장",
        "grade": "상품",
        "products": products,
    }
    args.output.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
