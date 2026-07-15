import sqlite3, json, os
from datetime import date, datetime
from pathlib import Path
from typing import Optional

DB_DIR = Path(__file__).parent.parent / "data"
DB_DIR.mkdir(exist_ok=True)
DB_PATH = DB_DIR / "daily_portal.db"


def _conn():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    return conn


def init_db():
    with _conn() as c:
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
    conn = _conn()
    try:
        cur = conn.execute(
            """INSERT INTO daily_entries
               (user_id, entry_date, created_at, text_raw, audio_path,
                sleep_hours, sleep_quality, activity_level, music_mood_score)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(user_id, entry_date) DO UPDATE SET
                text_raw=excluded.text_raw,
                audio_path=excluded.audio_path,
                sleep_hours=excluded.sleep_hours,
                sleep_quality=excluded.sleep_quality,
                activity_level=excluded.activity_level,
                music_mood_score=excluded.music_mood_score,
                created_at=excluded.created_at""",
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
        row_id = cur.lastrowid
        conn.commit()
        return row_id
    finally:
        conn.close()


def update_features(entry_id: int, feature_vector: list, readable_metrics: dict):
    conn = _conn()
    try:
        conn.execute(
            """UPDATE daily_entries
               SET feature_vector=?, readable_metrics=?, features_extracted=1
               WHERE id=?""",
            (json.dumps(feature_vector), json.dumps(readable_metrics), entry_id),
        )
        conn.commit()
    finally:
        conn.close()


def mark_baselined(user_id: str):
    conn = _conn()
    try:
        conn.execute(
            "UPDATE daily_entries SET baselined=1 WHERE user_id=? AND features_extracted=1",
            (user_id,),
        )
        conn.commit()
    finally:
        conn.close()


def get_entry(user_id: str, entry_date: str) -> Optional[dict]:
    with _conn() as c:
        row = c.execute(
            "SELECT * FROM daily_entries WHERE user_id=? AND entry_date=?",
            (user_id, entry_date),
        ).fetchone()
        return dict(row) if row else None


def get_recent_entries(user_id: str, limit: int = 60) -> list[dict]:
    with _conn() as c:
        rows = c.execute(
            "SELECT * FROM daily_entries WHERE user_id=? ORDER BY entry_date DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
        return [dict(r) for r in rows]


def get_entry_count(user_id: str) -> int:
    with _conn() as c:
        row = c.execute(
            "SELECT COUNT(*) AS cnt FROM daily_entries WHERE user_id=? AND features_extracted=1",
            (user_id,),
        ).fetchone()
        return row["cnt"] if row else 0


def get_all_feature_vectors(user_id: str) -> list[list[float]]:
    with _conn() as c:
        rows = c.execute(
            "SELECT feature_vector FROM daily_entries WHERE user_id=? AND features_extracted=1 ORDER BY entry_date ASC",
            (user_id,),
        ).fetchall()
        result = []
        for r in rows:
            if r["feature_vector"]:
                result.append(json.loads(r["feature_vector"]))
        return result


def delete_user(user_id: str):
    with _conn() as c:
        c.execute("DELETE FROM daily_entries WHERE user_id=?", (user_id,))
