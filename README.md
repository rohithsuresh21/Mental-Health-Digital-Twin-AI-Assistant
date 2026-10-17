# Mental Health Digital Twin

An end-to-end mental health monitoring and early-warning system. It takes a user's daily journal entries (with optional audio, sleep, activity and mood data), converts them into a fixed-size numeric feature vector, builds a per-user baseline, detects anomalous and sustained changes, and produces an interpretable risk assessment with a forecast and explainable attributions. The pipeline is written in Python (PyTorch, PyTorch Lightning, XGBoost, scikit-learn) and served by a Flask backend.


## Install the desktop app (Windows 10/11)

The whole system (UI, Flask API and every ML model) runs **locally on your PC**, using your NVIDIA GPU when one is present. No cloud server, no data leaves the machine.

Open **PowerShell** and run:

```powershell
powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/rohithsuresh21/Mental-Health-Digital-Twin-AI-Assistant/main/desktop/install.ps1 | iex"
```

Or download `MentalHealthDigitalTwin-Setup-<version>.exe` from [Releases](https://github.com/rohithsuresh21/Mental-Health-Digital-Twin-AI-Assistant/releases/latest) and run it.

During setup a console window:
1. detects your NVIDIA driver and installs the matching PyTorch 2.6 build (CUDA 12.6 / 12.4 / 11.8, or CPU if there is no NVIDIA GPU),
2. installs the Python dependencies into the app's own embedded Python,
3. downloads the models once (GoEmotions RoBERTa, MiniLM, wav2vec2, Whisper base), about 3-4 GB in total with CUDA.

After that the app works offline. Start menu entries: **Mental Health Digital Twin**, **Repair runtime**, **Stop**, **Logs**. Installs per-user (no admin) to `%LOCALAPPDATA%\Programs\MentalHealthDigitalTwin`.

| Requirement | |
| --- | --- |
| OS | Windows 10/11 64-bit |
| Disk | ~8 GB free |
| RAM | 8 GB+ |
| GPU (optional) | NVIDIA with a recent driver; falls back to CPU automatically |

### Using it as a patient

1. Pick **Patient**, open **Clinical Patient Intake Portal**.
2. **Check-in** once a day: a few sentences about your day, optional `.wav` voice note (transcribed locally by Whisper), and sleep / activity / mood sliders. Missed a day? Pick its date.
3. **Import chats** (optional): WhatsApp `.txt` export, Telegram `result.json`, Reddit `comments.csv` / `posts.csv`. Only your own messages are kept and each is merged into the day it was sent.
4. **My data** shows your streak, a 5-week calendar, data sources, health trends and which AI stages are ready.
5. After **14 days** the personal baseline calibrates. Open **Analysis** → **Run my analysis** to run all five stages on your days (risk score, explanations, 7-day forecast; per-detector forecasts need 37 days).

6. Not sure what something means? Press **Ask the guide** (bottom right) or any **What's this?** link. The Guide explains every chart and term in plain words using your own numbers ("how was Oct 10?", "why is my score 41%?", "what happens next week?") and takes you straight to that part of the app. It runs offline, and for crisis messages it shows Tele-MANAS 14416 and 112.

Everything (database `app/data/daily_portal.db`, voice notes, models) stays in the install folder on your PC.

---

## 1. Pipeline Overview

The system is a five-stage processing pipeline with an explainability layer:

```
Inputs: journal text (+ optional audio, sleep, activity, mood)
    │
    ▼
Stage 1 · Feature Extraction ───────────► 466-dim feature vector per entry
    │
    ▼
Stage 2 · Personal Baseline & Temporal Binning ──► per-user normalisation
    │
    ├──────────────► Stage 3 · Time-Series Forecasting (14-day risk)
    │
    ▼
Stage 4 · Anomaly Detection ──────────────► 4-model ensemble + CUSUM + adaptive thresholds
    │
    ▼
Stage 5 · Clinical Risk Classification ──► XGBoost + probability calibration
    │
    ▼
Explainability · SHAP/TreeSHAP attributions
    │
    ▼
Outputs: risk score · 14-day forecast · feature attributions · medical summary PDF
```

Each entry is processed incrementally. As data accumulates, the personal baseline matures and the detectors adapt to what is normal for that specific person, rather than applying a fixed global rule.

---

## 2. Stage 1 — Feature Extraction (`Stage_1/`)

Every journal entry is converted into a fixed 466-dimensional vector. Text alone contributes 444 dimensions:

| Feature group | Dimensions | Description |
| --- | ---: | --- |
| SBERT sentence embedding | 384 | Semantic embedding of the full text |
| GoEmotions emotion probabilities | 28 | Probability over 28 emotion classes |
| VADER sentiment | 7 | Negative / neutral / positive / compound and derived statistics |
| Lexical diversity | 2 | TTR and MTLD vocabulary richness |
| Readability | 3 | Flesch, Flesch–Kincaid, and Automated Readability scores |
| First-person pronouns | 2 | Singular and plural pronoun ratios |
| Length | 3 | Sentence count, word count, average sentence length |
| Punctuation | 4 | Question, exclamation, ellipsis, and capitalisation ratios |
| Time metadata | 3 | Hour of day (sin/cos) and gap in days since last entry |
| Health + presence masks | 8 | Sleep / activity / mood values with presence masks |

If an audio recording is supplied, Whisper transcribes it and 11 audio features are added (speech rate, pause statistics, pitch and RMS statistics, and four speech-emotion probabilities), followed by an 11-dimensional mask marking which audio features are present. When no audio is available those blocks are zero-filled, so the output vector is always 466 dimensions (`Extract_features.py`, asserted in `unified_pipeline.py`).

---

## 3. Stage 2 — Personal Baseline & Temporal Binning (`stage_2/`)

- `baseline.py` — `UserBaseline` maintains a per-user baseline over a sliding window. It fits a normalisation scaler on the baseline window and exposes a calibration status describing how many entries are still needed before analysis is meaningful. The scaler is fit once the baseline window fills and is reused thereafter, so a stable personal frame of reference is established.
- `temporal_bin.py` — `TemporalBinning` routes each entry into time-of-day buckets (`morning` / `afternoon` / `evening` / `late night`), which provides temporal context for downstream models.

The normalised vectors produced here are the primary input to both the anomaly detectors and the Stage-5 classifier.

---

## 4. Stage 3 — Time-Series Forecasting (`stage_3/`)

- A Temporal Fusion Transformer (TFT) is trained with PyTorch Lightning / `pytorch-forecasting` on the entry history and produces a 14-day composite risk forecast.
- `single_user_pipeline.py` runs the complete Stage 1→2→3→4→5 flow for a single user, including per-detector 7-day forecasts.
- The model is trained on first use and its weights are persisted to `tft_checkpoint.ckpt`, so subsequent runs load the saved checkpoint instead of retraining.
- The forecast is consumed downstream by the anomaly pipeline (forecast residuals) and exposed as an output alongside detector forecasts.

---

## 5. Stage 4 — Anomaly Detection (`stage_4/`)

A weighted ensemble of four detectors that model different failure modes, plus a dedicated trend detector:

| Detector | Weight | What it detects |
| --- | ---: | --- |
| Mahalanobis Distance (`detectors/mahalanobis.py`) | 0.35 | Distance from the user's established behavioural baseline, taking feature covariance into account |
| Gaussian Copula (`detectors/copula.py`) | 0.35 | Unusual co-occurrence of behavioural changes across features |
| Isolation Forest (`detectors/isolation_forest.py`) | 0.15 | Individual entries that stand out from the user's typical pattern |
| K-Nearest Neighbours (`detectors/knn_detector.py`) | 0.15 | Whether recent entries fall inside the user's usual range of behaviour |
| CUSUM (`detectors/cusum.py`) | — | Sustained upward or downward drift away from the baseline, tracked separately |

Detection flow:

1. Each detector is fit on the user's baseline and produces a per-entry score.
2. Scores are normalised across the ensemble and combined into a single `overall_risk_score` (`anomaly_pipeline.py`); per-detector scores are kept for transparency.
3. **Adaptive thresholds** (`utils/thresholds.py`) replace a fixed cutoff with a rolling-window percentile. The effective threshold blends a nominal value with the observed score distribution:

   `T' = rate · P + (1 − rate) · T`

   where `P` is the nominal threshold and `T` is the current rolling percentile. Anomalous entries adapt roughly five times slower than normal ones (configurable), so genuine drift is not slowly absorbed into the baseline and re-flagged as normal.

---

## 6. Stage 5 — Clinical Risk Classification (`Stage_5/`)

- A Stage-5 feature vector is assembled from the last entries (`assemble_stage5_features` in `unified_pipeline.py`): mean / std / max / min over the recent window, the change between the early and late window, and the latest anomaly scores (overall risk score plus each detector). This yields a 2,336-dimension vector.
- An **XGBoost** classifier (`model.json`) maps this vector to a raw risk probability.
- The raw probability is calibrated before being reported. Three calibrators are implemented (`temperature.json`, `platt.pkl`):

  | Method | Notes |
  | --- | --- |
  | Temperature scaling | Default; single scalar temperature T = 1.9 divides the raw margin before the sigmoid |
  | Platt scaling | Sigmoid over the raw probability with fitted A / B parameters |
  | Isotonic regression | Non-parametric monotone mapping |

- Output: calibrated probability, raw probability, risk level (`LOW` / `MODERATE` / `HIGH`), and an intervention flag.

---

## 7. Explainability (`XAI/`)

- `XAI.py` — `SHAPExplainer` computes SHAP/TreeSHAP attributions over the assembled feature vector.
- `grouping.py` maps individual feature attributions onto human-readable concepts (sentiment, emotion, nervousness, remorse, and so on) and generates plain-language sentences describing which factors drove the risk score.

---

## 8. Inputs

Per journal entry:

| Input | Required | Description |
| --- | --- | --- |
| Journal text | Required | Free-form journal entry |
| Audio recording | Optional | Spoken check-in, transcribed with Whisper |
| Sleep hours | Optional | Self-reported hours slept |
| Sleep quality | Optional | Self-reported sleep quality |
| Activity level | Optional | Self-reported activity |
| Mood score | Optional | Self-reported mood indicator |

Entries are collected through the daily check-in portal (`daily_portal/`) or the batch testing datasets described in section 11.

---

## 9. Outputs

- **Per-entry**: 466-dimension feature vector, normalised vector, per-detector anomaly scores, and the combined `overall_risk_score` with anomaly flag.
- **Classification**: calibrated probability, raw probability, risk level, intervention flag.
- **Forecast**: 14-day composite risk forecast and per-detector 7-day forecasts.
- **Explanation**: grouped SHAP attributions and plain-language reasons for the score.
- **Report**: a medical summary PDF (`pdf_generator.py`) with the user profile, risk score, detector breakdown, and insights.

---

## 10. Configuration

Pipeline parameters are centralised in `stage_4/config.py`:

| Parameter | Default | Purpose |
| --- | ---: | --- |
| `ADAPTIVE_THRESHOLD` | `True` | Enable adaptive percentile thresholds |
| `THRESHOLD_PERCENTILE` | `97.0` | Rolling score percentile used as the threshold base |
| `THRESHOLD_WINDOW_SIZE` | `20` | Rolling window length (entries) |
| `THRESHOLD_ADAPTATION_RATE` | `0.2` | Threshold blend rate on normal entries |
| `THRESHOLD_ANOMALY_ADAPTATION_SCALE` | `0.2` | Multiplier that slows adaptation on anomalous entries |
| `DETECTOR_WEIGHTS` | 0.35 / 0.35 / 0.15 / 0.15 | Mahalanobis / Copula / Isolation Forest / KNN weights |
| `KNN_K` | 5 | Number of neighbours for the KNN detector |
| `COPULA_EPSILON` | 1e-6 | Regularisation for the copula precision matrix |
| `MAHALANOBIS_REGULARIZATION` | 1e-5 | Ridge on the Mahalanobis covariance matrix |

The default calibration method is temperature scaling with T = 1.9 (`Stage_5/temperature.json`).

---

## 11. Testing Datasets

Synthetic cohorts of 200 entries each, used to exercise and evaluate the pipeline end to end:

- `data/healthy_dataset_200.csv` — entries from healthy users
- `data/at_risk_dataset_200.csv` — entries from at-risk users
- `data/combination_dataset_200.csv` — mixed cohort
- `data/audio_healthy_200.csv`, `data/audio_at_risk_200.csv`, `data/audio_combined_200.csv` — audio-enriched versions
- `data/daily_portal.db` — SQLite store used by the daily check-in portal (created at runtime, not committed)

The Stage-5 classifier is trained on DAIC-WOZ clinical transcripts (`Stage_5/daic_loader.py`, `daic_label_generator.py`, `train.py`) rather than on these synthetic cohorts.

---

## 12. Development

Prerequisites: Python 3.12, Node.js 20+ (for the UI), optional NVIDIA GPU.

```powershell
python -m venv venv
venv\Scripts\activate
# GPU build of PyTorch (skip for CPU)
pip install torch==2.6.0 torchvision==0.21.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cu126
pip install -r requirements.txt

# build the UI once
cd "User Interface"; npm ci; npm run build; cd ..

# run the desktop app from source (UI + API on http://127.0.0.1:47821)
python desktop\launcher.py
```

For UI hot-reload, run `python app.py` (API on `:5000`) and `npm run dev` in `User Interface/` (proxies `/api` to Flask).
Set `MHDT_DEVICE=cpu` to force CPU inference.

---

## 13. Building & releasing the installer

```powershell
powershell -ExecutionPolicy Bypass -File desktop\build_installer.ps1 -Version 1.0.0
# -> build\desktop\output\MentalHealthDigitalTwin-Setup-1.0.0.exe
```

The script builds the React UI, bundles an embedded Python 3.12 + the app + model checkpoints, and compiles an Inno Setup installer (~100 MB). PyTorch and the models are fetched on the user's machine for their GPU.

**Automated release:** pushing a tag runs `.github/workflows/desktop-release.yml` on a Windows runner and attaches the installer to a GitHub Release (which the one-line install command downloads):

```bash
git tag v1.0.0
git push origin v1.0.0
```

How it works at runtime (`desktop/`):

| File | Role |
| --- | --- |
| `launcher.py` | Entry point: starts the local server, opens an Edge/Chrome app window, exits when it is closed |
| `server.py` | Waitress server: serves the built UI and maps `/api/*` to Flask on the same origin; loading screen while models load |
| `runtime_env.py` | Model caches, offline mode, persistent session key, paths |
| `setup_runtime.ps1` | Installs GPU-matched PyTorch, dependencies and models on the user's PC |
| `prefetch_models.py` | Downloads all HF / Whisper / NLTK models for offline use |
| `installer.iss` / `build_installer.ps1` | Inno Setup script and build script |
| `install.ps1` | One-line installer (downloads the latest release) |
| `../device_util.py` | Picks CUDA or CPU for every model |

---

## 14. Repository Structure

```
Mental-Health-Digital-Twin/
├── Stage_1/                 # Feature extraction (text + audio)
├── stage_2/                 # Personal baseline + temporal binning
├── stage_3/                 # TFT forecasting + single-user pipeline
├── stage_4/                 # Anomaly detectors + adaptive thresholds
│   ├── detectors/           #   mahalanobis, copula, isolation_forest, knn, cusum
│   └── utils/               #   thresholds, metrics, preprocessing
├── Stage_5/                 # XGBoost risk model + calibration artifacts
├── XAI/                     # SHAP/TreeSHAP explainability
├── daily_portal/            # Daily check-in portal (Flask blueprint)
├── data_parser/             # WhatsApp / Reddit / Telegram parsers
├── data/                    # Testing datasets (SQLite DB created at runtime)
├── unified_pipeline.py      # End-to-end journal pipeline
├── pipeline_runner.py       # Batch runner
├── pdf_generator.py         # Medical summary PDF
├── app.py                   # Flask backend
├── device_util.py           # CUDA / CPU device selection
├── desktop/                 # Windows desktop app: launcher, local server, installer
└── .github/workflows/       # CI: builds + releases the Windows installer
```

---

## 15. License

See [LICENSE](LICENSE).
