"""Check the patient dataset at every stage boundary for the simulated user."""
import json, sys, os, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, ROOT); os.chdir(ROOT)
from desktop import runtime_env; runtime_env.configure()
from daily_portal.dataset import build_user_records, dataset_report
from daily_portal import db
UID = sys.argv[1]; days = {d["date"]: d for d in json.load(open(os.path.join(HERE, "days.json")))}
recs = build_user_records(UID); ok = lambda c, m: print(("PASS " if c else "FAIL ") + m)
print("== Dataset handed to the pipeline")
ok(len(recs) == 30, f"one record per day: {len(recs)}")
ok([r["entry_date"] for r in recs] == sorted(days), "dates match the 30 real days, ascending")
ok(all("---" not in r["text"] and "\n" not in r["text"] for r in recs), "no separator lines / newlines inside a day's text")
ok(all(r["sleep_hours"] == days[r["entry_date"]]["sleep_hours"] and r["music_mood_score"] == days[r["entry_date"]]["music_mood_score"] for r in recs), "sleep/activity/mood carried through exactly")
voice_days = sorted(e["entry_date"] for e in db.get_recent_entries(UID, 100) if e["audio_path"])
ok(sorted(r["entry_date"] for r in recs if r["audio_features"]) == voice_days, f"stored audio features on the {len(voice_days)} voice-note days")
wa_day = sorted(days)[0]; ok("good day today" in next(r for r in recs if r["entry_date"] == wa_day)["text"], "WhatsApp message merged into its day")
ok(any("Loving the semester" in r["text"] for r in recs), "Reddit comment merged into its day")
ok(any("Update:" in r["text"] for r in recs), "Telegram message merged into its day")
print("== Stage 1 vectors stored in the DB")
rows = sorted(db.get_recent_entries(UID, 100), key=lambda e: e["entry_date"])
vecs = [np.array(json.loads(e["feature_vector"])) for e in rows]
ok(all(v.shape == (466,) and not np.isnan(v).any() for v in vecs), "30 x 466 features, no NaN")
gap = [v[435] for v in vecs]  # metadata block: hour sin, hour cos, gap days -> indices 433..435
ok(abs(gap[0]) < 1e-6 and all(abs(g - 1/30) < 1e-6 for g in gap[1:]), f"gap-days feature = 0 then 1/30 (consecutive days) (got {sorted(set(np.round(gap,3)))})")
ok(all(v[-11:].sum() == 11 for v, e in zip(vecs, rows) if e["audio_path"]) and all(v[-11:].sum() == 0 for v, e in zip(vecs, rows) if not e["audio_path"]), "audio presence mask set only on voice days")
print("== Stages 2-5 (in-process run on the same records)")
from pipeline_runner import run_pipeline
res = run_pipeline(UID, records=recs)
import pipeline_runner as pr; pipe = pr._shared_pipeline
cal = pipe.calibration_flags.get(UID, [])
ok(len(pipe.normalized_vectors[UID]) == 30, f"Stage 2: 30 normalized vectors")
ok(sum(cal) == 30 - 13, f"Stage 2: z-scoring starts once 14 days exist ({sum(cal)} of 30 z-scored)")
ok(len(res["anomaly_scores"]) == 30 and len(res["cusum_upper"]) == 30, "Stage 4: anomaly + CUSUM score per day")
ok(res["timestamps"] == sorted(days), "results indexed by the real dates")
ok(len(res["sleep_series"]) == 30 and len(res["activity_series"]) == 30 and len(res["music_series"]) == 30, "health series (30 each) reach the dashboard")
late = np.mean(res["sentiment_series"][-10:]); early = np.mean(res["sentiment_series"][:12])
ok(late < early, f"sentiment tracks the simulated decline (first 12 days {early:.2f} -> last 10 days {late:.2f})")
print("   Stage 5 risk:", res.get("risk_level") or res.get("prediction", {}).get("risk_level"), "| keys:", [k for k in res if 'forecast' in k][:5])
print("== Readiness report"); print(json.dumps(dataset_report(UID, True)["stages"], indent=0)[:900])
