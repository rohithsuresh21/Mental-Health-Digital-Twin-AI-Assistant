import os, json, pickle, traceback
from pathlib import Path
from datetime import date, datetime

import numpy as np
from flask import Blueprint, request, jsonify, session
from werkzeug.utils import secure_filename

from . import db
from Stage_1.Extract_features import extract_features
from stage_2.baseline import UserBaseline

daily = Blueprint("daily", __name__)

DATA_DIR = Path(__file__).parent.parent / "data"
AUDIO_DIR = DATA_DIR / "audio"
SCALER_DIR = DATA_DIR / "scalers"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)
SCALER_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_AUDIO = {".wav"}
MAX_TEXT_SIZE = 100_000  # characters

# Per-user rate limit for daily submissions: 20 per hour
_submit_rate_store = {}

def _check_submit_rate(user_id):
    import time
    now = time.time()
    key = f"submit:{user_id}"
    _submit_rate_store.setdefault(key, [])
    _submit_rate_store[key] = [t for t in _submit_rate_store[key] if now - t < 3600]
    if len(_submit_rate_store[key]) >= 20:
        return False
    _submit_rate_store[key].append(now)
    return True


def _check_user_access(requested_user_id):
    """Validate session has access to the requested user_id."""
    session_user = session.get("user_id", "")
    session_role = session.get("role", "")
    if session_role == "admin":
        return True
    if not session_user:
        return False
    return session_user == requested_user_id


def _scaler_path(user_id: str) -> Path:
    return SCALER_DIR / f"{user_id}_baseline.pkl"


def _load_scaler(user_id: str):
    path = _scaler_path(user_id)
    if path.exists():
        with open(path, "rb") as f:
            return pickle.load(f)
    return None


def _save_scaler(user_id: str, baseline: UserBaseline):
    path = _scaler_path(user_id)
    with open(path, "wb") as f:
        pickle.dump(baseline, f)


def _user_entry_count(user_id: str) -> int:
    return db.get_entry_count(user_id)


def _check_calibrated(user_id: str) -> bool:
    return _scaler_path(user_id).exists()


@daily.route("/daily/submit", methods=["POST"])
def submit():
    try:
        user_id = request.form.get("user_id", "").strip()
        if not user_id:
            return jsonify({"error": "user_id is required"}), 400

        if not _check_user_access(user_id):
            return jsonify({"error": "Access denied"}), 403

        if not _check_submit_rate(user_id):
            return jsonify({"error": "Rate limit exceeded. Max 3 submissions per hour."}), 429

        today_str = date.today().isoformat()

        existing = db.get_entry(user_id, today_str)
        if existing and existing["features_extracted"]:
            return jsonify({"error": "Already submitted today", "entry": existing}), 409

        text_raw = request.form.get("text", "").strip()
        audio_file = request.files.get("audio")

        if not text_raw and not audio_file:
            return jsonify({"error": "Provide text or audio"}), 400

        if len(text_raw) > MAX_TEXT_SIZE:
            return jsonify({"error": f"Text exceeds {MAX_TEXT_SIZE} characters"}), 400

        audio_path = None
        if audio_file and audio_file.filename:
            ext = Path(audio_file.filename).suffix.lower()
            if ext not in ALLOWED_AUDIO:
                return jsonify({"error": f"Audio must be WAV, got {ext}"}), 400
            audio_dir = AUDIO_DIR / user_id
            audio_dir.mkdir(parents=True, exist_ok=True)
            safe_name = f"{today_str}_{secure_filename(audio_file.filename)}"
            audio_path = str(audio_dir / safe_name)
            audio_file.save(audio_path)

        sleep_hours = _float_or(request.form.get("sleep_hours"))
        sleep_quality = _float_or(request.form.get("sleep_quality"))
        activity_level = _float_or(request.form.get("activity_level"))
        music_mood_score = _float_or(request.form.get("music_mood_score"))

        entry_id = db.save_entry(
            user_id=user_id,
            entry_date=today_str,
            text_raw=text_raw,
            audio_path=audio_path,
            sleep_hours=sleep_hours,
            sleep_quality=sleep_quality,
            activity_level=activity_level,
            music_mood_score=music_mood_score,
        )

        feature_vec, readable_metrics = extract_features(
            text=text_raw or "",
            timestamp=datetime.now(),
            audio_path=audio_path,
            sleep_hours=sleep_hours,
            sleep_quality=sleep_quality,
            activity_level=activity_level,
            music_mood_score=music_mood_score,
        )

        db.update_features(entry_id, feature_vec.tolist(), readable_metrics)

        count = _user_entry_count(user_id)
        min_for_calib = UserBaseline.MIN_ENTRIES_TO_FIT

        if count >= min_for_calib and not _check_calibrated(user_id):
            _train_baseline(user_id)

        return jsonify({
            "entry_id": entry_id,
            "entry_date": today_str,
            "feature_vector_shape": list(feature_vec.shape),
            "calibration_progress": f"{count}/{min_for_calib}",
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
                "has_text": bool(e["text_raw"]),
                "has_audio": bool(e["audio_path"]),
                "sleep_hours": e["sleep_hours"],
                "sleep_quality": e["sleep_quality"],
                "activity_level": e["activity_level"],
                "music_mood_score": e["music_mood_score"],
                "features_extracted": bool(e["features_extracted"]),
                "baselined": bool(e["baselined"]),
            })

        return jsonify({
            "user_id": user_id,
            "entry_count": count,
            "entries_needed": min_for_calib,
            "calibrated": calibrated,
            "calibration_progress": f"{min(count, min_for_calib)}/{min_for_calib}",
            "progress_pct": min(100, int(count / min_for_calib * 100)) if min_for_calib else 0,
            "history": history,
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

        count = _user_entry_count(user_id)
        if count < UserBaseline.MIN_ENTRIES_TO_FIT:
            return jsonify({
                "error": f"Need {UserBaseline.MIN_ENTRIES_TO_FIT} entries, got {count}",
                "entry_count": count,
                "entries_needed": UserBaseline.MIN_ENTRIES_TO_FIT,
            }), 400

        _train_baseline(user_id)

        return jsonify({
            "user_id": user_id,
            "calibrated": True,
            "entries_used": count,
        })

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
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None
