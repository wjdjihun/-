import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

class BasketRepository:
    """A local single-user SQLite repository. Replace with user-keyed storage before sharing."""
    def __init__(self, path: Path):
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(path) as conn:
            conn.execute('CREATE TABLE IF NOT EXISTS baskets (id INTEGER PRIMARY KEY CHECK(id=1), items TEXT NOT NULL, updated_at TEXT NOT NULL)')

    def read(self):
        with sqlite3.connect(self.path) as conn:
            row = conn.execute('SELECT items, updated_at FROM baskets WHERE id=1').fetchone()
        return {'items': json.loads(row[0]), 'updated_at': row[1]} if row else None

    def save(self, items: list[dict]):
        now = datetime.now(timezone.utc).isoformat()
        with sqlite3.connect(self.path) as conn:
            conn.execute('INSERT INTO baskets VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET items=excluded.items, updated_at=excluded.updated_at', (json.dumps(items, ensure_ascii=False), now))
        return {'items': items, 'updated_at': now}
