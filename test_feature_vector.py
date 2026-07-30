"""
Test script: Validates all 466 feature vector dimensions are properly filled.

Usage (standalone):
    python test_feature_vector.py --text <file> --audio <file> --user <user_id>

Usage (pipeline — tests actual admin portal output):
    python test_feature_vector.py --pipeline http://127.0.0.1:5000 --user <user_id>

Output:
    - CSV report: feature_test_<timestamp>.csv
    - Temp files are cleaned up on PASS.
"""

import argparse
import csv
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

import numpy as np

# ── Vector layout ──────────────────────────────────────────────────────────
SECTIONS = [
    ("SBERT Embedding",       0,   384,  False),
    ("Emotion (28-class)",    384,  412,  False),
    ("VADER Sentiment",       412,  419,  False),
    ("Lexical Diversity",     419,  421,  False),
    ("Readability",           421,  424,  False),
    ("First Person Pronouns", 424,  426,  True),
    ("Length Features",       426,  429,  False),
    ("Punctuation Features",  429,  433,  True),
    ("Metadata (time)",       433,  436,  True),
    ("Health Values",         436,  440,  True),
    ("Health Masks",          440,  444,  True),
    ("Audio Feature Values",  444,  455,  True),
    ("Audio Feature Masks",   455,  466,  True),
]


def validate_vector(vec: np.ndarray, audio_provided: bool, health_provided: bool):
    results = []
    all_pass = True

    for name, start, end, is_optional in SECTIONS:
        dims = end - start
        chunk = vec[start:end]

        nan_count = int(np.isnan(chunk).sum())
        inf_count = int(np.isinf(chunk).sum())
        zero_count = int((chunk == 0).sum())

        errors = []
        if nan_count > 0:
            errors.append(f"{nan_count} NaN")
        if inf_count > 0:
            errors.append(f"{inf_count} Inf")

        # Determine expected fill status
        section_pass = True
        if is_optional:
            # Health masks: 1.0 if provided, 0.0 if not
            if name.startswith("Health Masks"):
                expected_ones = dims if health_provided else 0
                actual_ones = int((chunk == 1.0).sum())
                if health_provided and actual_ones < expected_ones:
                    errors.append(f"Expected {expected_ones} ones, got {actual_ones}")
                    section_pass = False
                elif not health_provided and actual_ones > 0:
                    errors.append(f"Expected 0 ones (no health data), got {actual_ones}")
                    section_pass = False
            # Audio values: non-zero if audio provided, all zero if not
            elif name.startswith("Audio Feature Values"):
                if audio_provided and zero_count == dims:
                    errors.append("All zeros but audio was provided")
                    section_pass = False
                elif not audio_provided and zero_count < dims:
                    errors.append(f"Non-zero values ({dims - zero_count}) but no audio provided")
                    section_pass = False
            # Audio masks: 1.0 if audio provided, 0.0 if not
            elif name.startswith("Audio Feature Masks"):
                expected_ones = dims if audio_provided else 0
                actual_ones = int((chunk == 1.0).sum())
                if audio_provided and actual_ones < expected_ones:
                    errors.append(f"Expected {expected_ones} ones, got {actual_ones}")
                    section_pass = False
                elif not audio_provided and actual_ones > 0:
                    errors.append(f"Expected 0 ones (no audio), got {actual_ones}")
                    section_pass = False
        else:
            # Required sections must not be all zeros (except edge cases)
            if zero_count == dims and name not in ("Metadata (time)",):
                errors.append("All zeros in required section")
                section_pass = False

        status = "PASS" if (section_pass and not errors) else "FAIL"
        if status == "FAIL":
            all_pass = False

        results.append({
            "section": name,
            "start": start,
            "end": end,
            "dimensions": dims,
            "nan": nan_count,
            "inf": inf_count,
            "zeros": zero_count,
            "non_zero": dims - zero_count - nan_count - inf_count,
            "errors": "; ".join(errors) if errors else "",
            "status": status,
        })

    return results, all_pass


def fetch_pipeline_vector(flask_url: str, user_id: str):
    """Call the Flask endpoint to get the actual pipeline output."""
    req = Request(
        f"{flask_url.rstrip('/')}/internal/test-vector",
        data=json.dumps({"user_id": user_id}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode())
    if data.get("vector") is None:
        print(f"  No pipeline vector for user '{user_id}'. Submit an entry via admin portal first.")
        sys.exit(1)
    vec = np.array(data["vector"], dtype=np.float64)
    meta = data.get("user_data", {})
    return vec, meta


def run_standalone(args):
    """Run feature extraction directly on provided files."""
    text_path = Path(args.text) if args.text else None
    audio_path = Path(args.audio) if args.audio else None

    if not text_path and not audio_path:
        print("ERROR: Provide at least --text or --audio")
        sys.exit(1)

    text_content = ""
    if text_path:
        if not text_path.exists():
            print(f"ERROR: Text file not found: {text_path}")
            sys.exit(1)
        text_content = text_path.read_text(encoding="utf-8")
        print(f"  Text file: {text_path.name} ({len(text_content)} chars)")

    audio_provided = audio_path is not None and audio_path.exists()
    if audio_path and not audio_provided:
        print(f"ERROR: Audio file not found: {audio_path}")
        sys.exit(1)
    if audio_provided:
        print(f"  Audio file: {audio_path.name} ({audio_path.stat().st_size} bytes)")

    sys.path.insert(0, str(Path(__file__).parent))
    from Stage_1.Extract_features import extract_features

    print("\n  Running Stage 1 feature extraction...")
    t0 = time.time()
    try:
        feature_vec, readable = extract_features(
            text=text_content,
            timestamp=datetime.now(),
            audio_path=str(audio_path) if audio_provided else None,
        )
    except Exception as e:
        print(f"  ERROR during extraction: {e}")
        sys.exit(1)

    elapsed = time.time() - t0
    print(f"  Done in {elapsed:.2f}s")
    return feature_vec, audio_provided, text_path.name if text_path else "", audio_path.name if audio_provided else ""


def main():
    parser = argparse.ArgumentParser(description="Validate 466-dim feature vector")
    parser.add_argument("--text", help="Path to text file")
    parser.add_argument("--audio", help="Path to audio file (.wav)")
    parser.add_argument("--pipeline", help="Flask URL (e.g. http://127.0.0.1:5000) to test actual pipeline output")
    parser.add_argument("--user", default="test_user", help="User ID")
    parser.add_argument("--output", help="Output CSV path (default: auto-generated)")
    args = parser.parse_args()

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

    if args.pipeline:
        # ── Pipeline mode: fetch actual output from Flask ─────────────────
        print(f"  Fetching pipeline vector for user '{args.user}' from {args.pipeline}...")
        feature_vec, meta = fetch_pipeline_vector(args.pipeline, args.user)
        audio_provided = meta.get("has_audio", False)
        text_file = f"text_length={meta.get('text_length', 0)}"
        audio_file = f"has_audio={audio_provided}"
        health_provided = False
        print(f"  Vector shape: {feature_vec.shape[0]}")
    else:
        # ── Standalone mode: run extraction directly ──────────────────────
        feature_vec, audio_provided, text_file, audio_file = run_standalone(args)
        health_provided = False

    # ── Validate ───────────────────────────────────────────────────────────
    dim_count = feature_vec.shape[0]
    print(f"\n  Feature vector dimensions: {dim_count}")

    if dim_count != 466:
        print(f"  FAIL: Expected 466 dimensions, got {dim_count}")
        sys.exit(1)

    results, all_pass = validate_vector(feature_vec, audio_provided, health_provided)

    # ── Print summary ──────────────────────────────────────────────────────
    print(f"\n  {'Section':<30} {'Dims':>5} {'NaN':>5} {'Inf':>5} {'Zeros':>6} {'Status':>6}")
    print(f"  {'-'*58}")
    for r in results:
        print(f"  {r['section']:<30} {r['dimensions']:>5} {r['nan']:>5} {r['inf']:>5} {r['zeros']:>6} {r['status']:>6}")
        if r["errors"]:
            print(f"  {'':>30} -> {r['errors']}")
    print(f"  {'-'*58}")
    nan_total = sum(r["nan"] for r in results)
    zero_total = sum(r["zeros"] for r in results)
    print(f"  Overall: {'PASS' if all_pass else 'FAIL'}  |  NaN: {nan_total}  |  Zeros: {zero_total}/{dim_count}")

    # ── Write CSV ──────────────────────────────────────────────────────────
    csv_path = args.output or f"feature_test_{ts}.csv"
    fieldnames = [
        "timestamp", "user_id", "text_file", "audio_file",
        "section", "dimensions",
        "nan", "inf", "zeros", "non_zero", "errors", "status",
    ]
    with open(csv_path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in results:
            w.writerow({
                "timestamp": ts,
                "user_id": args.user,
                "text_file": text_file,
                "audio_file": audio_file,
                "section": r["section"],
                "dimensions": r["dimensions"],
                "nan": r["nan"],
                "inf": r["inf"],
                "zeros": r["zeros"],
                "non_zero": r["non_zero"],
                "errors": r["errors"],
                "status": r["status"],
            })

    print(f"\n  CSV: {os.path.abspath(csv_path)}")

    # ── Cleanup on PASS ────────────────────────────────────────────────────
    if all_pass:
        print("  Test PASSED — cleaning up temp artifacts...")
        pycache = Path(__file__).parent / "__pycache__"
        if pycache.exists():
            for f in pycache.glob("*"):
                try:
                    f.unlink()
                except Exception:
                    pass
        print("  Done. CSV kept for reference.")
    else:
        print(f"  Test FAILED — check {csv_path} for details.")
        sys.exit(1)


if __name__ == "__main__":
    main()
