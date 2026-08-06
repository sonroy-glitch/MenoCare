"""Database layer — NeonDB Postgres in production, SQLite for local dev.

Set ``DATABASE_URL`` (e.g. the Neon connection string,
``postgresql://user:pass@host/db?sslmode=require``) and the app uses Postgres.
With no ``DATABASE_URL`` it falls back to a local SQLite file so the app is
runnable/testable without a database server. The SQL is written portably: queries
use ``?`` placeholders (translated to ``%s`` for Postgres) and the schema is
generated per-backend.
"""

from __future__ import annotations

import os
import sqlite3
from pathlib import Path


def load_dotenv(path: Path | None = None) -> None:
    """Load KEY=VALUE lines from backend/.env into os.environ (no dependency).

    Real environment variables always win, so a shell export overrides the file.
    Supports `export KEY=val`, quoted values, and `#` comment/blank lines.
    """
    env_path = path or (Path(__file__).resolve().parent / ".env")
    if not env_path.is_file():
        return
    for raw in env_path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        if line.startswith("export "):
            line = line[len("export "):]
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val


load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
IS_PG = DATABASE_URL.startswith(("postgres://", "postgresql://"))
SQLITE_PATH = str(Path(__file__).resolve().parent / "MenoCare.db")

if IS_PG:
    import psycopg2
    import psycopg2.extras


def connect():
    if IS_PG:
        conn = psycopg2.connect(DATABASE_URL)
        conn.cursor_factory = psycopg2.extras.RealDictCursor
        return conn
    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _tr(sql: str) -> str:
    """`?` placeholders -> `%s` for psycopg."""
    return sql.replace("?", "%s") if IS_PG else sql


def query(conn, sql: str, params=()):
    cur = conn.cursor()
    cur.execute(_tr(sql), params)
    return cur


def fetchone(conn, sql: str, params=()):
    cur = query(conn, sql, params)
    row = cur.fetchone()
    return dict(row) if row is not None else None


def fetchall(conn, sql: str, params=()):
    cur = query(conn, sql, params)
    return [dict(r) for r in cur.fetchall()]


def insert(conn, table: str, data: dict, returning: str | None = "id"):
    """Insert a row. Returns the value of `returning` (default the new "id");
    pass returning=None for tables without an auto id column (e.g. a table whose
    primary key is a supplied foreign key)."""
    cols = ", ".join(data)
    ph = ", ".join("?" for _ in data)
    vals = list(data.values())
    if IS_PG:
        sql = f"INSERT INTO {table} ({cols}) VALUES ({ph})"
        if returning:
            cur = query(conn, sql + f" RETURNING {returning}", vals)
            return cur.fetchone()[returning]
        query(conn, sql, vals)
        return None
    cur = query(conn, f"INSERT INTO {table} ({cols}) VALUES ({ph})", vals)
    return cur.lastrowid if returning else None


# Portable schema. {PK} and {NOW} differ per backend; booleans are stored as
# INTEGER (0/1) and timestamps as TEXT ISO strings for cross-DB simplicity.
_PK = "SERIAL PRIMARY KEY" if IS_PG else "INTEGER PRIMARY KEY AUTOINCREMENT"

SCHEMA = f"""
CREATE TABLE IF NOT EXISTS accounts (
    id {_PK},
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    dob TEXT,
    address TEXT,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS medical_profiles (
    account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    height REAL, weight REAL,
    smoking TEXT, alcohol TEXT, exercise_frequency TEXT, occupation TEXT,
    menstrual_history TEXT, pregnancy_history INTEGER,
    pcos INTEGER, thyroid INTEGER, diabetes INTEGER,
    blood_pressure TEXT, cancer_history TEXT,
    family_history TEXT, medications TEXT, allergies TEXT, diet TEXT,
    menopause_stage TEXT, race INTEGER, days_since_lmp REAL,
    updated_at TEXT
);
CREATE TABLE IF NOT EXISTS symptom_entries (
    id {_PK},
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    symptom_name TEXT NOT NULL,
    severity REAL, frequency TEXT, duration REAL, notes TEXT,
    entry_date TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS alerts (
    id {_PK},
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    type TEXT, title TEXT, message TEXT, severity TEXT,
    due_date TEXT, created_at TEXT NOT NULL, dismissed INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS reminders (
    id {_PK},
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    send_at TEXT NOT NULL,
    subject TEXT, body TEXT,
    sent INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS blog_posts (
    id {_PK},
    author TEXT NOT NULL DEFAULT 'Anonymous',
    title TEXT NOT NULL, body TEXT NOT NULL,
    likes INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS blog_comments (
    id {_PK},
    post_id INTEGER NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    author TEXT NOT NULL DEFAULT 'Anonymous',
    body TEXT NOT NULL, created_at TEXT NOT NULL
);
"""


def init_db() -> None:
    conn = connect()
    try:
        cur = conn.cursor()
        for stmt in SCHEMA.strip().split(";\n"):
            stmt = stmt.strip()
            if stmt:
                cur.execute(stmt)
        conn.commit()
    finally:
        conn.close()


def backend_name() -> str:
    return "postgres" if IS_PG else "sqlite"
