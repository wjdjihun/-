"""Combine matched KAMIS price snapshots, FRED DEXKOUS CSV and World Bank Food XLSX."""

import argparse
import csv
from bisect import bisect_right
from datetime import date, timedelta
import json
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET


def read_exchange_rates(path):
    # Use a fixed ten-day lag for the weekly H.10 release schedule.
    with path.open(encoding="utf-8-sig", newline="") as stream:
        return sorted(
            (date.fromisoformat(row["observation_date"]) + timedelta(days=10), float(row["DEXKOUS"]))
            for row in csv.DictReader(stream)
            if row["DEXKOUS"] not in {"", "."}
        )


def read_food_index(path):
    namespace = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    rel_key = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
    with ZipFile(path) as archive:
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        sheet_id = next(
            sheet.attrib[rel_key] for sheet in workbook.findall(".//s:sheet", namespace)
            if sheet.get("name") == "Monthly Indices"
        )
        relations = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        target = next(item.attrib["Target"] for item in relations if item.get("Id") == sheet_id)
        worksheet = ET.fromstring(archive.read(target.lstrip("/") if target.startswith("/") else "xl/" + target))
        strings = [
            "".join(node.text or "" for node in item.findall(".//s:t", namespace))
            for item in ET.fromstring(archive.read("xl/sharedStrings.xml"))
        ]
    food_column = None
    series = []
    for row in worksheet.findall(".//s:sheetData/s:row", namespace):
        cells = {}
        for cell in row:
            value = cell.find("s:v", namespace)
            if value is not None and value.text is not None:
                column = cell.attrib["r"].rstrip("0123456789")
                cells[column] = strings[int(value.text)] if cell.get("t") == "s" else value.text
        for column, value in cells.items():
            if value.strip().rstrip("*").strip() == "Food":
                food_column = column
        month = cells.get("A", "")
        if food_column not in cells or len(month) != 7 or month[4] not in {"M", "-"}:
            continue
        year, number = int(month[:4]), int(month[5:])
        # The index is monthly. Use it from two months after the observation month.
        offset = number + 1
        available = date(year + offset // 12, offset % 12 + 1, 1)
        series.append((available, float(cells[food_column])))
    if not series:
        raise ValueError("World Bank workbook does not contain monthly Food index values.")
    return sorted(series)


def make_rows(snapshots, fx, food, *, start=None, end=None):
    fx_dates, food_dates = [d for d, _ in fx], [d for d, _ in food]
    observations = {}
    for path in snapshots:
        data = json.loads(path.read_text(encoding="utf-8"))
        for product in data["products"]:
            metadata = {
                "spec": f"{product['variety']} · {product['unit']}",
                "grade": data["grade"],
                "region": data["market"],
                "source": data["source"],
            }
            for item in product["history"]:
                day = date.fromisoformat(item["date"])
                if (start is not None and day < start) or (end is not None and day > end):
                    continue
                key = product["id"], day
                row = {"price": item["price"], **metadata}
                if observations.setdefault(key, row) != row:
                    raise ValueError(f"Conflicting price observation: {key}")

    for (product_id, day), row in sorted(observations.items()):
        i, j = bisect_right(fx_dates, day) - 1, bisect_right(food_dates, day) - 1
        if i < 0 or j < 0:
            continue
        yield {
            "date": day.isoformat(),
            "product_id": product_id,
            "price": row["price"],
            "usd_krw": fx[i][1],
            "commodity_index": food[j][1],
            "data_mode": "live",
            "available_at": f"{day.isoformat()}T23:59:59+09:00",
            **row,
        }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--price", type=Path, action="append", required=True)
    parser.add_argument("--fx", type=Path, required=True)
    parser.add_argument("--food", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--start", type=date.fromisoformat)
    parser.add_argument("--end", type=date.fromisoformat)
    args = parser.parse_args()
    if args.start and args.end and args.start > args.end:
        parser.error("--start must be on or before --end.")
    rows = list(make_rows(
        args.price,
        read_exchange_rates(args.fx),
        read_food_index(args.food),
        start=args.start,
        end=args.end,
    ))
    if not rows:
        parser.error("No price observations had both economic inputs available.")
    with args.output.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    print(f"Prepared {len(rows)} historical retail-price rows.")
