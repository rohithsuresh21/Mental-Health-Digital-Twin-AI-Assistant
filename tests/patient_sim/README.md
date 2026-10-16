# 30-day patient simulation

Reproduces a real patient end to end against the running desktop app and checks the dataset at every stage.

```powershell
python tests\patient_sim\gen.py                 # 30 days of journal/sliders + WhatsApp, Telegram, Reddit exports
python desktop\launcher.py --no-window           # in another terminal (or have the app open)
python tests\patient_sim\drive.py sim_patient   # logs in as a patient, submits 30 check-ins, imports the 3 chats, runs analysis
python tests\patient_sim\verify_dataset.py sim_patient   # PASS/FAIL per stage
```
Put any short speech `.wav` next to the scripts as `voice.wav` to include voice notes on every 7th day.
Set `MHDT_SUBMIT_LIMIT` higher than 30 if you change the rate limit (default 60/hour).
