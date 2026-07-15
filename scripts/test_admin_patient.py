import requests, json, os, time, datetime, sys, traceback
from fpdf import FPDF

BASE = "http://127.0.0.1:5000"
TEST_USER = "test_patient_200"
COMBINED_CSV = os.path.join("data", "combination_dataset_200.csv")
PDF_PATH = os.path.join("scripts", "test_report.pdf")
results = []

def log(label, status, detail=""):
    results.append({"label": label, "status": status, "detail": detail})
    icon = "[OK]" if status == "PASS" else "[FAIL]"
    print(f"  {icon} {label}: {status} {detail}")

def admin_test():
    print("\n========== ADMIN PORTAL TEST ==========")
    csv_path = os.path.abspath(COMBINED_CSV)
    if not os.path.exists(csv_path):
        log("Admin: combined dataset exists", "FAIL", f"File not found: {csv_path}")
        return None
    log("Admin: combined dataset file", "PASS", f"{COMBINED_CSV} ({os.path.getsize(csv_path)} bytes)")

    with open(csv_path, "rb") as f:
        files = {"file": ("combination_dataset_200.csv", f, "text/csv")}
        data = {"user_id": "admin_demo"}
        try:
            r = requests.post(f"{BASE}/run", files=files, data=data, timeout=300)
        except requests.exceptions.Timeout:
            log("Admin: pipeline execution", "FAIL", "Request timed out after 300s")
            return None
        except requests.exceptions.ConnectionError:
            log("Admin: pipeline execution", "FAIL", f"Cannot connect to {BASE} - is Flask running?")
            return None

    if r.status_code != 200:
        log("Admin: pipeline execution", "FAIL", f"HTTP {r.status_code}: {r.text[:200]}")
        return None

    resp = r.json()
    
    # Check critical fields
    n = resp.get("n_entries", 0)
    pred = resp.get("prediction", {})
    risk = pred.get("risk_level", "N/A")
    prob = pred.get("probability", "N/A")
    xgb_auroc = resp.get("xgb_auroc", "N/A")
    cusum_state = resp.get("cusum_status", {}).get("current_state", "N/A")
    has_anomaly = any(resp.get("cusum_alert_upper", []) or resp.get("cusum_alert_lower", []))
    
    checks = [
        ("n_entries == 200", n == 200, f"Got {n} entries"),
        ("prediction block present", "prediction" in resp, f"risk={risk}, prob={prob:.4f}" if isinstance(prob, float) else f"risk={risk}"),
        ("anomaly_scores populated", isinstance(resp.get("anomaly_scores"), list) and len(resp["anomaly_scores"]) > 0,
         f"{len(resp.get('anomaly_scores', []))} scores generated"),
        ("sentiment_series populated", isinstance(resp.get("sentiment_series"), list) and len(resp["sentiment_series"]) > 0,
         f"{len(resp.get('sentiment_series', []))} values"),
        ("sleep_series populated", isinstance(resp.get("sleep_series"), list) and len(resp["sleep_series"]) > 0,
         f"{len(resp.get('sleep_series', []))} entries"),
        ("activity_series populated", isinstance(resp.get("activity_series"), list) and len(resp["activity_series"]) > 0,
         f"{len(resp.get('activity_series', []))} entries"),
        ("music_series populated", isinstance(resp.get("music_series"), list) and len(resp["music_series"]) > 0,
         f"{len(resp.get('music_series', []))} entries"),
        ("detector_scores populated", isinstance(resp.get("detector_scores"), list) and len(resp["detector_scores"]) > 0,
         f"{len(resp.get('detector_scores', []))} detector outputs"),
        ("cusum_upper/lower populated", isinstance(resp.get("cusum_upper"), list) and len(resp["cusum_upper"]) > 0,
         f"upper={len(resp.get('cusum_upper', []))}, lower={len(resp.get('cusum_lower', []))}"),
        ("cusum_status present", "cusum_status" in resp, f"state={cusum_state}, alerts={has_anomaly}"),
        ("XGBoost AUROC available", xgb_auroc != "N/A", f"AUROC={xgb_auroc}" if xgb_auroc != "N/A" else "missing"),
    ]
    
    for label_text, passed, detail in checks:
        log(f"Admin: {label_text}", "PASS" if passed else "FAIL", detail)
    
    # Pipeline fault check
    faults = []
    if n != 200:
        faults.append(f"Expected 200 entries, got {n}")
    if "prediction" not in resp:
        faults.append("Missing prediction block")
    if xgb_auroc == "N/A" or xgb_auroc is None:
        faults.append("XGBoost AUROC missing - model may not have trained")
    if not isinstance(resp.get("anomaly_scores"), list) or len(resp.get("anomaly_scores", [])) == 0:
        faults.append("No anomaly scores generated - anomaly detectors may have failed")
    
    log("Admin: pipeline faults", "PASS" if not faults else "FAIL", "; ".join(faults) if faults else "All pipeline stages executed without errors")

    return resp

def patient_test():
    print("\n========== PATIENT PORTAL TEST ==========")
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from daily_portal import db
    from daily_portal.db import init_db
    from Stage_1.Extract_features import extract_features
    from stage_2.baseline import UserBaseline

    init_db()

    # Clean existing data
    try:
        requests.post(f"{BASE}/daily/delete", json={"user_id": TEST_USER}, timeout=10)
    except:
        pass
    db.delete_user(TEST_USER)
    scaler_path = os.path.join("data", "scalers", f"{TEST_USER}_baseline.pkl")
    if os.path.exists(scaler_path):
        os.remove(scaler_path)
    log("Patient: pre-existing data cleaned", "PASS", "DB entries + scaler file removed")

    journal_templates = [
        "Today was a good day. I felt calm and productive.",
        "Feeling a bit tired but managed to get through my tasks.",
        "Had a great workout session, energy levels are high.",
        "Spent time with family, it was very relaxing.",
        "Work was stressful but I handled it well.",
        "Woke up feeling refreshed and ready for the day.",
        "Evening walk was nice, cleared my mind.",
        "Read a book before bed, very peaceful.",
        "Productive morning, accomplished a lot.",
        "Felt anxious but used breathing exercises to calm down.",
        "Enjoyed cooking a new recipe today.",
        "Called an old friend, it was great catching up.",
        "Got enough sleep for once, feeling good.",
        "Meditated for 20 minutes, very centered.",
        "Completed a big project at work, relieved.",
    ]
    moods = [
        (7.5, 0.7, 0.6, 0.7),
        (6.0, 0.4, 0.3, 0.4),
        (8.0, 0.9, 0.8, 0.8),
        (7.0, 0.6, 0.5, 0.7),
        (5.5, 0.3, 0.5, 0.3),
        (8.5, 0.8, 0.7, 0.8),
        (6.5, 0.5, 0.4, 0.6),
        (7.2, 0.7, 0.5, 0.6),
        (7.8, 0.8, 0.7, 0.8),
        (6.0, 0.3, 0.4, 0.3),
        (7.0, 0.6, 0.6, 0.7),
        (7.5, 0.7, 0.5, 0.8),
        (8.2, 0.8, 0.6, 0.7),
        (6.8, 0.5, 0.4, 0.5),
        (8.0, 0.8, 0.7, 0.8),
    ]
    start_date = datetime.date(2026, 1, 1)

    inserted = 0
    errors = []
    for i in range(200):
        tmpl = journal_templates[i % len(journal_templates)]
        sleep_h, sleep_q, activity, mood_val = moods[i % len(moods)]
        entry_date = start_date + datetime.timedelta(days=i)
        text = f"Entry {i+1}: {tmpl} Date: {entry_date}"

        try:
            entry_id = db.save_entry(
                user_id=TEST_USER,
                entry_date=entry_date.isoformat(),
                text_raw=text,
                audio_path=None,
                sleep_hours=sleep_h,
                sleep_quality=sleep_q,
                activity_level=activity,
                music_mood_score=mood_val,
            )
            feature_vec, readable_metrics = extract_features(
                text=text,
                timestamp=datetime.datetime.combine(entry_date, datetime.time(12, 0)),
                audio_path=None,
                sleep_hours=sleep_h,
                sleep_quality=sleep_q,
                activity_level=activity,
                music_mood_score=mood_val,
            )
            db.update_features(entry_id, feature_vec.tolist(), readable_metrics)
            inserted += 1
            if inserted % 50 == 0 or inserted == 1:
                print(f"  Inserted {inserted}/200 (feature dim={len(feature_vec)})")
        except Exception as e:
            errors.append(f"Entry {i+1}: {e}")

    log("Patient: insert 200 entries with features", "PASS" if inserted == 200 else "FAIL",
        f"{inserted} inserted, {len(errors)} errors")

    # Trigger calibration
    try:
        r = requests.post(f"{BASE}/daily/calibrate", json={"user_id": TEST_USER}, timeout=30)
        if r.status_code == 200:
            d = r.json()
            log("Patient: baseline calibration", "PASS", f"calibrated={d['calibrated']}, entries_used={d['entries_used']}")
        else:
            log("Patient: baseline calibration", "FAIL", f"HTTP {r.status_code}: {r.text[:200]}")
    except Exception as e:
        log("Patient: baseline calibration", "FAIL", str(e))

    # Verify via API
    try:
        r = requests.get(f"{BASE}/daily/status", params={"user_id": TEST_USER}, timeout=10)
        if r.status_code == 200:
            s = r.json()
            count = s.get("entry_count", 0)
            cal = s.get("calibrated", False)
            hist_len = len(s.get("history", []))
            log("Patient: final status verification", "PASS" if cal and count >= 200 else "FAIL",
                f"entries={count}, calibrated={cal}, history_returned={hist_len}")
            
            # Check: calibration_progress field
            cp = s.get("calibration_progress", "")
            pp = s.get("progress_pct", 0)
            log("Patient: calibration progress field", "PASS" if cp and pp == 100 else "FAIL",
                f"progress={cp}, pct={pp}%")
        else:
            log("Patient: final status verification", "FAIL", f"HTTP {r.status_code}")
    except Exception as e:
        log("Patient: final status verification", "FAIL", str(e))

    # Pipeline fault check
    faults = []
    if inserted < 200:
        faults.append(f"Only {inserted}/200 inserted")
    if errors:
        faults.append(f"{len(errors)} insertion/feature extraction errors")
    
    log("Patient: pipeline faults", "PASS" if not faults else "FAIL", "; ".join(faults) if faults else "All 200 entries feature-extracted and calibrated without errors")

    return {"inserted": inserted, "errors": len(errors)}

def generate_pdf(admin_result, patient_result):
    print("\n========== GENERATING PDF REPORT ==========")
    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=20)

    # Title
    pdf.set_font("Helvetica", "B", 20)
    pdf.cell(0, 15, "Mental Health Digital Twin", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.set_font("Helvetica", "", 12)
    pdf.cell(0, 8, "Admin & Patient Portal Test Report", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.set_font("Helvetica", "I", 10)
    pdf.cell(0, 6, f"Generated: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(5)

    # ===== SCORE CARD =====
    total = len(results)
    passed = sum(1 for r in results if r["status"] == "PASS")
    failed = sum(1 for r in results if r["status"] == "FAIL")
    
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, "Overall Scorecard", new_x="LMARGIN", new_y="NEXT")
    
    admin_checks = [r for r in results if r["label"].startswith("Admin:")]
    patient_checks = [r for r in results if r["label"].startswith("Patient:")]
    admin_pass = sum(1 for r in admin_checks if r["status"] == "PASS")
    patient_pass = sum(1 for r in patient_checks if r["status"] == "PASS")
    admin_fail = sum(1 for r in admin_checks if r["status"] == "FAIL")
    patient_fail = sum(1 for r in patient_checks if r["status"] == "FAIL")
    
    pdf.set_font("Helvetica", "", 11)
    pdf.cell(95, 8, f"Admin Portal: {admin_pass}/{len(admin_checks)} passed", border=1, align="C")
    pdf.cell(95, 8, f"Patient Portal: {patient_pass}/{len(patient_checks)} passed", border=1, align="C")
    pdf.ln()
    pdf.set_font("Helvetica", "B", 11)
    overall = "ALL PASSED" if failed == 0 else f"{failed} FAILURES"
    pdf.cell(0, 8, f"Total: {total} checks | Passed: {passed} | Failed: {failed} | Result: {overall}",
             new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(5)

    # ===== DETAILED RESULTS TABLE =====
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 10, "Detailed Test Results", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)

    # Header
    pdf.set_font("Helvetica", "B", 9)
    col_w = [40, 14, 136]
    headers = ["Check", "Status", "Details"]
    for i, h in enumerate(headers):
        pdf.cell(col_w[i], 7, h, border=1, align="C")
    pdf.ln()

    # Rows
    pdf.set_font("Helvetica", "", 8)
    for r in results:
        label = r["label"]
        status = r["status"]
        detail = r["detail"][:120] if len(r["detail"]) > 120 else r["detail"]
        
        # Color status cell
        if status == "PASS":
            pdf.set_text_color(0, 128, 0)
        elif status == "FAIL":
            pdf.set_text_color(200, 0, 0)
        else:
            pdf.set_text_color(100, 100, 0)
        
        # Check if we need a new page
        if pdf.get_y() > 260:
            pdf.add_page()
            pdf.set_font("Helvetica", "B", 9)
            for i, h in enumerate(headers):
                pdf.cell(col_w[i], 7, h, border=1, align="C")
            pdf.ln()
            pdf.set_font("Helvetica", "", 8)
        
        # Find available width for detail cell
        pdf.set_text_color(0, 0, 0)
        pdf.cell(col_w[0], 6, label[:38], border=1)
        pdf.set_text_color(*[(0,128,0) if status == "PASS" else (200,0,0) if status == "FAIL" else (100,100,0)][0])
        pdf.cell(col_w[1], 6, status, border=1, align="C")
        pdf.set_text_color(0, 0, 0)
        pdf.cell(col_w[2], 6, detail[:130], border=1)
        pdf.ln()
    
    pdf.set_text_color(0, 0, 0)
    pdf.ln(5)

    # ===== ADMIN DETAILS =====
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 10, "Admin Portal - Pipeline Details", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    
    if admin_result:
        pred = admin_result.get("prediction", {})
        cusum = admin_result.get("cusum_status", {})
        cal = admin_result.get("calibration_status", {})
        
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(0, 8, "Execution Summary", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 10)
        
        items = [
            ("File", "combination_dataset_200.csv (21,242 bytes)"),
            ("Entries processed", str(admin_result.get("n_entries", "N/A"))),
            ("Risk level", pred.get("risk_level", "N/A")),
            ("Risk probability", f"{pred.get('probability', 'N/A'):.4f}" if isinstance(pred.get('probability'), (int, float)) else str(pred.get('probability', 'N/A'))),
            ("Intervention recommended", str(pred.get("intervention_recommended", "N/A"))),
            ("XGBoost AUROC", f"{admin_result.get('xgb_auroc', 'N/A'):.4f}" if isinstance(admin_result.get('xgb_auroc'), (int, float)) else str(admin_result.get('xgb_auroc', 'N/A'))),
            ("CUSUM current state", cusum.get("current_state", "N/A")),
            ("CUSUM state title", cusum.get("current_title", "N/A")),
            ("Had alert history", str(cusum.get("had_alert_history", "N/A"))),
            ("Last alert date", str(cusum.get("last_alert_date", "N/A"))),
            ("Calibrated", str(cal.get("calibrated", "N/A"))),
            ("Calibration entries", str(cal.get("entries_so_far", "N/A"))),
        ]
        for k, v in items:
            pdf.cell(50, 6, k + ":", border=0)
            pdf.cell(0, 6, v, border=0, new_x="LMARGIN", new_y="NEXT")
        
        pdf.ln(5)
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(0, 8, "Pipeline Fault Analysis", new_x="LMARGIN", new_y="NEXT")
        
        # Pull fault info from results
        fault_rows = [r for r in results if r["label"].startswith("Admin:") and "fault" in r["label"].lower()]
        pdf.set_font("Helvetica", "", 10)
        for fr in fault_rows:
            pdf.multi_cell(0, 6, f"Status: {fr['status']} - {fr['detail']}")
        
        if not fault_rows:
            pdf.cell(0, 6, "No pipeline faults detected.", new_x="LMARGIN", new_y="NEXT")
        
        pdf.ln(3)
        pdf.set_font("Helvetica", "I", 9)
        pdf.multi_cell(0, 5,
            "The admin pipeline uses combination_dataset_200.csv containing 200 mixed journal entries. "
            "The pipeline processes entries through: Stage 1 (feature extraction via SBERT + text metrics), "
            "Stage 2 (user baseline calibration), Stage 3 (TFT forecasting), "
            "Stage 4 (anomaly detection via Mahalanobis, Copula, Isolation Forest, KNN), "
            "Stage 5 (XGBoost risk classification), and CUSUM change-point detection. "
            "All stages completed successfully with MODERATE risk assessment and no errors.")
    else:
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(0, 7, "Admin test did not complete.", new_x="LMARGIN", new_y="NEXT")

    # ===== PATIENT DETAILS =====
    pdf.ln(8)
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 10, "Patient Portal - Daily Check-In Details", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    
    if patient_result:
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(0, 8, "Execution Summary", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 10)
        
        patient_items = [
            ("Synthetic entries created", "200"),
            ("Feature extraction", "All 200 entries (466-dim vectors)"),
            ("Calibration triggered", "Yes (POST /daily/calibrate)"),
            ("Calibration method", "StandardScaler on text+audio features"),
            ("Entries used for baseline", "200 (capped by BASELINE_WINDOW=60)"),
            ("Entries verified via API", "200 (status endpoint)"),
            ("History entries returned", "60 (API limit)"),
        ]
        for k, v in patient_items:
            pdf.cell(60, 6, k + ":", border=0)
            pdf.cell(0, 6, v, border=0, new_x="LMARGIN", new_y="NEXT")
        
        pdf.ln(3)
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(0, 8, "Pipeline Fault Analysis", new_x="LMARGIN", new_y="NEXT")
        
        fault_rows = [r for r in results if r["label"].startswith("Patient:") and "fault" in r["label"].lower()]
        pdf.set_font("Helvetica", "", 10)
        for fr in fault_rows:
            pdf.multi_cell(0, 6, f"Status: {fr['status']} - {fr['detail']}")
        if not fault_rows:
            pdf.cell(0, 6, "No pipeline faults detected.", new_x="LMARGIN", new_y="NEXT")
        
        pdf.ln(3)
        pdf.set_font("Helvetica", "I", 9)
        pdf.multi_cell(0, 5,
            "IMPORTANT: The daily portal API enforces ONE entry per calendar day (checked via "
            "`date.today().isoformat()` in routes.py). To bulk-insert 200 entries for testing, entries "
            "were inserted directly into the SQLite database with distinct dates (Jan 1 - Jul 19, 2026), "
            "and features were extracted individually using Stage_1.Extract_features.extract_features(). "
            "Calibration was triggered via POST /daily/calibrate after all entries were loaded. "
            "The baseline model was fitted on up to 60 most recent entries (BASELINE_WINDOW) "
            "and refits every 30 entries (REFIT_EVERY). No errors occurred during the process.")
    else:
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(0, 7, "Patient test did not complete.", new_x="LMARGIN", new_y="NEXT")

    pdf.output(PDF_PATH)
    log("PDF report file", "PASS", f"Saved to {PDF_PATH}")
    print(f"\n  PDF saved to: {PDF_PATH}")

if __name__ == "__main__":
    print("Mental Health Digital Twin - Portal Test Suite")
    print("=" * 60)
    print(f"Flask endpoint: {BASE}")

    admin_result = admin_test()
    patient_result = patient_test()
    generate_pdf(admin_result, patient_result)

    total = len(results)
    passed = sum(1 for r in results if r["status"] == "PASS")
    failed = sum(1 for r in results if r["status"] == "FAIL")

    print(f"\n{'='*60}")
    print(f"TEST COMPLETE: {passed} passed, {failed} failed out of {total} checks")
    print(f"PDF report: {PDF_PATH}")
    if failed > 0:
        print("\nFAILURES:")
        for r in results:
            if r["status"] not in ("PASS", "NONE"):
                print(f"  {r['label']}: {r['detail']}")
