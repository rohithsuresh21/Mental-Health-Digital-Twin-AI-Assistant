# Mental Health Digital Twin

An end-to-end mental health monitoring and early-warning system that builds a **personalized digital twin** of a user from daily journal entries and behavioural signals. The system ingests unstructured text and optional audio, encodes it into a structured feature space, establishes a per-user baseline, detects anomalous and sustained changes, and produces an interpretable clinical risk assessment with forecasts and explainable attributions — surfaced through an interactive analytics dashboard and an exportable medical summary PDF.

---

## 1. Overview

The system is organised as a five-stage processing pipeline plus an explainability layer:

```
Raw Inputs (text, audio, sleep, activity, mood)
        │
        ▼
Stage 1 · Feature Extraction ──► 466-dim feature vector per entry
        │
        ▼
Stage 2 · Personal Baseline & Temporal Binning ──► per-user normalisation
        │
        ├───────────────► Stage 3 · TFT Time-Series Forecast (14-day risk)
        │
        ▼
Stage 4 · Anomaly Detection ──► 4-model ensemble + CUSUM drift + adaptive thresholds
        │
        ▼
Stage 5 · Clinical Risk Classification ──► XGBoost + probability calibration
        │
        ▼
XAI · SHAP/TreeSHAP explanations ──► interpretable attributions
        │
        ▼
Output · Analytics dashboard + 14-day forecast + explainable report + PDF medical summary
```

Each journal entry is processed incrementally; as data accumulates, the personal baseline matures and the detectors adapt to what is "normal" for that specific person.

---

## 2. Pipeline Stages

### Stage 1 — Feature Extraction (`Stage_1/`)

Converts each journal entry into a fixed 466-dimensional vector. Text features total 444 dimensions:

| Feature group | Dimensions |
| --- | ---: |
| SBERT sentence embedding | 384 |
| GoEmotions emotion probabilities | 28 |
| VADER sentiment (neg / neu / pos / compound + derived) | 7 |
| Lexical diversity | 2 |
| Readability metrics | 3 |
| First-person pronoun usage | 2 |
| Length features | 3 |
| Punctuation features | 4 |
| Time metadata | 3 |
| Health features + masks | 8 |

Optional audio (Whisper transcription + acoustic features + speech emotion recognition) contributes 11 dimensions, followed by an 11-dimensional presence mask. When no audio is provided the audio block is zero-filled and the mask set to 0, so the output vector is always **466 dimensions**.

### Stage 2 — Personal Baseline & Temporal Binning (`stage_2/`)

- `UserBaseline` maintains a per-user baseline over a sliding window, fits a normalisation scaler, and exposes calibration status (how many entries are needed before analysis becomes meaningful).
- `TemporalBinning` routes each entry into time-of-day buckets, enabling temporal context in downstream modelling.

### Stage 3 — Time-Series Forecasting (`stage_3/`)

- A **Temporal Fusion Transformer (TFT)** trained with PyTorch Lightning / `pytorch-forecasting` produces a 14-day composite risk forecast from the entry history.
- `single_user_pipeline.py` runs the full Stage 1→2→3→4→5 flow for one user, including per-detector forecasting.
- The TFT is trained on first use and persists a checkpoint to `tft_checkpoint.ckpt`.

### Stage 4 — Anomaly Detection (`stage_4/`)

A weighted ensemble of four complementary detectors plus a dedicated trend detector:

| Detector | Detects | Weight |
| --- | --- | ---: |
| Mahalanobis Distance | Distance from the user's established behavioural baseline | 0.35 |
| Gaussian Copula | Unexpected co-occurrence of behavioural changes | 0.35 |
| Isolation Forest | Individual days that stand out from typical patterns | 0.15 |
| K-Nearest Neighbours | Whether recent patterns fit the user's usual range | 0.15 |
| CUSUM (upper / lower) | Sustained upward / downward drift away from baseline | — |

Key design points:

- **Adaptive thresholds** (`stage_4/utils/thresholds.py`): a rolling-window percentile engine blends a nominal threshold with the observed score distribution (`T' = rate·P + (1−rate)·T`). Anomalous days adapt roughly five times slower than normal days, so genuine drift is not absorbed into the baseline. Configurable via `stage_4/config.py` (window size 20, percentile 97, adaptation rate 0.2).
- Detector scores are normalised and combined into a single `overall_risk_score`; the pipeline reports per-detector scores for transparency.

### Stage 5 — Clinical Risk Classification (`Stage_5/`)

- An **XGBoost** classifier (trained on DAIC-WOZ–style clinical data, `model.json`) maps the assembled 2,336-dimension feature vector to a raw risk probability.
- The raw probability is **calibrated** before use. Three calibrators are available:
  - **Temperature scaling** (default, T = 1.9, `temperature.json`)
  - **Platt scaling** (`platt.pkl`)
  - **Isotonic regression**
- Output includes the calibrated probability, raw probability, risk level (LOW / MODERATE / HIGH), and an intervention recommendation.

### Explainability (XAI / `XAI/`)

- `SHAPExplainer` computes SHAP/TreeSHAP attributions over the assembled features, groups them into human-readable concepts (sentiment, emotion, nervousness, remorse, etc.), and generates plain-language explanations of what drove the risk score.

---

## 3. Outputs

### Analytics dashboard (`User Interface/src/App.tsx`)

The dashboard presents the full diagnostic picture:

1. **Overall risk** — composite score, risk scale with position marker, check-in recommendation.
2. **Emotional Tone & Risk Trajectory** — deviation score per entry over time with zoom/scroll and hover inspection.
3. **Personal Baseline** — calibration progress, baseline status, and whether recent entries are drifting.
4. **Sustained Change (CUSUM)** — upper/lower drift charts with alert threshold, plus a live drift banner.
5. **What's Driving That Signal** — per-detector scores, time mode (daily/weekly/monthly), contribution breakdown, and a learn-more info panel per detector.
6. **Risk Forecast** — TFT 14-day composite forecast and per-detector 7-day trajectories.
7. **Explainable Analysis** — TreeSHAP feature attributions and plain-language insights.
8. **Technical Details** — raw vs. calibrated probability and calibration shift for transparency.

### Medical summary PDF

A compiled medical summary (patient profile, risk score, detector breakdown, insights) is generated on demand via the `/generate-pdf` endpoint (`pdf_generator.py`).

### Runtime logs

User activity is logged to `data/user_activity.xlsx`; application state (baselines, vectors, anomaly scores) is held in memory per session and persisted to SQLite (`data/daily_portal.db`) for the daily check-in portal.

---

## 4. Repository Structure

```
Mental-Health-Digital-Twin/
├── Stage_1/                 # Feature extraction (text + audio)
├── stage_2/                 # Personal baseline + temporal binning
├── stage_3/                 # TFT forecasting + single-user pipeline
├── stage_4/                 # Anomaly detectors + adaptive thresholds + forecasting
│   ├── detectors/           #   mahalanobis, copula, isolation_forest, knn, cusum
│   └── utils/               #   thresholds, metrics, preprocessing
├── Stage_5/                 # XGBoost risk model + calibration artifacts
├── XAI/                     # SHAP/TreeSHAP explainability
├── data/                    # Synthetic journal datasets + SQLite DB
├── daily_portal/            # Daily check-in portal (Flask blueprint)
├── data_parser/             # WhatsApp / Reddit / Telegram parsers
├── User Interface/          # React (Vite) frontend
├── app.py                   # Flask backend (REST API + serving)
├── unified_pipeline.py      # End-to-end journal pipeline
├── pipeline_runner.py       # Batch runner
├── pdf_generator.py         # Medical summary PDF
└── start_server.ps1         # Local demo launcher
```

---

## 5. Inputs

Per journal entry:

| Input | Required | Description |
| --- | --- | --- |
| Journal text | Yes | Free-form user journal entry |
| Audio recording | No | Spoken check-in, transcribed with Whisper |
| Sleep hours / quality | No | Self-reported sleep |
| Activity level | No | Self-reported activity |
| Music mood score | No | Mood indicator |

The daily check-in portal (`daily_portal/`) collects these inputs; batch datasets in `data/` (healthy / at-risk synthetic cohorts of 200 entries each) are used for development and evaluation.

---

## 6. Getting Started

### Prerequisites

- Python 3.10+ (tested on 3.12)
- Node.js 18+ (tested with npm)

### Backend

```bash
python -m venv venv
# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
python app.py
```

The Flask backend serves on `http://127.0.0.1:5000`.

### Frontend

```bash
cd "User Interface"
npm install
npm run dev
```

The Vite dev server runs on `http://localhost:3000`.

### Running the full pipeline standalone

```python
from unified_pipeline import UnifiedJournalPipeline

pipe = UnifiedJournalPipeline()
pipe.process_entry(
    user_id="u1",
    text="Today was a rough day...",
    timestamp=pd.Timestamp("2026-01-15 09:00:00"),
    sleep_hours=5.2, sleep_quality=0.4,
    activity_level=0.3, music_mood_score=0.5,
)

# Assemble the Stage-5 vector from accumulated normalized vectors + anomaly scores
feature_vec = pipe.assemble_stage5_features(
    pipe.normalized_vectors["u1"],
    pipe.anomaly_scores.get("u1", []),
)
prediction = pipe.predict_classification(feature_vec)
```

### Local demo launcher

`start_server.ps1` starts the Flask backend and (optionally) exposes it through a Cloudflare tunnel for the hosted frontend.

---

## 7. Configuration

Pipeline parameters live in `stage_4/config.py`:

| Parameter | Default | Purpose |
| --- | ---: | --- |
| `ADAPTIVE_THRESHOLD` | `True` | Enable adaptive percentile thresholds |
| `THRESHOLD_PERCENTILE` | `97.0` | Rolling score percentile used as threshold base |
| `THRESHOLD_WINDOW_SIZE` | `20` | Rolling window length (entries) |
| `THRESHOLD_ADAPTATION_RATE` | `0.2` | Threshold blend rate on normal days |
| `THRESHOLD_ANOMALY_ADAPTATION_SCALE` | `0.2` | Slower blend rate on anomalous days |
| `DETECTOR_WEIGHTS` | 0.35 / 0.35 / 0.15 / 0.15 | Ensemble weighting (Mahalanobis / Copula / Isolation Forest / KNN) |

Calibration artifacts (`temperature.json`, `platt.pkl`) live in `Stage_5/`; the default calibration method is **temperature scaling** (T = 1.9).

---

## 8. API Endpoints (Flask backend)

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/auth/login` · `/auth/logout` · `/auth/verify` | POST / POST / GET | Session management |
| `/auth/avatar` | POST / GET | Upload / retrieve avatar |
| `/user-activity` | POST | Log user activity |
| `/diagnose` | POST | Full pipeline diagnostic for a user |
| `/forecast-detectors` | POST | Per-detector 7-day forecasts |
| `/generate-pdf` | POST | Medical summary PDF |
| `/run` | POST | Run full analysis (supports file upload) |
| `/api/explain` | POST | SHAP/TreeSHAP explanation |
| `/internal/feature-extractor` | POST | Stage 1 feature extraction |
| `/internal/risk-calculator` | POST | Risk classification |
| `/internal/calibration` | POST | Re-classify with a chosen calibration method |
| `/internal/forecaster` · `/internal/consensus` · `/internal/test-vector` | POST | Forecast, ensemble, and test internals |
| `/internal/explainer` | POST | Explainability internals |

The Express server in `User Interface/server.ts` proxies `/api/*` to the Flask backend (default `http://127.0.0.1:5000`) and forwards diagnosis requests via `src/diagnosisEngine.ts`.

---

## 9. Datasets

- `data/healthy_dataset_200.csv` — 200 synthetic entries from healthy users
- `data/at_risk_dataset_200.csv` — 200 synthetic entries from at-risk users
- `data/combination_dataset_200.csv`, `data/audio_*_200.csv` — combined / audio-enriched cohorts
- `data/daily_portal.db` — SQLite store for the daily check-in portal

---

## 10. License

See [LICENSE](LICENSE).
