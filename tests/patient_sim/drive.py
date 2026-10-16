"""Drive the running app exactly like the patient UI does (same endpoints/fields), for 30 days."""
import json, os, sys, time, requests
os.chdir(os.path.dirname(os.path.abspath(__file__)))
B = os.environ.get("MHDT_URL", "http://127.0.0.1:47821") + "/api"; UID = sys.argv[1] if len(sys.argv) > 1 else "sim_patient"
s = requests.Session()
r = s.post(f"{B}/auth/login", json={"user_id": UID, "role": "patient"}); print("login", r.status_code)
rows = json.load(open("days.json")); report = {"submit": [], "import": {}}
for r_ in rows:
    data = {"user_id": UID, "entry_date": r_["date"], "text": r_["text"], **{k: r_[k] for k in ("sleep_hours","sleep_quality","activity_level","music_mood_score")}}
    files = {"audio": ("voice.wav", open("voice.wav","rb"), "audio/wav")} if r_["audio"] and os.path.exists("voice.wav") else None
    t = time.time(); x = s.post(f"{B}/daily/submit", data=data, files=files)
    report["submit"].append((r_["date"], x.status_code, x.json().get("calibration_progress") or x.json().get("error"), round(time.time()-t,1)))
for plat, fn, sub in [("whatsapp","WhatsApp Chat with Arjun.txt","text"),("telegram","result.json","text"),("reddit","comments.csv","comments")]:
    for name in (["Rohith"] + (["Rohith M S"] if plat=="whatsapp" else [])):
        x = s.post(f"{B}/daily/import-chat", data={"user_id": UID, "name": name, "platform": plat, "sub_type": sub}, files={"file": (fn, open(fn,"rb"))}).json()
        ents = x.get("entries", [])
        info = {"parsed": len(ents), "matched": x.get("matched_count"), "senders": x.get("senders"), "error": x.get("error")}
        if ents:
            c = s.post(f"{B}/daily/confirm-import", json={"user_id": UID, "entries": [dict(e, selected=True) for e in ents]}).json()
            info["confirm"] = c
        report["import"][f"{plat}:{name}"] = info
st = s.get(f"{B}/daily/status", params={"user_id": UID}).json()
report["status"] = {k: st.get(k) for k in ("entry_count","entries_needed","calibrated","calibration_progress")}
report["history_sources"] = sorted({h.get("entry_source","?") for h in st.get("history", [])})
t = time.time(); d = s.post(f"{B}/diagnose", json={"fullName": "Sim"}, timeout=1800)
dj = d.json()
report["diagnose"] = {"http": d.status_code, "secs": round(time.time()-t), "n_entries": dj.get("n_entries"), "first_dates": (dj.get("timestamps") or [])[:3],
    "last_dates": (dj.get("timestamps") or [])[-3:], "sleep_points": len(dj.get("sleep_series") or []), "risk": dj.get("risk_level") or (dj.get("prediction") or {}).get("risk_level"), "error": dj.get("error")}
json.dump(report, open(f"report_{UID}.json","w"), indent=1, default=str); print(json.dumps(report, indent=1, default=str)[-3000:])
