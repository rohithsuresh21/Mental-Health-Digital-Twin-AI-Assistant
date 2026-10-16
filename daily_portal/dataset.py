"""Turns a patient's stored daily entries into the chronological dataset the pipeline stages need.

One record per calendar day (the DB is unique per user+date), carrying:
  text            journal + imported chat messages for that day (+ voice transcript)
  timestamp       the real entry date (time = check-in time if submitted that day, else 20:00)
  sleep/activity/mood sliders
  audio_features  the 22 audio dims (11 features + 11 mask) already extracted at submit time,
                  so analysis does not re-run Whisper on every voice note
Also produces a per-stage readiness report for the patient UI.
"""
import json
import re
from datetime import date, datetime, timedelta
from typing import Optional

from . import db

FEATURE_DIM = 466
AUDIO_DIMS = 22                     # last 22 dims of the Stage-1 vector: 11 audio features + 11 mask
STAGE2_MIN = 14                     # stage_2.baseline.UserBaseline.MIN_ENTRIES_TO_FIT
STAGE4_MIN = 10                     # pipeline_runner fits detectors on max(10, 70%) entries
STAGE5_MIN = 5                      # pipeline_runner: < 5 normalized vectors -> no classification
DETECTOR_FORECAST_MIN = 37          # unified_pipeline._generate_detector_forecasts: 30 + 7

_SEPARATOR = re.compile(r"^-{2,}\s*[A-Za-z ]+\s*-{2,}$")


def clean_text(text: Optional[str]) -> str:
    """Collapse a day's text (journal + imports) into one entry: drop legacy '--- Whatsapp ---'
    separator lines and newlines, which would otherwise be split into extra fake entries."""
    if not text:
        return ""
    lines = [l.strip() for l in str(text).splitlines()]
    lines = [l for l in lines if l and not _SEPARATOR.match(l)]
    return re.sub(r"\s+", " ", " ".join(lines)).strip()


def _transcript(readable_json) -> str:
    try:
        r = json.loads(readable_json) if isinstance(readable_json, str) else (readable_json or {})
        return ((r.get("acoustic_profile") or {}).get("transcript") or "").strip()
    except Exception:
        return ""


def entry_timestamp(entry: dict) -> datetime:
    d = date.fromisoformat(entry["entry_date"])
    created = entry.get("created_at")
    try:
        c = datetime.fromisoformat(created) if created else None
    except ValueError:
        c = None
    if c and c.date() == d:
        return c
    return datetime(d.year, d.month, d.day, 20, 0)


def build_user_records(user_id: str, limit: int = 1000) -> list:
    entries = sorted(db.get_recent_entries(user_id, limit=limit), key=lambda e: e["entry_date"])
    records = []
    for e in entries:
        text = clean_text(e.get("text_raw"))
        transcript = _transcript(e.get("readable_metrics"))
        if transcript and transcript.lower() not in text.lower():
            text = f"{text} {transcript}".strip()
        if not text:
            continue
        audio = None
        if e.get("audio_path") and e.get("feature_vector"):
            try:
                vec = json.loads(e["feature_vector"])
                if len(vec) == FEATURE_DIM:
                    audio = vec[-AUDIO_DIMS:]
            except Exception:
                audio = None
        records.append({
            "text": text,
            "timestamp": entry_timestamp(e),
            "entry_date": e["entry_date"],
            "sleep_hours": e.get("sleep_hours"),
            "sleep_quality": e.get("sleep_quality"),
            "activity_level": e.get("activity_level"),
            "music_mood_score": e.get("music_mood_score"),
            "audio_features": audio,
            "sources": sorted(set(filter(None, (e.get("entry_source") or "checkin").split("+")))),
        })
    return records


def _streaks(dates: list) -> tuple:
    if not dates:
        return 0, 0
    ds = sorted({date.fromisoformat(d) for d in dates})
    longest = cur = 1
    for a, b in zip(ds, ds[1:]):
        cur = cur + 1 if (b - a).days == 1 else 1
        longest = max(longest, cur)
    today = date.today()
    current, d = 0, today if today in ds else today - timedelta(days=1)
    s = set(ds)
    while d in s:
        current += 1
        d -= timedelta(days=1)
    return current, longest


def dataset_report(user_id: str, calibrated: bool) -> dict:
    entries = sorted(db.get_recent_entries(user_id, limit=1000), key=lambda e: e["entry_date"])
    records = build_user_records(user_id)
    featured = sum(1 for e in entries if e.get("features_extracted"))
    dates = [e["entry_date"] for e in entries]
    sources = {}
    for e in entries:
        for s in (e.get("entry_source") or "checkin").split("+"):
            sources[s] = sources.get(s, 0) + 1
    health = sum(1 for r in records if any(r[k] is not None for k in ("sleep_hours", "sleep_quality", "activity_level", "music_mood_score")))
    gaps = 0
    if dates:
        span = (date.fromisoformat(dates[-1]) - date.fromisoformat(dates[0])).days + 1
        gaps = span - len(set(dates))
    else:
        span = 0
    current, longest = _streaks(dates)
    n = len(records)

    def stage(key, name, need, have, ok_note, wait_note):
        ready = have >= need
        return {"key": key, "name": name, "ready": ready, "have": have, "need": need,
                "note": ok_note if ready else wait_note.format(left=max(0, need - have))}

    stages = [
        stage("s1", "Feature extraction", 1, featured, "466 features per day extracted",
              "Submit your first check-in"),
        {**stage("s2", "Personal baseline", STAGE2_MIN, featured, "Baseline calibrated to you",
                 "{left} more days to calibrate"), "ready": calibrated or featured >= STAGE2_MIN},
        stage("s4", "Anomaly detection", STAGE4_MIN, n, "4-detector ensemble + CUSUM active",
              "{left} more days of data"),
        stage("s5", "Risk classification", max(STAGE5_MIN, STAGE2_MIN), n, "XGBoost risk model active",
              "{left} more days of data"),
        stage("s3", "7-day forecast", DETECTOR_FORECAST_MIN, n, "Per-detector 7-day forecasts active",
              "{left} more days for detector forecasts"),
    ]
    return {
        "days_logged": len(entries),
        "days_with_features": featured,
        "analysis_records": n,
        "first_date": dates[0] if dates else None,
        "last_date": dates[-1] if dates else None,
        "span_days": span,
        "missing_days": gaps,
        "current_streak": current,
        "longest_streak": longest,
        "days_with_health": health,
        "days_with_voice": sum(1 for e in entries if e.get("audio_path")),
        "sources": sources,
        "stages": stages,
        "can_analyze": calibrated and n >= STAGE2_MIN,
    }
