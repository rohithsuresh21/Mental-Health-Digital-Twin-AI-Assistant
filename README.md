# Mental Health Digital Twin

An end-to-end mental health monitoring and early-warning system. It takes a user's daily journal entries (with optional audio, sleep, activity and mood data), converts them into a fixed-size numeric feature vector, builds a per-user baseline, detects anomalous and sustained changes, and produces an interpretable risk assessment with a forecast and explainable attributions. The pipeline is written in Python (PyTorch, PyTorch Lightning, XGBoost, scikit-learn) and served by a Flask backend.

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
- `data/daily_portal.db` — SQLite store used by the daily check-in portal

The Stage-5 classifier is trained on DAIC-WOZ clinical transcripts (`Stage_5/daic_loader.py`, `daic_label_generator.py`, `train.py`) rather than on these synthetic cohorts.

---

## 12. Getting Started

Prerequisites: Python 3.10+ and a package manager for Python.

```bash
python -m venv venv
# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
python app.py
```

The Flask backend serves on `http://127.0.0.1:5000`. The web dashboard for the project is hosted on Vercel and connects to this backend through a Cloudflare tunnel (see section 13). `start_server.ps1` automates the local backend start plus tunnel setup.

---

## 13. Deployment

The dashboard is deployed as a static site on **Vercel**. `User Interface/vercel.json` rewrites `/api/(.*)` to the Flask backend and falls back to `index.html` for client-side routing. In a local demo, the backend runs on this machine and is exposed through a Cloudflare tunnel (`start_server.ps1`), with the Vercel rewrite pointing at the tunnel address so the hosted site reaches the local pipeline.

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
├── data/                    # Testing datasets + SQLite DB
├── unified_pipeline.py      # End-to-end journal pipeline
├── pipeline_runner.py       # Batch runner
├── pdf_generator.py         # Medical summary PDF
├── app.py                   # Flask backend
└── start_server.ps1         # Local demo launcher + tunnel
```

---

## 15. License

See [LICENSE](LICENSE).
