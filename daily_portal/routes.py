import os, json, pickle, traceback, io, time
from pathlib import Path
from datetime import date, datetime, timezone
import numpy as np
from flask import Blueprint, request, jsonify, session
from werkzeug.utils import secure_filename
from . import db
from .dataset import build_user_records, dataset_report, clean_text, entry_timestamp, AUDIO_DIMS, FEATURE_DIM
from Stage_1.Extract_features import extract_features
from stage_2.baseline import UserBaseline
from data_parser import parse_whatsapp, parse_reddit, parse_telegram
from data_parser.whatsapp_parser import sender_matches
daily = Blueprint("daily", __name__)
DATA_DIR = Path(__file__).parent.parent / "data"
AUDIO_DIR = DATA_DIR / "audio"
SCALER_DIR = DATA_DIR / "scalers"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)
SCALER_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_AUDIO = {".wav"}
MAX_TEXT_SIZE = 100_000
SUBMIT_LIMIT_PER_HOUR = int(os.environ.get("MHDT_SUBMIT_LIMIT", "60"))
_submit_rate_store = {}


def _check_submit_rate(user_id):
    now = time.time()
    key = f"submit:{user_id}"
    _submit_rate_store.setdefault(key, [])
    _submit_rate_store[key] = [t for t in _submit_rate_store[key] if now - t < 3600]
    if len(_submit_rate_store[key]) >= SUBMIT_LIMIT_PER_HOUR:
        return False
    _submit_rate_store[key].append(now)
    return True


def _check_user_access(requested_user_id):
    session_user = session.get("user_id", "")
    session_role = session.get("role", "")
    if session_role == "admin":
        return True
    if not session_user:
        return False
    return session_user == requested_user_id


def _scaler_path(user_id: str) -> Path:
    return SCALER_DIR / f"{secure_filename(user_id) or 'user'}_baseline.pkl"


def _load_scaler(user_id: str):
    path = _scaler_path(user_id)
    if path.exists():
        with open(path, "rb") as f:
            return pickle.load(f)
    return None


def _save_scaler(user_id: str, baseline: UserBaseline):
    with open(_scaler_path(user_id), "wb") as f:
        pickle.dump(baseline, f)


def _user_entry_count(user_id: str) -> int:
    return db.get_entry_count(user_id)


def _check_calibrated(user_id: str) -> bool:
    return _scaler_path(user_id).exists()


def _sources(existing_source, new_source):
    tags = set(filter(None, (existing_source or "").split("+"))) | {new_source}
    return "+".join(sorted(tags))


def _valid_date(s: str):
    try:
        d = date.fromisoformat(s)
    except (TypeError, ValueError):
        return None
    return d if d <= date.today() else None


def _prev_timestamp(user_id: str, entry_date: str):
    prev = [e for e in db.get_recent_entries(user_id, limit=1000) if e["entry_date"] < entry_date]
    return entry_timestamp(max(prev, key=lambda e: e["entry_date"])) if prev else None


def _extract_and_store(user_id: str, entry_date: str):
    """(Re)compute the 466-dim Stage-1 vector for one day from everything stored for it:
    journal + imported chat text, voice note, sliders, real date and gap since the previous day."""
    e = db.get_entry(user_id, entry_date)
    if not e:
        return None, None
    text = clean_text(e.get("text_raw"))
    precomputed = None
    audio_path = e.get("audio_path") or None
    if audio_path and e.get("feature_vector"):           # reuse audio dims; don't re-run Whisper
        try:
            vec = json.loads(e["feature_vector"])
            if len(vec) == FEATURE_DIM and any(vec[-AUDIO_DIMS // 2:]):
                precomputed = vec[-AUDIO_DIMS:]
        except Exception:
            precomputed = None
    if audio_path and not os.path.exists(audio_path):
        audio_path = None
    old_readable = {}
    try:
        old_readable = json.loads(e["readable_metrics"]) if e.get("readable_metrics") else {}
    except Exception:
        pass
    transcript = ((old_readable.get("acoustic_profile") or {}).get("transcript") or "").strip()
    if transcript and transcript.lower() not in text.lower():
        text = f"{text} {transcript}".strip()
    feature_vec, readable = extract_features(
        text=text or "",
        timestamp=entry_timestamp(e),
        prev_timestamp=_prev_timestamp(user_id, entry_date),
        audio_path=None if precomputed else audio_path,
        precomputed_audio=precomputed,
        sleep_hours=e.get("sleep_hours"),
        sleep_quality=e.get("sleep_quality"),
        activity_level=e.get("activity_level"),
        music_mood_score=e.get("music_mood_score"),
    )
    if precomputed and old_readable.get("acoustic_profile"):
        readable["acoustic_profile"] = old_readable["acoustic_profile"]
    db.update_features(e["id"], feature_vec.tolist(), readable)
    return feature_vec, readable


def _refresh_baseline(user_id: str):
    """Fit (or refit) the personal baseline once there are enough featured days."""
    if _user_entry_count(user_id) >= UserBaseline.MIN_ENTRIES_TO_FIT:
        _train_baseline(user_id)


@daily.route("/daily/submit", methods=["POST"])
def submit():
    try:
        user_id = request.form.get("user_id", "").strip()
        if not user_id:
            return jsonify({"error": "user_id is required"}), 400
        if not _check_user_access(user_id):
            return jsonify({"error": "Access denied"}), 403
        if not _check_submit_rate(user_id):
            return jsonify({"error": f"Too many submissions. Max {SUBMIT_LIMIT_PER_HOUR} per hour."}), 429
        raw_date = request.form.get("entry_date", "").strip()
        d = _valid_date(raw_date) if raw_date else date.today()
        if d is None:
            return jsonify({"error": "entry_date must be YYYY-MM-DD and not in the future"}), 400
        today_str = d.isoformat()
        existing = db.get_entry(user_id, today_str)
        if existing and "checkin" in (existing.get("entry_source") or "").split("+"):
            return jsonify({"error": f"You already checked in for {today_str}", "entry_date": today_str}), 409
        text_raw = request.form.get("text", "").strip()
        if not text_raw and request.files.get("text"):
            text_raw = request.files["text"].read().decode("utf-8", errors="ignore").strip()
        audio_file = request.files.get("audio")
        if not text_raw and not (audio_file and audio_file.filename):
            return jsonify({"error": "Write a few words about your day or attach a voice note"}), 400
        if len(text_raw) > MAX_TEXT_SIZE:
            return jsonify({"error": f"Text exceeds {MAX_TEXT_SIZE} characters"}), 400
        audio_path = existing.get("audio_path") if existing else None
        if audio_file and audio_file.filename:
            ext = Path(audio_file.filename).suffix.lower()
            if ext not in ALLOWED_AUDIO:
                return jsonify({"error": f"Audio must be WAV, got {ext}"}), 400
            audio_dir = AUDIO_DIR / secure_filename(user_id)
            audio_dir.mkdir(parents=True, exist_ok=True)
            audio_path = str(audio_dir / f"{today_str}_{secure_filename(audio_file.filename)}")
            audio_file.save(audio_path)
        # keep chat messages already imported for this day, add the journal on top
        old_text = clean_text(existing.get("text_raw")) if existing else ""
        merged_text = " ".join(t for t in (text_raw, old_text) if t)
        sleep_hours = _float_or(request.form.get("sleep_hours"))
        sleep_quality = _float_or(request.form.get("sleep_quality"))
        activity_level = _float_or(request.form.get("activity_level"))
        music_mood_score = _float_or(request.form.get("music_mood_score"))
        entry_id = db.save_entry(
            user_id=user_id,
            entry_date=today_str,
            text_raw=merged_text,
            audio_path=audio_path,
            sleep_hours=sleep_hours,
            sleep_quality=sleep_quality,
            activity_level=activity_level,
            music_mood_score=music_mood_score,
            entry_source=_sources(existing.get("entry_source") if existing else "", "checkin"),
        )
        try:
            feature_vec, readable = _extract_and_store(user_id, today_str)
        except ValueError as ve:
            if existing:
                db.save_entry(user_id=user_id, entry_date=today_str, text_raw=existing.get("text_raw"),
                              audio_path=existing.get("audio_path"), sleep_hours=existing.get("sleep_hours"),
                              sleep_quality=existing.get("sleep_quality"), activity_level=existing.get("activity_level"),
                              music_mood_score=existing.get("music_mood_score"), entry_source=existing.get("entry_source"))
            else:
                db.delete_entry(user_id, today_str)
            return jsonify({"error": str(ve)}), 400
        transcript = ((readable or {}).get("acoustic_profile") or {}).get("transcript")
        if not merged_text and transcript:
            # voice-only check-in: the transcript becomes the day's text so text features aren't blank
            cur = db.get_entry(user_id, today_str)
            db.update_entry_text(user_id, today_str, transcript.strip(), entry_source=_sources(cur.get("entry_source"), "voice"))
            feature_vec, readable = _extract_and_store(user_id, today_str)
        _refresh_baseline(user_id)
        count = _user_entry_count(user_id)
        min_for_calib = UserBaseline.MIN_ENTRIES_TO_FIT
        return jsonify({
            "entry_id": entry_id,
            "entry_date": today_str,
            "feature_vector_shape": list(feature_vec.shape),
            "transcript": transcript,
            "calibration_progress": f"{min(count, min_for_calib)}/{min_for_calib}",
            "entry_count": count,
            "calibrated": _check_calibrated(user_id),
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@daily.route("/daily/status", methods=["GET"])
def status():
    try:
        user_id = request.args.get("user_id", "").strip()
        if not user_id:
            return jsonify({"error": "user_id is required"}), 400
        if not _check_user_access(user_id):
            return jsonify({"error": "Access denied"}), 403
        entries = db.get_recent_entries(user_id, limit=60)
        count = db.get_entry_count(user_id)
        min_for_calib = UserBaseline.MIN_ENTRIES_TO_FIT
        calibrated = _check_calibrated(user_id)
        history = []
        for e in entries:
            history.append({
                "id": e["id"],
                "entry_date": e["entry_date"],
                "has_text": bool(clean_text(e["text_raw"])),
                "has_audio": bool(e["audio_path"]),
                "sleep_hours": e["sleep_hours"],
                "sleep_quality": e["sleep_quality"],
                "activity_level": e["activity_level"],
                "music_mood_score": e["music_mood_score"],
                "features_extracted": bool(e["features_extracted"]),
                "baselined": bool(e["baselined"]),
                "sources": sorted(set(filter(None, (e.get("entry_source") or "checkin").split("+")))),
            })
        return jsonify({
            "user_id": user_id,
            "entry_count": count,
            "entries_needed": min_for_calib,
            "calibrated": calibrated,
            "calibration_progress": f"{min(count, min_for_calib)}/{min_for_calib}",
            "progress_pct": min(100, int(count / min_for_calib * 100)) if min_for_calib else 0,
            "history": history,
            "dataset": dataset_report(user_id, calibrated),
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@daily.route("/daily/dataset", methods=["GET"])
def dataset():
    """What the pipeline will actually receive for this patient (one row per day)."""
    try:
        user_id = request.args.get("user_id", "").strip()
        if not user_id or not _check_user_access(user_id):
            return jsonify({"error": "Access denied"}), 403
        records = build_user_records(user_id)
        return jsonify({
            "report": dataset_report(user_id, _check_calibrated(user_id)),
            "records": [{
                "date": r["entry_date"],
                "time": r["timestamp"].strftime("%H:%M"),
                "sources": r["sources"],
                "words": len(r["text"].split()),
                "preview": r["text"][:120],
                "sleep_hours": r["sleep_hours"], "sleep_quality": r["sleep_quality"],
                "activity_level": r["activity_level"], "music_mood_score": r["music_mood_score"],
                "voice": r["audio_features"] is not None,
            } for r in records],
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@daily.route("/daily/calibrate", methods=["POST"])
def calibrate():
    try:
        body = request.get_json(force=True)
        user_id = body.get("user_id", "").strip()
        if not user_id:
            return jsonify({"error": "user_id is required"}), 400
        if not _check_user_access(user_id):
            return jsonify({"error": "Access denied"}), 403
        count = _user_entry_count(user_id)
        if count < UserBaseline.MIN_ENTRIES_TO_FIT:
            return jsonify({
                "error": f"Need {UserBaseline.MIN_ENTRIES_TO_FIT} entries, got {count}",
                "entry_count": count,
                "entries_needed": UserBaseline.MIN_ENTRIES_TO_FIT,
            }), 400
        _train_baseline(user_id)
        return jsonify({"user_id": user_id, "calibrated": True, "entries_used": count})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@daily.route("/daily/delete", methods=["POST"])
def delete_user():
    try:
        body = request.get_json(force=True)
        user_id = body.get("user_id", "").strip()
        if not user_id:
            return jsonify({"error": "user_id is required"}), 400
        if not _check_user_access(user_id):
            return jsonify({"error": "Access denied"}), 403
        db.delete_user(user_id)
        scaler_path = _scaler_path(user_id)
        if scaler_path.exists():
            scaler_path.unlink()
        return jsonify({"deleted": True, "user_id": user_id})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@daily.route("/daily/import-chat", methods=["POST"])
def import_chat():
    try:
        user_id = request.form.get("user_id", "").strip()
        name = request.form.get("name", "").strip()
        platform = request.form.get("platform", "").strip().lower()
        sub_type = request.form.get("sub_type", "text").strip().lower()
        if not user_id or not name:
            return jsonify({"error": "user_id and name are required"}), 400
        if not _check_user_access(user_id):
            return jsonify({"error": "Access denied"}), 403
        if platform not in ("whatsapp", "telegram", "reddit"):
            return jsonify({"error": "Invalid platform"}), 400
        upload = request.files.get("file")
        if not upload or not upload.filename:
            return jsonify({"error": "No file uploaded"}), 400
        raw_bytes = upload.read()
        if platform == "whatsapp":
            all_msgs = parse_whatsapp(io.BytesIO(raw_bytes))
        elif platform == "telegram":
            all_msgs = parse_telegram(io.BytesIO(raw_bytes))
        else:
            if sub_type == "text":
                text = raw_bytes.decode("utf-8", errors="ignore").strip()
                all_msgs = [{"timestamp": datetime.now(), "text": text, "sender": name}] if text else []
            else:
                obj = io.BytesIO(raw_bytes)
                all_msgs = parse_reddit(obj if sub_type == "posts" else None, obj if sub_type == "comments" else None)
        senders = {}
        for m in all_msgs:
            senders[m["sender"]] = senders.get(m["sender"], 0) + 1
        if platform == "reddit":
            messages = all_msgs                      # a Reddit export only contains your own posts/comments
        else:
            messages = [m for m in all_msgs if sender_matches(m["sender"], name)]
        if not all_msgs:
            return jsonify({"error": f"No messages could be read from this {platform} file. "
                                     f"Check that it is an unmodified export.", "entries": [], "senders": []}), 400
        user_dates = {e["entry_date"] for e in db.get_recent_entries(user_id, limit=1000)}
        today = date.today()
        entries, matched_count = [], 0
        for m in messages:
            ts = m["timestamp"]
            if ts.tzinfo is not None:
                ts = ts.astimezone().replace(tzinfo=None)   # local calendar day
            if ts.date() > today:
                continue
            d = ts.strftime("%Y-%m-%d")
            matched = d in user_dates
            matched_count += matched
            entries.append({"date": d, "platform": platform, "message": m["text"], "sender": m["sender"],
                            "matched": matched, "selected": True})
        return jsonify({
            "entries": entries,
            "total": len(entries),
            "matched_count": matched_count,
            "new_days": len({e["date"] for e in entries if not e["matched"]}),
            "senders": sorted(({"name": k, "count": v} for k, v in senders.items()), key=lambda x: -x["count"]),
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@daily.route("/daily/confirm-import", methods=["POST"])
def confirm_import():
    """Merge imported messages into one entry per day, then (re)extract that day's features so
    imports count toward calibration and reach every pipeline stage."""
    try:
        body = request.get_json(force=True)
        user_id = body.get("user_id", "").strip()
        entries = body.get("entries", [])
        if not user_id:
            return jsonify({"error": "user_id is required"}), 400
        if not _check_user_access(user_id):
            return jsonify({"error": "Access denied"}), 403
        if not entries:
            return jsonify({"error": "No entries provided"}), 400
        by_day = {}
        for e in entries:
            d, text = e.get("date", ""), clean_text(e.get("message", ""))
            if not _valid_date(d) or not text:
                continue
            by_day.setdefault(d, {"texts": [], "platforms": set()})
            by_day[d]["texts"].append(text)
            by_day[d]["platforms"].add(e.get("platform", "chat"))
        imported, new_days, skipped = 0, 0, 0
        for d in sorted(by_day):
            existing = db.get_entry(user_id, d)
            old_text = clean_text(existing.get("text_raw")) if existing else ""
            add = [t for t in by_day[d]["texts"] if t.lower() not in old_text.lower()]
            if not add:
                skipped += len(by_day[d]["texts"])
                continue
            new_text = " ".join([old_text] + add).strip()
            source = existing.get("entry_source") if existing else ""
            for p in by_day[d]["platforms"]:
                source = _sources(source, p)
            if existing:
                db.update_entry_text(user_id, d, new_text, entry_source=source)
            else:
                db.save_entry(user_id=user_id, entry_date=d, text_raw=new_text, entry_source=source)
                new_days += 1
            _extract_and_store(user_id, d)
            imported += len(add)
        _refresh_baseline(user_id)
        count = _user_entry_count(user_id)
        return jsonify({"imported": imported, "days_updated": len(by_day), "new_days": new_days,
                        "duplicates_skipped": skipped, "entry_count": count,
                        "calibrated": _check_calibrated(user_id)})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


def _train_baseline(user_id: str):
    vectors = db.get_all_feature_vectors(user_id)
    if len(vectors) < UserBaseline.MIN_ENTRIES_TO_FIT:
        return
    baseline = UserBaseline(user_id=user_id)
    for v in vectors:
        baseline.add_entry(np.array(v, dtype=np.float32))
    _save_scaler(user_id, baseline)
    db.mark_baselined(user_id)


def _float_or(val):
    if val is None or val == "":
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None
