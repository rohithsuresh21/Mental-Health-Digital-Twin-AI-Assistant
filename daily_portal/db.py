import json, os
from datetime import date, datetime
from pathlib import Path
from typing import Optional

_DATABASE_URL = os.environ.get("DATABASE_URL")
if _DATABASE_URL:
    import psycopg2
    import psycopg2.extras


def _conn():
    if _DATABASE_URL:
        conn = psycopg2.connect(_DATABASE_URL)
        conn.autocommit = False
        return conn
    # Fallback to SQLite for local dev
    import sqlite3

    DB_DIR = Path(__file__).parent.parent / "data"
    DB_DIR.mkdir(exist_ok=True)
    DB_PATH = DB_DIR / "daily_portal.db"
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    return conn


def init_db():
    with _conn() as c:
        if _DATABASE_URL:
            c.execute("""
                CREATE TABLE IF NOT EXISTS daily_entries (
                    id              SERIAL PRIMARY KEY,
                    user_id         TEXT    NOT NULL,
                    entry_date      TEXT    NOT NULL,
                    created_at      TEXT    NOT NULL,
                    text_raw        TEXT,
                    audio_path      TEXT,
                    sleep_hours     DOUBLE PRECISION,
                    sleep_quality   DOUBLE PRECISION,
                    activity_level  DOUBLE PRECISION,
                    music_mood_score DOUBLE PRECISION,
                    feature_vector  TEXT,
                    readable_metrics TEXT,
                    features_extracted INTEGER DEFAULT 0,
                    baselined       INTEGER DEFAULT 0,
                    UNIQUE(user_id, entry_date)
                )
            """)
            c.execute("""
                CREATE INDEX IF NOT EXISTS idx_entries_user
                ON daily_entries(user_id, entry_date DESC)
            """)
        else:
            c.execute("""
                CREATE TABLE IF NOT EXISTS daily_entries (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id     TEXT    NOT NULL,
                    entry_date  TEXT    NOT NULL,
                    created_at  TEXT    NOT NULL,
                    text_raw    TEXT,
                    audio_path  TEXT,
                    sleep_hours       REAL,
                    sleep_quality     REAL,
                    activity_level    REAL,
                    music_mood_score  REAL,
                    feature_vector    TEXT,
                    readable_metrics  TEXT,
                    features_extracted INTEGER DEFAULT 0,
                    baselined         INTEGER DEFAULT 0,
                    UNIQUE(user_id, entry_date)
                )
            """)
            c.execute("""
                CREATE INDEX IF NOT EXISTS idx_entries_user
                ON daily_entries(user_id, entry_date DESC)
            """)


def _fetchone(cur):
    if _DATABASE_URL:
        return cur.fetchone()
    return cur.fetchone()


def _fetchall(cur):
    if _DATABASE_URL:
        return cur.fetchall()
    return cur.fetchall()


def _row_to_dict(row, cur=None):
    if row is None:
        return None
    if _DATABASE_URL:
        return dict(row)
    return dict(row)


def _placeholder():
    return "%s" if _DATABASE_URL else "?"


def save_entry(
    user_id: str,
    entry_date: str,
    text_raw: Optional[str] = None,
    audio_path: Optional[str] = None,
    sleep_hours: Optional[float] = None,
    sleep_quality: Optional[float] = None,
    activity_level: Optional[float] = None,
    music_mood_score: Optional[float] = None,
) -> int:
    ph = _placeholder()
    conn = _conn()
    try:
        sql = f"""INSERT INTO daily_entries
               (user_id, entry_date, created_at, text_raw, audio_path,
                sleep_hours, sleep_quality, activity_level, music_mood_score)
               VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
               ON CONFLICT(user_id, entry_date) DO UPDATE SET
                text_raw=excluded.text_raw,
                audio_path=excluded.audio_path,
                sleep_hours=excluded.sleep_hours,
                sleep_quality=excluded.sleep_quality,
                activity_level=excluded.activity_level,
                music_mood_score=excluded.music_mood_score,
                created_at=excluded.created_at"""
        cur = conn.execute(
            sql,
            (
                user_id,
                entry_date,
                datetime.utcnow().isoformat(),
                text_raw,
                audio_path,
                sleep_hours,
                sleep_quality,
                activity_level,
                music_mood_score,
            ),
        )
        if _DATABASE_URL:
            conn.commit()
            return cur.fetchone()[0]
        row_id = cur.lastrowid
        conn.commit()
        return row_id
    finally:
        conn.close()


def update_features(entry_id: int, feature_vector: list, readable_metrics: dict):
    ph = _placeholder()
    conn = _conn()
    try:
        conn.execute(
            f"""UPDATE daily_entries
               SET feature_vector={ph}, readable_metrics={ph}, features_extracted=1
               WHERE id={ph}""",
            (json.dumps(feature_vector), json.dumps(readable_metrics), entry_id),
        )
        conn.commit()
    finally:
        conn.close()


def mark_baselined(user_id: str):
    ph = _placeholder()
    conn = _conn()
    try:
        conn.execute(
            f"UPDATE daily_entries SET baselined=1 WHERE user_id={ph} AND features_extracted=1",
            (user_id,),
        )
        conn.commit()
    finally:
        conn.close()


def get_entry(user_id: str, entry_date: str) -> Optional[dict]:
    ph = _placeholder()
    with _conn() as c:
        cur = c.execute(
            f"SELECT * FROM daily_entries WHERE user_id={ph} AND entry_date={ph}",
            (user_id, entry_date),
        )
        return _row_to_dict(_fetchone(cur))


def get_recent_entries(user_id: str, limit: int = 60) -> list[dict]:
    ph = _placeholder()
    with _conn() as c:
        cur = c.execute(
            f"SELECT * FROM daily_entries WHERE user_id={ph} ORDER BY entry_date DESC LIMIT {ph}",
            (user_id, limit),
        )
        return [_row_to_dict(r) for r in _fetchall(cur)]


def get_entry_count(user_id: str) -> int:
    ph = _placeholder()
    with _conn() as c:
        cur = c.execute(
            f"SELECT COUNT(*) AS cnt FROM daily_entries WHERE user_id={ph} AND features_extracted=1",
            (user_id,),
        )
        row = _fetchone(cur)
        return row["cnt"] if row else 0


def get_all_feature_vectors(user_id: str) -> list[list[float]]:
    ph = _placeholder()
    with _conn() as c:
        cur = c.execute(
            f"SELECT feature_vector FROM daily_entries WHERE user_id={ph} AND features_extracted=1 ORDER BY entry_date ASC",
            (user_id,),
        )
        result = []
        for r in _fetchall(cur):
            if r["feature_vector"]:
                result.append(json.loads(r["feature_vector"]))
        return result


def delete_user(user_id: str):
    ph = _placeholder()
    with _conn() as c:
        c.execute(f"DELETE FROM daily_entries WHERE user_id={ph}", (user_id,))
