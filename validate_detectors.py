import pandas as pd
import numpy as np
import warnings
from pathlib import Path
from sklearn.metrics import brier_score_loss
from scipy.stats import percentileofscore
warnings.filterwarnings("ignore")
DATA_DIR = Path("data")
ENTRIES_PER_USER = 15
INJECT_PHRASE = "Can't stop crying. Everything is hopeless and I can't take it anymore. No point in trying."
def run_user_through_pipeline(pipe, uid, df):

    prev_ts = None
    for _, row in df.iterrows():
        try:
            pipe.process_entry(
                user_id=uid, text=row["text"],
                timestamp=pd.to_datetime(row["timestamp"]),
                prev_timestamp=prev_ts,
                sleep_hours=row["sleep_hours"], sleep_quality=row["sleep_quality"],
                activity_level=row["activity_level"], music_mood_score=row["music_mood_score"],
            )
        except Exception:
            continue
        prev_ts = pd.to_datetime(row["timestamp"])
    return pipe.normalized_vectors.get(uid, [])
def score_with_detector(det, vecs):

    X = np.array(vecs)
    result = det.predict(X)
    out = []
    for i in range(len(vecs)):
        out.append({
            "overall_risk_score": float(result["overall_risk_score"][i]),
            "is_anomaly": result["is_anomaly"][i],
            "detector_scores": result["metrics_summary"][i],
        })
    return out
def make_injected_row(row, phrase=INJECT_PHRASE):

    r = row.copy()
    r["text"] = phrase
    r["sleep_hours"] = 3.0
    r["sleep_quality"] = 0.05
    r["activity_level"] = 0.05
    r["music_mood_score"] = 0.05
    return r
def ece(y_true, y_prob, n_bins=10):

    bins = np.linspace(0, 1, n_bins + 1)
    total = 0.0
    count = 0
    for i in range(n_bins):
        mask = (y_prob > bins[i]) & (y_prob <= bins[i + 1])
        if mask.sum() == 0:
            continue
        acc = y_true[mask].mean()
        conf = y_prob[mask].mean()
        total += mask.sum() * abs(acc - conf)
        count += mask.sum()
    return total / max(count, 1)
def main():
    from unified_pipeline import UnifiedJournalPipeline
    from stage_4.anomaly_pipeline import MultiDetectorPipeline
    pipe = UnifiedJournalPipeline()
    healthy_df = pd.read_csv(DATA_DIR / "healthy_dataset_200.csv")
    atrisk_df = pd.read_csv(DATA_DIR / "at_risk_dataset_200.csv")
    healthy_users = []
    for i in range(0, len(healthy_df), ENTRIES_PER_USER):
        chunk = healthy_df.iloc[i:i + ENTRIES_PER_USER].reset_index(drop=True)
        if len(chunk) >= 10:
            healthy_users.append(chunk)
    atrisk_users = []
    for i in range(0, len(atrisk_df), ENTRIES_PER_USER):
        chunk = atrisk_df.iloc[i:i + ENTRIES_PER_USER].reset_index(drop=True)
        if len(chunk) >= 10:
            atrisk_users.append(chunk)
    print(f"Loaded {len(healthy_users)} healthy users, {len(atrisk_users)} at-risk users")
    print("\n" + "=" * 64)
    print("ANOMALY INJECTION TEST")
    print("=" * 64)
    test_df = healthy_users[0].copy()
    inject_indices = [7, 11]
    vecs_clean = run_user_through_pipeline(pipe, "test_user", test_df)
    if len(vecs_clean) < 10:
        print("Not enough vectors for test user")
        return
    det = MultiDetectorPipeline()
    det.fit(np.array(vecs_clean[:10]))
    clean_scores = score_with_detector(det, vecs_clean)
    clean_risks = np.array([s["overall_risk_score"] for s in clean_scores])
    clean_flags = [any(s["is_anomaly"]) for s in clean_scores]
    injected_df = test_df.copy()
    for idx in inject_indices:
        injected_df.loc[idx] = make_injected_row(injected_df.loc[idx])
    vecs_injected = run_user_through_pipeline(pipe, "test_user_injected", injected_df)
    injected_scores = score_with_detector(det, vecs_injected)
    injected_risks = np.array([s["overall_risk_score"] for s in injected_scores])
    injected_flags = [any(s["is_anomaly"]) for s in injected_scores]
    clean_mean = clean_risks.mean()
    clean_std = clean_risks.std() + 1e-9
    print(f"\n  Clean baseline: mean risk {clean_mean:.4f}, std {clean_std:.4f}")
    print(f"  Baseline risk range: {clean_risks.min():.4f} - {clean_risks.max():.4f}")
    print(f"  Baseline false-positive flags: {sum(clean_flags)}/{len(clean_flags)}")
    print(f"\n  Injected days (entries {[i+1 for i in inject_indices]}):")
    for idx in inject_indices:
        if idx >= len(injected_risks):
            continue
        score = injected_risks[idx]
        flag = injected_flags[idx]
        z = (score - clean_mean) / clean_std
        pct = percentileofscore(np.concatenate([clean_risks, injected_risks]), score)
        print(f"    Entry {idx+1}: risk={score:.4f}, z={z:.2f}, flag={'YES' if flag else 'no'}, "
              f"risk percentile={pct:.0f}%")
    threshold = np.percentile(clean_risks, 90)
    detected = sum(1 for idx in inject_indices if idx < len(injected_risks) and injected_risks[idx] > threshold)
    print(f"\n  Detection recall (risk > 90th pct of clean days): {detected}/{len(inject_indices)}")
    print(f"  Mean risk of injected days: {injected_risks[inject_indices].mean():.4f} "
          f"vs clean mean {clean_mean:.4f}")
    print("\n\n" + "=" * 64)
    print("TEMPORAL CONSISTENCY")
    print("=" * 64)
    stabilities = []
    for ui, df in enumerate(healthy_users[:6]):
        uid = f"hc_{ui}"
        vecs = run_user_through_pipeline(pipe, uid, df)
        if len(vecs) < 10:
            continue
        d = MultiDetectorPipeline()
        d.fit(np.array(vecs[:10]))
        scores = score_with_detector(d, vecs)
        risks = np.array([s["overall_risk_score"] for s in scores])
        flags = sum(any(s["is_anomaly"]) for s in scores)
        stabilities.append({
            "uid": uid,
            "mean": risks.mean(),
            "std": risks.std(),
            "range": risks.max() - risks.min(),
            "n_anomaly_flags": flags,
        })
        print(f"  {uid}: mean={risks.mean():.4f}, std={risks.std():.4f}, "
              f"range={risks.max()-risks.min():.4f}, anomaly flags={flags}/15")
    if stabilities:
        avg_std = np.mean([s["std"] for s in stabilities])
        avg_flags = np.mean([s["n_anomaly_flags"] for s in stabilities])
        print(f"\n  Avg clean-day risk std: {avg_std:.4f} (lower = more stable)")
        print(f"  Avg anomaly flags on clean users: {avg_flags:.1f}/15 (lower = fewer false positives)")
    print("\n\n" + "=" * 64)
    print("STAGE 5 CALIBRATION VALIDATION")
    print("=" * 64)
    rows = []
    all_users = [(f"h{i}", df, 0) for i, df in enumerate(healthy_users)]
    all_users += [(f"a{i}", df, 1) for i, df in enumerate(atrisk_users)]
    print("\n  Assembling Stage 5 features for all users...")
    for uid, df, label in all_users:
        vecs = run_user_through_pipeline(pipe, uid, df)
        if len(vecs) < 10:
            continue
        d = MultiDetectorPipeline()
        d.fit(np.array(vecs[:10]))
        anomaly_results = score_with_detector(d, vecs)
        try:
            features = pipe.assemble_stage5_features(vecs, anomaly_results)
        except Exception as e:
            print(f"    {uid}: feature assembly failed ({e})")
            continue
        temp_pred = pipe.predict_classification(features, calibration="temperature")
        platt_pred = pipe.predict_classification(features, calibration="platt")
        rows.append({
            "uid": uid,
            "label": label,
            "p_raw": temp_pred["probability_raw"],
            "p_temp": temp_pred["probability"],
            "p_platt": platt_pred["probability"],
            "level_temp": temp_pred["risk_level"],
            "level_platt": platt_pred["risk_level"],
        })
        print(f"    {uid}: label={label}, p_raw={temp_pred['probability_raw']:.3f}, "
              f"p_temp={temp_pred['probability']:.3f}, p_platt={platt_pred['probability']:.3f}")
    if len(rows) < 6:
        print("  Not enough samples for calibration metrics")
        return
    df_cal = pd.DataFrame(rows)
    y = df_cal["label"].values
    print(f"\n  n = {len(df_cal)} users ({sum(y==0)} healthy, {sum(y==1)} at-risk)")
    for scheme, col in [("raw", "p_raw"), ("temperature", "p_temp"), ("platt", "p_platt")]:
        p = df_cal[col].values
        brier = brier_score_loss(y, p)
        e = ece(y, p)
        print(f"\n  [{scheme}]")
        print(f"    Brier score: {brier:.4f} (lower = better, random = 0.25)")
        print(f"    ECE:         {e:.4f} (lower = better)")
        bins = np.linspace(0, 1, 6)
        print(f"    Calibration (bin: count, mean_pred, actual_rate):")
        for i in range(5):
            mask = (p > bins[i]) & (p <= bins[i + 1])
            if mask.sum() == 0:
                continue
            acc = y[mask].mean()
            conf = p[mask].mean()
            print(f"      ({bins[i]:.2f}, {bins[i+1]:.2f}]: n={mask.sum()}, "
                  f"pred={conf:.3f}, actual={acc:.3f}")
    for scheme, col in [("temperature", "p_temp"), ("platt", "p_platt")]:
        preds = (df_cal[col].values >= 0.5).astype(int)
        acc = (preds == y).mean()
        print(f"\n  [{scheme}] binary accuracy @0.5: {acc:.3f}")
if __name__ == "__main__":
    main()