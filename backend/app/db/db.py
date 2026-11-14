"""SQLite connection helpers for BOLI personal repository."""

import os
import sqlite3
from pathlib import Path

_HERE = Path(__file__).resolve().parent          # backend/app/db
_BACKEND_ROOT = _HERE.parent.parent              # backend
_SCHEMA = _HERE / "schema.sql"
DEFAULT_PATH = _BACKEND_ROOT / "db" / "boli.sqlite"


def path() -> Path:
    """Where the database lives, independent of the working directory."""
    configured = os.getenv("DATABASE_PATH")
    if not configured:
        # Default to historical data in backend/db/boli.sqlite if present, or app/db
        if DEFAULT_PATH.exists():
            return DEFAULT_PATH
        fallback = _HERE / "boli.sqlite"
        return DEFAULT_PATH if not fallback.exists() else fallback
    configured = Path(configured)
    return configured if configured.is_absolute() else _BACKEND_ROOT / configured


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(path(), timeout=10.0)
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.row_factory = sqlite3.Row
    return conn


def init() -> None:
    """Create the tables and performance indexes if missing. Safe on every boot."""
    path().parent.mkdir(parents=True, exist_ok=True)
    conn = connect()
    try:
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA busy_timeout = 5000;")
        conn.executescript(_SCHEMA.read_text(encoding="utf-8"))
        conn.commit()
    finally:
        conn.close()
