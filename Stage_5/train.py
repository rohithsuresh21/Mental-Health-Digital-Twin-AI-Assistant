import json
import numpy as np
import pickle
import xgboost as xgb
from sklearn.metrics import roc_auc_score
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from scipy.special import expit
from sklearn.metrics import f1_score
X = np.load("X_train.npy")
y = np.load("y_train.npy")
X_train, X_val, y_train, y_val = train_test_split(
    X, y,test_size=0.2, random_state=42,stratify=y)
pos_weight = (y_train==0).sum() / max(1, (y_train==1).sum())
model = xgb.XGBClassifier(
    n_estimators = 300,
    max_depth = 4,
    learning_rate = 0.05,
    subsample = 0.8,
    colsample_bytree = 0.8,
    gamma = 0.1,
    reg_lambda = 1.0,
    scale_pos_weight = pos_weight,
    objective = "binary:logistic",
    eval_metric = "auc",
    random_state = 42,
    n_jobs = -1
)
model.fit(
    X_train, y_train,
    eval_set = [(X_val, y_val)],
    verbose = 50,
    early_stopping_rounds = 30
)
val_probs = model.predict_proba(X_val)[:,1]
auroc = roc_auc_score(y_val, val_probs)
print(f"Validation AUROC: {auroc:.4f}")
val_preds = (val_probs >= 0.5).astype(int)
f1 = f1_score(y_val, val_preds, zero_division=0)
print(f"Validation F1 score: {f1:.4f}")
def compute_ece(y_true, y_prob, n_bins=10):
    bins = np.linspace(0, 1, n_bins+1)
    ece = 0.0
    n = len(y_true)
    for i in range(n_bins):
        if i == n_bins - 1:
            mask = (y_prob >= bins[i]) & (y_prob <= bins[i+1])
        else:
            mask = (y_prob >= bins[i]) & (y_prob < bins[i+1])
        if mask.sum() == 0:
            continue
        acc = y_true[mask].mean()
        conf = y_prob[mask].mean()
        ece += (mask.sum() / n) * abs(acc - conf)
    return ece
ece_raw = compute_ece(y_val, val_probs)
print(f"ECE brfore calibration: {ece_raw:.4f}")
iso = IsotonicRegression(out_of_bounds="clip")
iso.fit(val_probs, y_val)
cal_iso = iso.predict(val_probs)
ece_iso = compute_ece(y_val, cal_iso)
auroc_iso = roc_auc_score(y_val, cal_iso)
print(f"AUROC after isotonic: {auroc_iso:.4f}")
print(f"ECE after isotonic: {ece_iso:.4f}")
eps = 1e-7
logits = np.log((val_probs + eps) / (1 - val_probs + eps))
lr = LogisticRegression(C=1e10)
lr.fit(logits, y_val)
A = lr.coef_[0][0]
B = lr.intercept_[0]
cal_platt = expit(A * val_probs + B)
ece_platt = compute_ece(y_val, cal_platt)
auroc_platt = roc_auc_score(y_val, cal_platt)
print(f"AUROC after Platt: {auroc_platt:.4f}")
print(f"ECE after Platt: {ece_platt:.4f}")
print(f"A={A:.4f}, B={B:.4f}")
model.save_model("model.json")
with open("isotonic.pkl", "wb") as f:
    pickle.dump(iso, f)
with open("platt.pkl", "wb") as f:
    pickle.dump({"A": A,"B":B}, f)
print("model.json saved")
print("isotonic.pkl saved")
print("platt.pkl saved")