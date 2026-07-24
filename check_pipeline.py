import requests, json

s = requests.Session()
s.post('http://127.0.0.1:5000/auth/login', json={'user_id':'test_patient_200','role':'patient'})
r = s.post('http://127.0.0.1:5000/diagnose', json={'user_id':'test_patient_200','fullName':'test_patient_200'}, timeout=120)
d = r.json()

print("=== PIPELINE RESPONSE SUMMARY ===")
print(f"n_entries: {d['n_entries']}")
print(f"prediction: {json.dumps(d['prediction'], indent=2)}")
print(f"baseline_trend: {d['baseline_trend']}")
print(f"xgb_auroc: {d['xgb_auroc']}")
print(f"calibration: {json.dumps(d['calibration_status'], indent=2)}")

print(f"\n=== TFT 14-DAY FORECAST ({len(d['tft_forecast_14day'])} days) ===")
for i, f in enumerate(d['tft_forecast_14day']):
    if isinstance(f, dict):
        prob = f.get('probability', '?')
        risk = f.get('risk_level', '?')
        interv = f.get('intervention_recommended', '?')
        if isinstance(prob, float):
            prob = f"{prob:.4f}"
        print(f"  Day {i+1}: prob={prob} risk={risk} intervention={interv}")
    else:
        print(f"  Day {i+1}: value={f}")

print(f"\n=== ANOMALY SCORES ({len(d['anomaly_scores'])} entries) ===")
scores = d['anomaly_scores']
valid = [s for s in scores if s is not None]
print(f"  Mean: {sum(valid)/len(valid):.4f}")
print(f"  Min: {min(valid):.4f}")
print(f"  Max: {max(valid):.4f}")
print(f"  First 5 (baseline): {[round(s,3) for s in scores[:5]]}")
print(f"  Days 45-55 (increasing stress): {[round(s,3) for s in scores[45:55]]}")
print(f"  Days 65-75 (stress peak): {[round(s,3) for s in scores[65:75]]}")
print(f"  Days 95-110 (sudden anomaly): {[round(s,3) for s in scores[95:110]]}")
print(f"  Days 130-140 (stable): {[round(s,3) for s in scores[130:140]]}")
print(f"  Last 5: {[round(s,3) for s in scores[-5:]]}")

print(f"\n=== EMOTIONS SERIES (sampled) ===")
emo = d['emotions_series']
print(f"  First 5 (baseline): {emo[:5]}")
print(f"  Days 45-55 (increasing stress): {emo[45:55]}")
print(f"  Days 65-75 (stress peak): {emo[65:75]}")
print(f"  Days 95-110 (sudden anomaly): {emo[95:110]}")
print(f"  Days 130-140 (stable): {emo[130:140]}")
print(f"  Last 5: {emo[-5:]}")

print(f"\n=== CUSUM STATUS ===")
print(json.dumps(d['cusum_status'], indent=2))
print(f"  threshold: {d['cusum_threshold']}")

print(f"\n=== DETECTOR SCORES (sampled) ===")
ds = d['detector_scores']
for i in [0, 49, 69, 99, 109, 139, 195]:
    if i < len(ds):
        item = ds[i]
        if isinstance(item, dict):
            print(f"  Day {i+1}: {json.dumps(item, default=str)[:200]}")
        else:
            print(f"  Day {i+1}: {item}")

print(f"\n=== PERSISTENT ANOMALY FLAGS ===")
flags = d['persistent_anomaly_flags']
print(f"  Total True flags: {sum(1 for f in flags if f)}")
flagged = [i for i,f in enumerate(flags) if f]
print(f"  Flagged indices: {flagged[:30]}")

print(f"\n=== BASELINE DEVIATION SERIES ===")
bds = d['baseline_deviation_series']
print(f"  Non-None entries: {sum(1 for b in bds if b is not None)}")
valid_bds = [b for b in bds if b is not None]
if valid_bds:
    print(f"  Mean: {sum(valid_bds)/len(valid_bds):.4f}")
    print(f"  First 5: {[round(b,4) for b in valid_bds[:5]]}")
    print(f"  Last 5: {[round(b,4) for b in valid_bds[-5:]]}")
