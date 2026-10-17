"""Verify the models' own answers on the 30-day patient: maths, consistency and determinism."""
import os, sys, json, numpy as np
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")); sys.path.insert(0, ROOT); os.chdir(ROOT)
from desktop import runtime_env; runtime_env.configure()
from scipy.special import expit
from daily_portal.dataset import build_user_records
from pipeline_runner import run_pipeline
import pipeline_runner as pr
UID = sys.argv[1]
ok = lambda c, m: print(("PASS " if c else "FAIL ") + m) or c
recs = build_user_records(UID)
res = run_pipeline(UID, records=recs); pipe = pr._shared_pipeline
pred = res["prediction"]
print("== Stage 5 risk model")
vecs = pipe.normalized_vectors[UID]; anoms = pipe.anomaly_scores[UID]
X = pipe.assemble_stage5_features(vecs, anoms)
margin = float(pipe.xgb_model.predict(np.array([X]), output_margin=True)[0])
ok(abs(expit(margin) - pred["probability_raw"]) < 1e-6, f"raw probability = sigmoid(model margin) ({pred['probability_raw']:.4f})")
T = pipe.temperature
ok(abs(expit(margin / T) - pred["probability"]) < 1e-6, f"calibrated probability = sigmoid(margin / T), T={T} ({pred['probability']:.4f})")
p = pred["probability"]; lvl = "LOW" if p < 0.33 else "MODERATE" if p < 0.67 else "HIGH"
ok(pred["risk_level"] == lvl, f"risk level {pred['risk_level']} matches band for {p:.3f}")
print("== TreeSHAP explanation")
import shap
ex = shap.TreeExplainer(pipe.xgb_model)(np.array([X]))
sv, base = ex.values[0], float(ex.base_values[0])
ok(abs(base + sv.sum() - margin) < 1e-3, f"additivity: base {base:.4f} + sum(SHAP) {sv.sum():.4f} = margin {margin:.4f}")
sx = res["shap_explanation"]
ok(abs(sx["base_value"] - base) < 1e-6, "explanation base value matches TreeExplainer")
top = sx["top_features"]
ok(all(abs(top[i]["abs_impact"]) >= abs(top[i + 1]["abs_impact"]) for i in range(len(top) - 1)), "top features sorted by impact")
ok(all((f["shap_value"] > 0) == (f["direction"] == "increases_risk") for f in top), "direction labels match SHAP sign")
print("== Stage 4 detectors + drift")
import requests
_s = requests.Session(); _s.post(os.environ.get("MHDT_URL", "http://127.0.0.1:47821") + "/api/auth/login", json={"user_id": UID, "role": "patient"})
api = _s.post(os.environ.get("MHDT_URL", "http://127.0.0.1:47821") + "/api/diagnose", json={}, timeout=900).json()
cs = api["cusum_status"]; up, lo = api["cusum_alert_upper"], api["cusum_alert_lower"]
ok(api["prediction"]["probability"] == res["prediction"]["probability"] or abs(api["prediction"]["probability"] - res["prediction"]["probability"]) < 1e-9, "API result equals in-process pipeline result")
exp_states = [4 if u and l else 2 if u else 3 if l else 1 for u, l in zip(up, lo)]
ok(cs["states"] == exp_states, "drift states follow the CUSUM upper/lower alerts day by day")
ok(all(0 <= a <= 1 for a in res["anomaly_scores"]), "unusualness scores within 0..1")
ds = res["detector_scores"]
ok(all(set(d) == {"mahalanobis", "copula", "isolation_forest", "knn"} for d in ds), "four detector scores every day")
late, early = np.mean(res["anomaly_scores"][-10:]), np.mean(res["anomaly_scores"][:10])
ok(late > early, f"simulated decline shows up as more unusual days (first 10: {early:.2f}, last 10: {late:.2f})")
print("== Stage 3 forecast")
fc1 = res["tft_forecast_14day"]
res2 = run_pipeline(UID, records=recs)
ok(np.allclose(fc1, res2["tft_forecast_14day"]), "forecast is deterministic across runs")
ok(len(fc1) == 7 and all(0 < v < 1 for v in fc1), "7 forecast values within 0..1")
ok(abs(res["composite_series"][-1] - fc1[0]) < 0.15, f"forecast starts near the last observed index ({res['composite_series'][-1]:.3f} -> {fc1[0]:.3f})")
print("== Stage 1/2 text signals")
from Stage_1.Extract_features import _get_vader
i = 5; r = recs[i]
m = pipe.user_data[UID] if hasattr(pipe, 'user_data') else None
ok(len(res["sentiment_series"]) == len(recs) == len(res["timestamps"]), "one sentiment value per day")
ok(res["emotions_series"][-3:] != [] and all(isinstance(e, str) for e in res["emotions_series"]), "emotion label every day")

