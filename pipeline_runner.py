import os, json, time, threading
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional
from collections import Counter


W = 64

def _p(*a, **kw):
    kw.setdefault("flush", True)
    print(*a, **kw)

def _hdr(title):
    _p(f"\n{'='*W}")
    _p(f"  {title}")
    _p(f"{'='*W}")

def _sec(title):
    _p(f"\n  [{title}]")

def _ok(msg):
    _p(f"    \u2713 {msg}")

def _info(msg):
    _p(f"      {msg}")

def _warn(msg):
    _p(f"    ! {msg}")

def _fail(msg):
    _p(f"    X {msg}")

def _elapsed(t):
    diff = time.time()-t
    return f"{diff:.2f}s" if diff < 1 else f"{diff:.1f}s"


def _sf(val):
    try:
        return float(val) if str(val).strip() not in ("", "None", "nan", "NaN") else None
    except Exception:
        return None


def _pts(val):
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(str(val).strip(), fmt)
        except Exception:
            pass
    return datetime.now()


def load_any_file(path: str) -> list[dict]:
    suffix = Path(path).suffix.lower()

    if suffix == ".csv":
        import csv
        with open(path, newline="", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        return [{
            "text":             r.get("text", r.get("journal", r.get("entry", r.get("message", "")))).strip(),
            "timestamp":        _pts(r.get("timestamp", r.get("date", ""))),
            "sleep_hours":      _sf(r.get("sleep_hours")),
            "sleep_quality":    _sf(r.get("sleep_quality")),
            "activity_level":   _sf(r.get("activity_level")),
            "music_mood_score": _sf(r.get("music_mood_score")),
        } for r in rows if r.get("text", "").strip()]

    elif suffix == ".json":
        import json as _json
        with open(path, encoding="utf-8") as f:
            data = _json.load(f)
        if isinstance(data, dict):
            data = [data]
        return [{
            "text":             d.get("text", d.get("journal", d.get("entry", ""))).strip(),
            "timestamp":        _pts(d.get("timestamp", d.get("date", ""))),
            "sleep_hours":      _sf(d.get("sleep_hours")),
            "sleep_quality":    _sf(d.get("sleep_quality")),
            "activity_level":   _sf(d.get("activity_level")),
            "music_mood_score": _sf(d.get("music_mood_score")),
        } for d in data if d.get("text", "").strip()]

    elif suffix == ".txt":
        lines = [l.strip() for l in Path(path).read_text(encoding="utf-8", errors="ignore").splitlines() if l.strip()]
        base  = datetime.now() - timedelta(days=len(lines))
        return [{"text": l, "timestamp": base + timedelta(days=i),
                 "sleep_hours": None, "sleep_quality": None,
                 "activity_level": None, "music_mood_score": None}
                for i, l in enumerate(lines)]

    elif suffix == ".pdf":
        try:
            import pdfplumber
        except ImportError:
            raise ImportError("pip install pdfplumber")
        with pdfplumber.open(path) as pdf:
            text = "\n".join(p.extract_text() or "" for p in pdf.pages)
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        base  = datetime.now() - timedelta(days=len(lines))
        return [{"text": l, "timestamp": base + timedelta(days=i),
                 "sleep_hours": None, "sleep_quality": None,
                 "activity_level": None, "music_mood_score": None}
                for i, l in enumerate(lines)]

    elif suffix in (".docx", ".doc"):
        try:
            import docx
        except ImportError:
            raise ImportError("pip install python-docx")
        doc   = docx.Document(path)
        lines = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
        base  = datetime.now() - timedelta(days=len(lines))
        return [{"text": l, "timestamp": base + timedelta(days=i),
                 "sleep_hours": None, "sleep_quality": None,
                 "activity_level": None, "music_mood_score": None}
                for i, l in enumerate(lines)]

    else:
        raise ValueError(f"Unsupported format: {suffix}")


def run_pipeline(user_id: str, file_path: str) -> dict:
    from unified_pipeline import UnifiedJournalPipeline

    t_start = time.time()
    _hdr(f"MENTAL HEALTH DIGITAL TWIN  —  Pipeline Run")
    _p(f"  User:       {user_id}")
    _p(f"  Timestamp:  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    records = load_any_file(file_path)
    records = [r for r in records if r["text"]]
    if len(records) < 3:
        raise ValueError(f"Need at least 3 entries, got {len(records)}")

    suffix = Path(file_path).suffix.lower()
    _p(f"  Source:     {Path(file_path).name} ({suffix})")
    _p(f"  Entries:    {len(records)} journal entries loaded")

    t_load = time.time()
    pipeline = UnifiedJournalPipeline()

    # ── Stage 1 + 2: Feature extraction + Normalization ──
    _sec("Stage 1 + 2 — Feature Extraction & Normalization")
    t_s12 = time.time()
    _p(f"  Extracting text, sentiment, emotion, and audio features...")
    _p(f"  Normalizing against user baseline...")

    prev_ts = None
    sentiment_series, sleep_series, activity_series, music_series = [], [], [], []
    emotions_series, timestamps = [], []
    context_bin_series = []

    for i, rec in enumerate(records, 1):
        result = pipeline.process_entry(
            user_id=user_id,
            text=rec["text"],
            timestamp=rec["timestamp"],
            prev_timestamp=prev_ts,
            sleep_hours=rec["sleep_hours"],
            sleep_quality=rec["sleep_quality"],
            activity_level=rec["activity_level"],
            music_mood_score=rec["music_mood_score"],
        )
        prev_ts = rec["timestamp"]
        m = result["stage_1"]["readable_metrics"]["raw_display_metrics"]
        sentiment_series.append(round(m["sentiment_score"], 4))
        emotions_series.append(m["dominant_emotion"])
        timestamps.append(rec["timestamp"])
        context_bin_series.append(result["stage_2"]["context_bin"])
        if rec["sleep_hours"] is not None:
            sleep_series.append((rec["timestamp"], rec["sleep_hours"]))
        if rec["activity_level"] is not None:
            activity_series.append((rec["timestamp"], rec["activity_level"]))
        if rec["music_mood_score"] is not None:
            music_series.append((rec["timestamp"], rec["music_mood_score"]))

    cal = pipeline.calibration_flags.get(user_id, [])
    cal_count = sum(1 for c in cal if c)
    _ok(f"{len(records)} entries processed — 466 features extracted per entry")
    _ok(f"Normalization: {cal_count}/{len(records)} entries z-scored (baseline {'calibrated' if cal_count > 0 else 'still collecting'})")
    _info(f"Time: {_elapsed(t_s12)}")

    n = len(records)
    emotions_unique = Counter(emotions_series)
    top_emotions = ", ".join(f"{e} ({c})" for e, c in emotions_unique.most_common(5))
    _info(f"Top emotions: {top_emotions}")
    _info(f"Sentiment range: {min(sentiment_series):.3f} to {max(sentiment_series):.3f} (avg {np.mean(sentiment_series):.3f})")

    # ── Stage 3: TFT ──
    _sec("Stage 3 — Temporal Fusion Transformer (Forecasting)")
    t_s3 = time.time()

    if n >= 60:
        num_patches = 20; hidden_size = 64; max_epochs = 10; batch_size = 16
    elif n >= 30:
        num_patches = 20; hidden_size = 48; max_epochs = 7; batch_size = 12
    else:
        num_patches = max(15, min(20, n + 5)); hidden_size = 32; max_epochs = 5; batch_size = 8

    _info(f"Config: {num_patches} patches, hidden={hidden_size}, epochs={max_epochs}, batch={batch_size}")

    checkpoint_path = "tft_checkpoint.ckpt"
    checkpoint_exists = os.path.exists(checkpoint_path)

    if not checkpoint_exists and n < 20:
        _warn(f"No trained TFT checkpoint found yet")
        _info(f"Skipping TFT this run — training in background for next request.")
        tft = None

        def _train_tft_background():
            try:
                pipeline.train_tft_model(
                    num_patches=num_patches,
                    hidden_size=hidden_size,
                    max_epochs=max_epochs,
                    batch_size=batch_size,
                )
                print(f"  [TFT] Background training complete — checkpoint saved.")
            except Exception as e:
                print(f"  [TFT] Background training failed: {e}")

        threading.Thread(target=_train_tft_background, daemon=True).start()
    else:
        try:
            tft = pipeline.train_tft_model(
                num_patches=num_patches,
                hidden_size=hidden_size,
                max_epochs=max_epochs,
                batch_size=batch_size,
            )
            _ok(f"TFT model trained successfully")
            _info(f"Latent shape: {list(tft['latents'].shape)}")
            _info(f"Time: {_elapsed(t_s3)}")
        except Exception as e:
            _warn(f"TFT training failed: {e}")
            _info(f"Continuing without TFT latent features")
            tft = None

    # ── Stage 4: Anomaly Detection + CUSUM ──
    _sec("Stage 4 — Anomaly Detection & CUSUM Monitoring")
    t_s4 = time.time()

    model_dir = Path("calibration/models")
    detectors_file = model_dir / "stage4_detectors.pkl"
    threshold_file = model_dir / "stage4_threshold_engine.pkl"

    all_vecs = pipeline.get_batch_consistent_vectors(user_id)
    n_total = len(all_vecs)

    if detectors_file.exists() and threshold_file.exists():
        import pickle
        with open(detectors_file, "rb") as f:
            pipeline.detectors = pickle.load(f)
        with open(threshold_file, "rb") as f:
            pipeline.threshold_engine = pickle.load(f)
        _info("Loaded pretrained anomaly detectors")
    else:
        n_train = max(10, int(n_total * 0.7))
        train_vecs = all_vecs[:n_train]
        X_train = np.array(train_vecs)
        _info(f"Training fresh detectors on {n_train} vectors...")

        from stage_4.anomaly_pipeline import MultiDetectorPipeline
        pipeline.anomaly_detector = MultiDetectorPipeline()
        pipeline.anomaly_detector.fit(X_train)

        import pickle as _pkl
        detector_path = os.path.join(pipeline.output_dir, "anomaly_detector.pkl")
        pipeline.anomaly_detector.save(detector_path)
        _info("Detectors trained and saved")

    _p(f"  Running 4-detector consensus on {n_total} entries...")
    anomaly_results = []
    for vec in all_vecs:
        anomaly_results.append(pipeline.detect_anomalies(vec))

    pipeline.anomaly_scores[user_id] = anomaly_results

    cusum_results = pipeline.fit_and_run_cusum(user_id)
    cusum_threshold = round(float(pipeline.cusum_detectors[user_id].h), 4)

    avg_risk = np.mean([a["overall_risk_score"] for a in anomaly_results])
    max_risk = max(a["overall_risk_score"] for a in anomaly_results)
    n_anomalies = sum(1 for a in anomaly_results if a.get("is_anomaly"))
    if isinstance(n_anomalies, (list, np.ndarray)):
        n_anomalies = sum(1 for a in anomaly_results if any(a.get("is_anomaly", [])))
    n_cusum_alerts = sum(1 for c in cusum_results if c["cusum_alert_upper"] or c["cusum_alert_lower"])

    _ok(f"Anomaly detection complete: avg risk {avg_risk:.3f}, max {max_risk:.3f}")
    _ok(f"Anomalies flagged: {n_anomalies}/{n_total} entries")
    _ok(f"CUSUM threshold: {cusum_threshold}, alerts triggered: {n_cusum_alerts}/{n_total}")
    _info(f"Detectors: Mahalanobis, Copula, Isolation Forest, KNN")
    _info(f"Time: {_elapsed(t_s4)}")

    # ── Stage 5: Risk Classification ──
    _sec("Stage 5 — Risk Classification (XGBoost)")
    t_s5 = time.time()

    xgb = pipeline.train_xgboost_classifier()

    vecs      = pipeline.normalized_vectors[user_id]
    anomalies = pipeline.anomaly_scores.get(user_id, [])
    if len(vecs) < 5:
        prediction = {
            "probability": 0.0, "probability_raw": 0.0,
            "risk_level": "LOW", "intervention_recommended": False,
            "prediction": 0, "note": "insufficient entries for reliable classification"
        }
        _warn(f"Not enough entries ({len(vecs)}) for classification — defaulting to LOW")
    else:
        features = pipeline.assemble_stage5_features(vecs, anomalies)
        prediction = pipeline.predict_classification(features)
        prob_pct = prediction['probability'] * 100
        risk = prediction['risk_level']
        intervention = "Yes" if prediction['intervention_recommended'] else "No"
        _ok(f"Risk assessment: {risk} ({prob_pct:.1f}%)")
        _info(f"Intervention recommended: {intervention}")
        _info(f"Raw probability: {prediction['probability_raw']:.4f} → Calibrated: {prediction['probability']:.4f}")

    if xgb["auroc"] is not None and xgb["auroc"] == xgb["auroc"]:
        _info(f"Model AUROC: {xgb['auroc']:.4f}")
    _info(f"Time: {_elapsed(t_s5)}")

    # ── Baseline Summary ──
    _sec("Baseline & Context Summary")
    ub = pipeline.user_baselines[user_id]
    calibration_status = ub.calibration_status()
    cutoff = ub.min_entries_to_fit - 1

    deviation_series = []
    for i, vec in enumerate(vecs):
        if i < cutoff:
            deviation_series.append(None)
        else:
            text_part = vec[ub.TEXT_START:ub.TEXT_END]
            audio_part = vec[ub.AUDIO_START:ub.AUDIO_END]
            deviation = float(np.mean(np.abs(np.concatenate([text_part, audio_part]))))
            deviation_series.append(round(deviation, 4))

    valid_deviation = [v for v in deviation_series if v is not None]
    if len(valid_deviation) >= 6:
        k = max(3, len(valid_deviation) // 3)
        early_avg = float(np.mean(valid_deviation[:k]))
        late_avg = float(np.mean(valid_deviation[-k:]))
        diff = late_avg - early_avg
        if diff > 0.15:
            baseline_trend = "moving_away"
        elif diff < -0.15:
            baseline_trend = "returning_to_normal"
        else:
            baseline_trend = "stable"
    else:
        baseline_trend = "insufficient_data"

    trend_labels = {
        "stable": "Stable — staying within baseline",
        "moving_away": "Drifting away from baseline",
        "returning_to_normal": "Returning toward normal",
        "insufficient_data": "Insufficient data — still calibrating",
    }
    _info(f"Calibration: {calibration_status['calibration_progress']}")
    _info(f"Baseline trend: {trend_labels.get(baseline_trend, baseline_trend)}")

    bin_labels = {
        "Morning_Weekday": "Morning (Weekday)", "Afternoon_Weekday": "Afternoon (Weekday)",
        "Evening_Weekday": "Evening (Weekday)", "Morning_Weekend": "Morning (Weekend)",
        "Afternoon_Weekend": "Afternoon (Weekend)", "Evening_Weekend": "Evening (Weekend)",
    }
    bin_counts_raw = Counter(context_bin_series)
    context_bin_counts = {bin_labels.get(k, k): bin_counts_raw.get(k, 0) for k in bin_labels}
    active_bins = {k: v for k, v in context_bin_counts.items() if v > 0}
    if active_bins:
        _info(f"Temporal context: {', '.join(f'{k}: {v}' for k, v in active_bins.items())}")

    # ── Final Summary ──
    t_total = time.time() - t_start
    _p(f"\n{'-'*W}")
    _p(f"  Pipeline complete in {_elapsed(t_start)}")
    _p(f"  Entries analyzed:  {len(records)}")
    _p(f"  Risk level:        {prediction['risk_level']} ({prediction['probability']*100:.1f}%)")
    _p(f"  Anomalies:         {n_anomalies}/{n_total} entries flagged")
    _p(f"  CUSUM alerts:      {n_cusum_alerts}/{n_total}")
    if tft:
        _p(f"  TFT latent shape:  {list(tft['latents'].shape)}")
    _p(f"{'-'*W}\n")

    return {
        "user_id":             user_id,
        "n_entries":           len(records),
        "timestamps":          [t.strftime("%Y-%m-%d") for t in timestamps],
        "sentiment_series":    sentiment_series,
        "emotions_series":     emotions_series,
        "sleep_series":        [(t.strftime("%Y-%m-%d"), v) for t, v in sleep_series],
        "activity_series":     [(t.strftime("%Y-%m-%d"), v) for t, v in activity_series],
        "music_series":        [(t.strftime("%Y-%m-%d"), v) for t, v in music_series],
        "anomaly_scores":      [round(a["overall_risk_score"], 4) for a in anomaly_results],
        "detector_scores":     [a["detector_scores"] for a in anomaly_results],
        "cusum_upper":         [round(float(c["cusum_upper"]), 4) for c in cusum_results],
        "cusum_lower":         [round(float(c["cusum_lower"]), 4) for c in cusum_results],
        "cusum_alert_upper":   [bool(c["cusum_alert_upper"]) for c in cusum_results],
        "cusum_alert_lower":   [bool(c["cusum_alert_lower"]) for c in cusum_results],
        "cusum_threshold":     cusum_threshold,
        "persistent_anomaly_flags": [bool(a.get("is_persistent_anomaly", False)) for a in anomaly_results],
        "prediction":          prediction,
        "tft_latent_shape":    list(tft["latents"].shape) if tft is not None else None,
        "tft_forecast_14day":  pipeline.tft_forecast if hasattr(pipeline, 'tft_forecast') and pipeline.tft_forecast else None,
        "xgb_auroc":           round(xgb["auroc"], 4) if xgb["auroc"] is not None and xgb["auroc"] == xgb["auroc"] else 0.0,
        "calibration_status":  calibration_status,
        "baseline_deviation_series": deviation_series,
        "baseline_trend":      baseline_trend,
        "context_bin_counts":  context_bin_counts,
    }
