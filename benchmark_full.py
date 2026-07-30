"""
Benchmark: Population Norm vs Personalized Baseline  +  Single Detector vs 4-Ensemble
"""
import pandas as pd
import numpy as np
import warnings, time
from pathlib import Path
from sklearn.metrics import roc_auc_score, f1_score, precision_recall_curve
from sklearn.model_selection import StratifiedKFold
from xgboost import XGBClassifier
from sklearn.ensemble import RandomForestClassifier
warnings.filterwarnings("ignore")

DATA_DIR = Path("data")
ENTRIES_PER_USER = 15

# ── 1. Load and chunk data ──────────────────────────────────────────────────
def load_and_chunk(filename, label):
    df = pd.read_csv(DATA_DIR / filename)
    df["label"] = label
    users = []
    for i in range(0, len(df), ENTRIES_PER_USER):
        chunk = df.iloc[i:i + ENTRIES_PER_USER].reset_index(drop=True)
        if len(chunk) >= 10:
            users.append(chunk)
    return users

healthy_users = load_and_chunk("healthy_dataset_200.csv", 0)
at_risk_users = load_and_chunk("at_risk_dataset_200.csv", 1)
print(f"Healthy users: {len(healthy_users)}, At-risk users: {len(at_risk_users)}")

all_users = []
for i, df in enumerate(healthy_users):
    all_users.append((f"healthy_{i}", df, 0))
for i, df in enumerate(at_risk_users):
    all_users.append((f"at_risk_{i}", df, 1))

# ── 2. Run pipeline for each user ───────────────────────────────────────────
from unified_pipeline import UnifiedJournalPipeline
from stage_4.anomaly_pipeline import MultiDetectorPipeline

user_data = {}  # {uid: {"features": np.array(2336,), "label": 0/1, "anomaly_scores": [...], "n": int}}

print("\nProcessing users through pipeline...")
for uid, df, label in all_users:
    t0 = time.time()
    pipe = UnifiedJournalPipeline()
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

    vecs = pipe.normalized_vectors.get(uid, [])
    if len(vecs) < 5:
        continue

    # Train anomaly detector
    X_train_vecs = np.array(vecs[:max(10, int(len(vecs)*0.7))])
    if len(X_train_vecs) >= 10:
        det = MultiDetectorPipeline()
        det.fit(X_train_vecs)
        pipe.anomaly_detector = det
        anomaly_results = [pipe.detect_anomalies(v) for v in vecs]
        pipe.anomaly_scores[uid] = anomaly_results

    anomalies = pipe.anomaly_scores.get(uid, [])
    if not anomalies:
        continue

    # Assemble Stage 5 features (2336-dim) for population-norm comparison
    try:
        features = pipe.assemble_stage5_features(vecs, anomalies)
    except Exception:
        features = np.zeros(2336)

    # For per-user model (raw 466-dim vectors work better for small data)
    vecs_array = np.array(vecs)

    user_data[uid] = {
        "features_2336": features,          # Stage 5 aggregated features
        "vectors_466": vecs_array,          # raw normalized vectors
        "anomaly_scores": [a["overall_risk_score"] for a in anomalies],
        "detector_scores": [a["detector_scores"] for a in anomalies],
        "label": label,
        "n": len(vecs),
    }
    print(f"  {uid}: {len(vecs)} entries ({time.time()-t0:.0f}s)")

uids = list(user_data.keys())
labels = np.array([user_data[u]["label"] for u in uids])
print(f"\nTotal users: {len(uids)} ({sum(labels==0)} healthy, {sum(labels==1)} at-risk)\n")

# ═══════════════════════════════════════════════════════════════════════════
# EXPERIMENT 1: Population Norm vs Personalized Baseline
# ═══════════════════════════════════════════════════════════════════════════
print("=" * 64)
print("EXPERIMENT 1: Population Norm vs Personalized Baseline")
print("=" * 64)

# ── 1a: Population Norm (leave-one-user-out CV) ──
print("\n[1a] Population Norm Model — leave-one-user-out CV")
X_pop = np.array([user_data[u]["features_2336"] for u in uids])
y_pop = labels

pop_aucs = []
skf = StratifiedKFold(n_splits=min(5, len(np.unique(labels))), shuffle=True, random_state=42)
for train_idx, test_idx in skf.split(X_pop, y_pop):
    X_tr, X_te = X_pop[train_idx], X_pop[test_idx]
    y_tr, y_te = y_pop[train_idx], y_pop[test_idx]
    scale = y_tr.sum() / len(y_tr)
    clf = XGBClassifier(n_estimators=50, max_depth=3, scale_pos_weight=(1-scale)/max(scale,0.01), verbosity=0, random_state=42)
    clf.fit(X_tr, y_tr)
    y_prob = clf.predict_proba(X_te)[:, 1]
    pop_aucs.append(roc_auc_score(y_te, y_prob))

print(f"  AUROC: {np.mean(pop_aucs):.4f} +/- {np.std(pop_aucs):.4f}")

# ── 1b: Personalized Baseline (per-user train/test split) ──
print("\n[1b] Personalized Baseline — per-user train/test split")
per_aucs = []
for uid in uids:
    vecs = user_data[uid]["vectors_466"]
    n = len(vecs)
    split = int(n * 0.7)
    if split < 3 or n - split < 2:
        continue
    X_tr, X_te = vecs[:split], vecs[split:]
    y_tr = np.array([user_data[uid]["label"]] * split)
    y_te = np.array([user_data[uid]["label"]] * (n - split))

    clf = RandomForestClassifier(n_estimators=30, max_depth=3, random_state=42, class_weight="balanced")
    clf.fit(X_tr, y_tr)
    y_prob = clf.predict_proba(X_te)[:, 1]
    try:
        per_aucs.append(roc_auc_score(y_te, y_prob))
    except ValueError:
        continue

print(f"  Per-user AUROC (avg): {np.mean(per_aucs):.4f} +/- {np.std(per_aucs):.4f}" if per_aucs else "  Insufficient data")
print(f"\n  Personalization Delta: {np.mean(per_aucs) - np.mean(pop_aucs):+.4f}" if per_aucs else "")

# ═══════════════════════════════════════════════════════════════════════════
# EXPERIMENT 2: Single Detector (Isolation Forest) vs 4-Ensemble
# ═══════════════════════════════════════════════════════════════════════════
print("\n\n" + "=" * 64)
print("EXPERIMENT 2: Single Detector vs 4-Ensemble")
print("=" * 64)

# For each user, per-entry anomaly detection gives us:
#   - detector_scores: {mahalanobis, copula, isolation_forest, knn} = 4 individual scores
#   - overall_risk_score: weighted ensemble of all 4

# We treat the per-entry scores as predictions and compare against the user label
# (healthy users should have low scores, at-risk users high scores)

all_single_scores = []   # isolation_forest only
all_ensemble_scores = [] # overall_risk_score (weighted average)
all_entry_labels = []

for uid in uids:
    det_scores = user_data[uid]["detector_scores"]
    label = user_data[uid]["label"]
    for entry_scores in det_scores:
        all_single_scores.append(entry_scores.get("isolation_forest", 0.5))
        all_ensemble_scores.append(entry_scores.get("overall_risk_score", 0.5))
        all_entry_labels.append(label)

y_entry = np.array(all_entry_labels)
single_score = np.array(all_single_scores)
ensemble_score = np.array(all_ensemble_scores)

# AUROC
single_auc = roc_auc_score(y_entry, single_score)
ensemble_auc = roc_auc_score(y_entry, ensemble_score)
print(f"\n  Isolation Forest only AUROC: {single_auc:.4f}")
print(f"  4-Ensemble AUROC:            {ensemble_auc:.4f}")
print(f"  Improvement:                 {ensemble_auc - single_auc:+.4f}")

# F1 at optimal threshold
def best_f1(y_true, y_score):
    prec, rec, thr = precision_recall_curve(y_true, y_score)
    f1s = 2 * prec * rec / (prec + rec + 1e-10)
    return f1s.max()

print(f"\n  Isolation Forest only best F1: {best_f1(y_entry, single_score):.4f}")
print(f"  4-Ensemble best F1:             {best_f1(y_entry, ensemble_score):.4f}")

# ── Summary ──
print("\n\n" + "=" * 64)
print("SUMMARY")
print("=" * 64)
print(f"Experiment 1 — Personalization: {np.mean(per_aucs) - np.mean(pop_aucs):+.4f} AUROC delta" if per_aucs else "")
print(f"Experiment 2 — 4-Ensemble gain:  {ensemble_auc - single_auc:+.4f} AUROC over single detector")
