# Verification

Run against the app (`python desktop\launcher.py --no-window`) after `tests/patient_sim` has created a 30-day patient.

```powershell
python tests\verify\verify_models.py sim_patient     # model maths: calibration, risk bands, SHAP additivity, CUSUM states, forecast determinism
pip install playwright; python -m playwright install chromium
python tests\verify\verify_ui_guide.py sim_patient   # every number on Results / Why / Outlook vs the raw output + 28 Guide questions and where they navigate
```
Last run: models 17/17, UI + Guide 42/42.
