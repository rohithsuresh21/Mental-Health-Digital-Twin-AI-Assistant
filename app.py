import os, json, sys, traceback, tempfile, time
from pathlib import Path
from datetime import datetime
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 32 * 1024 * 1024
CORS(app)

from unified_pipeline import UnifiedJournalPipeline
_pipeline = UnifiedJournalPipeline()

from daily_portal.routes import daily
from daily_portal.db import init_db
init_db()
app.register_blueprint(daily)

CUSUM_STATUS_TEXT = {
    1: {
        "state": "stable",
        "title": "Within your normal range",
        "message": "Everything looks normal. Your current patterns are staying within your usual range. Keep maintaining your healthy routine.",
    },
    2: {
        "state": "upper_alert",
        "title": "Drifting above baseline",
        "message": "We've noticed your readings are moving above your normal range. This may indicate your well-being is changing. Consider taking a moment to rest and monitor your condition.",
    },
    3: {
        "state": "lower_alert",
        "title": "Drifting below baseline",
        "message": "Your readings are lower than your usual range. This could mean your body is calming down or responding differently than usual. Continue monitoring to ensure everything remains on track.",
    },
    4: {
        "state": "both_alert",
        "title": "Unusual oscillation detected",
        "message": "Your readings are fluctuating above and below your normal range. This unusual pattern may require closer attention. Keep monitoring your condition and consider seeking guidance if it continues.",
    },
}


def classify_cusum_state(alert_upper: bool, alert_lower: bool) -> int:
    """Map a pair of CUSUM alert flags to one of the four states above."""
    if alert_upper and alert_lower:
        return 4
    if alert_upper:
        return 2
    if alert_lower:
        return 3
    return 1


def build_cusum_status(cusum_alert_upper: list, cusum_alert_lower: list, timestamps: list = None) -> dict:
    states = [
        classify_cusum_state(u, l)
        for u, l in zip(cusum_alert_upper, cusum_alert_lower)
    ]
    latest_code = states[-1] if states else 1
    latest = CUSUM_STATUS_TEXT[latest_code]

    alert_indices = [i for i, s in enumerate(states) if s != 1]
    had_alert_history = len(alert_indices) > 0
    last_alert_index = alert_indices[-1] if had_alert_history else None
    last_alert_code = states[last_alert_index] if had_alert_history else None
    last_alert_date = (
        timestamps[last_alert_index]
        if had_alert_history and timestamps and last_alert_index < len(timestamps)
        else None
    )

    result = {
        "states": states,
        "current_code": latest_code,
        "current_state": latest["state"],
        "current_title": latest["title"],
        "current_message": latest["message"],
        "had_alert_history": had_alert_history,
    }

    if had_alert_history and latest_code == 1:
        last_alert_state = CUSUM_STATUS_TEXT[last_alert_code]["state"].replace("_", " ")
        result["current_state"] = "recovered"
        result["current_title"] = "Back within your normal range"
        date_part = f" around {last_alert_date}" if last_alert_date else ""
        result["current_message"] = (
            f"You're currently within your usual range. There was a notable {last_alert_state}{date_part} "
            "before things returned to baseline — worth keeping in mind alongside the current stability."
        )
        result["last_alert_date"] = last_alert_date
        result["last_alert_state"] = last_alert_state

    return result

HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mental Health Digital Twin</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:       #0a0a0a;
    --surface:  #111111;
    --border:   #1f1f1f;
    --muted:    #3a3a3a;
    --text:     #d4d4d4;
    --dim:      #6b6b6b;
    --accent:   #e2e2e2;
    --blue:     #4a90d9;
    --red:      #c0392b;
    --green:    #27ae60;
    --amber:    #d4a017;
    --purple:   #7b68ee;
  }

  body {
    font-family: 'Inter', system-ui, sans-serif;
    background: var(--bg);
    color: var(--text);
    font-size: 14px;
    line-height: 1.6;
    min-height: 100vh;
  }

  header {
    padding: 32px 48px 24px;
    border-bottom: 1px solid var(--border);
  }
  header h1 {
    font-size: 18px;
    font-weight: 500;
    color: var(--accent);
    letter-spacing: -0.01em;
  }
  header p {
    font-size: 12px;
    color: var(--dim);
    margin-top: 4px;
  }

  .container { max-width: 960px; margin: 0 auto; padding: 40px 24px; }

  .section { margin-bottom: 48px; }
  .section-label {
    font-size: 11px;
    font-weight: 500;
    color: var(--dim);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 20px;
  }

  .upload-area {
    border: 1px dashed var(--muted);
    border-radius: 6px;
    padding: 48px 32px;
    text-align: center;
    cursor: pointer;
    transition: border-color .2s;
  }
  .upload-area:hover { border-color: var(--dim); }
  .upload-area p { color: var(--dim); font-size: 13px; }
  .upload-area strong { color: var(--text); }
  input[type=file] { display: none; }

  .field {
    margin-top: 16px;
  }
  .field label { display: block; font-size: 12px; color: var(--dim); margin-bottom: 6px; }
  .field input {
    width: 100%;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 9px 12px;
    color: var(--text);
    font-size: 13px;
    font-family: inherit;
    outline: none;
    transition: border-color .15s;
  }
  .field input:focus { border-color: var(--muted); }

  .actions { display: flex; gap: 10px; margin-top: 16px; flex-wrap: wrap; }
  .btn {
    padding: 8px 20px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--surface);
    color: var(--text);
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
    transition: background .15s, border-color .15s;
  }
  .btn:hover { background: var(--border); border-color: var(--muted); }
  .btn-primary { background: var(--accent); color: #000; border-color: var(--accent); font-weight: 500; }
  .btn-primary:hover { background: #c8c8c8; border-color: #c8c8c8; }

  #status {
    margin-top: 14px;
    font-size: 12px;
    color: var(--dim);
    min-height: 18px;
  }
  .spinner {
    display: inline-block;
    width: 12px; height: 12px;
    border: 1.5px solid var(--muted);
    border-top-color: var(--text);
    border-radius: 50%;
    animation: spin .7s linear infinite;
    vertical-align: middle;
    margin-right: 6px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  #results { display: none; }

  .divider {
    border: none;
    border-top: 1px solid var(--border);
    margin: 48px 0;
  }

  /* Risk block */
  .risk-block {
    display: flex;
    align-items: flex-start;
    gap: 40px;
    flex-wrap: wrap;
    padding: 28px 0;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
  }
  .risk-main .level {
    font-size: 36px;
    font-weight: 300;
    letter-spacing: -0.02em;
    line-height: 1;
  }
  .risk-main .sublabel { font-size: 11px; color: var(--dim); margin-top: 6px; }
  .risk-stats { display: flex; gap: 32px; flex-wrap: wrap; }
  .stat { }
  .stat .val { font-size: 22px; font-weight: 300; letter-spacing: -0.02em; }
  .stat .lbl { font-size: 11px; color: var(--dim); margin-top: 3px; }

  .col-low      { color: var(--green); }
  .col-moderate { color: var(--amber); }
  .col-high     { color: var(--red); }
  .col-blue     { color: var(--blue); }
  .col-purple   { color: var(--purple); }
  .col-dim      { color: var(--dim); }

  /* Charts */
  .chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
  .chart-wrap canvas { max-height: 200px; }
  .chart-label { font-size: 12px; color: var(--dim); margin-bottom: 10px; }

  /* Emotions */
  .emotion-list { display: flex; flex-wrap: wrap; gap: 8px; }
  .em-tag {
    font-size: 12px;
    padding: 3px 10px;
    border-radius: 2px;
    border: 1px solid var(--border);
    color: var(--dim);
  }
  .em-neg { border-color: #3a1a1a; color: #c0392b; }
  .em-pos { border-color: #1a2e1a; color: #27ae60; }

  /* Intervention note */
  .note {
    font-size: 12px;
    color: var(--dim);
    border-left: 2px solid var(--muted);
    padding-left: 12px;
    margin-top: 20px;
    line-height: 1.7;
  }
  .note.warn { border-color: var(--red); color: #a0522d; }
  .note.ok   { border-color: var(--green); color: #2e7d52; }

  /* CUSUM status banner */
  .cusum-banner {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 18px 20px;
    border-radius: 6px;
    border: 1px solid var(--border);
    margin-bottom: 24px;
  }
  .cusum-banner .dot {
    width: 10px; height: 10px;
    border-radius: 50%;
    margin-top: 4px;
    flex-shrink: 0;
  }
  .cusum-banner .body .title { font-size: 13px; font-weight: 500; color: var(--accent); margin-bottom: 4px; }
  .cusum-banner .body .msg   { font-size: 12.5px; color: var(--dim); line-height: 1.7; }
  .cusum-stable  { border-color: #1a2e1a; } .cusum-stable  .dot { background: var(--green); }
  .cusum-upper   { border-color: #3a1a1a; } .cusum-upper   .dot { background: var(--red); }
  .cusum-lower   { border-color: #16283a; } .cusum-lower   .dot { background: var(--blue); }
  .cusum-both    { border-color: #2e2a1a; } .cusum-both    .dot { background: var(--purple); }
  .cusum-recovered { border-color: #2e2a1a; } .cusum-recovered .dot { background: var(--amber); }

  .progress-bar {
    width: 100%;
    height: 6px;
    background: var(--border);
    border-radius: 3px;
    overflow: hidden;
    margin-top: 10px;
  }
  .progress-fill {
    height: 100%;
    background: var(--blue);
    transition: width .3s;
  }

  .score-badge {
    display: inline-block;
    font-size: 12px;
    font-weight: 500;
    padding: 3px 10px;
    border-radius: 4px;
    border: 1px solid;
    white-space: nowrap;
  }

  .scale-legend { margin-top: 18px; }
  .scale-bar {
    display: flex;
    border-radius: 4px;
    overflow: hidden;
    height: 10px;
  }
  .scale-bar div { flex: 1; }
  .scale-labels {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: var(--dim);
    margin-top: 6px;
  }

  details.section { margin-bottom: 24px; }
  details.section > summary {
    list-style: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 0;
  }
  details.section > summary::-webkit-details-marker { display: none; }
  details.section > summary::after {
    content: "+";
    color: var(--dim);
    font-size: 16px;
    margin-left: 12px;
  }
  details.section[open] > summary::after { content: "\2212"; }
  details.section > summary .section-label { margin-bottom: 0; }
  details.section .section-body { margin-top: 20px; }

  .detector-card {
    border: 1px solid var(--border);
    border-radius: 6px;
    margin-bottom: 14px;
  }
  .detector-card summary {
    list-style: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
  }
  .detector-card summary::-webkit-details-marker { display: none; }
  .detector-card summary::after {
    content: "+";
    color: var(--dim);
    font-size: 16px;
    margin-left: 12px;
  }
  .detector-card[open] summary::after { content: "\2212"; }
  .detector-card .det-name { font-size: 13px; color: var(--accent); font-weight: 500; }
  .detector-card .det-summary { font-size: 11.5px; color: var(--dim); margin-top: 3px; }
  .detector-card .det-body { padding: 0 20px 20px; border-top: 1px solid var(--border); }
  .axis-caption { font-size: 11px; color: var(--dim); margin-top: 8px; line-height: 1.6; }

  @media (max-width: 600px) {
    .chart-grid { grid-template-columns: 1fr; }
    .risk-block { flex-direction: column; gap: 24px; }
    header { padding: 24px 20px 18px; }
  }
</style>
</head>
<body>

<header>
  <h1>Mental Health Digital Twin</h1>
  <p>A quiet look at how you've been doing lately, based on what you've written.</p>
</header>

<div class="container">

  <div class="section" id="uploadSection">
    <div class="section-label">Share your entries</div>
    <div class="upload-area" id="dropZone" onclick="document.getElementById('fileInput').click()">
      <p id="dropLabel"><strong>Click to upload</strong> &nbsp;or drag and drop</p>
      <p style="margin-top:6px;font-size:11px;">CSV &middot; JSON &middot; TXT &middot; PDF &middot; DOCX</p>
    </div>
    <input type="file" id="fileInput" accept=".csv,.json,.txt,.pdf,.docx,.doc">

    <div class="field">
      <label>User ID</label>
      <input type="text" id="userId" value="rohith_ms" placeholder="e.g. patient_001">
    </div>

    <div class="actions">
      <button class="btn btn-primary" onclick="submitFile()">Run analysis</button>
      <button class="btn" onclick="runDemo(false)">Demo &mdash; healthy arc</button>
      <button class="btn" onclick="runDemo(true)">Demo &mdash; declining arc</button>
    </div>

    <div id="status"></div>
  </div>

  <div id="results">
    <hr class="divider">

    <div class="section">
      <div class="section-label">How you're doing</div>
      <div class="risk-block">
        <div class="risk-main">
          <div class="level" id="riskLevel">—</div>
          <div class="sublabel">overall picture</div>
        </div>
        <div class="risk-stats" id="riskStats"></div>
      </div>
      <div class="note" id="interventionNote"></div>

      <div class="scale-legend">
        <div class="chart-label" style="margin-bottom:8px;">
          What the scores on this page mean, from 0 (calmest) to 1 (most concerning)
        </div>
        <div class="scale-bar">
          <div style="background:#27ae60;"></div>
          <div style="background:#4bbf73;"></div>
          <div style="background:#4a90d9;"></div>
          <div style="background:#d4a017;"></div>
          <div style="background:#e08b2f;"></div>
          <div style="background:#d9534f;"></div>
          <div style="background:#c0392b;"></div>
        </div>
        <div class="scale-labels">
          <span>Excellent</span><span>Healthy</span><span>Stable</span>
          <span>Slight concern</span><span>Moderate</span><span>High</span><span>Critical</span>
        </div>
      </div>
    </div>

    <hr class="divider">

    <details class="section" open>
      <summary><div class="section-label">Mood and risk over time</div></summary>
      <div class="section-body">
        <div class="chart-grid">
          <div class="chart-wrap">
            <div class="chart-label">How your tone has shifted day to day</div>
            <canvas id="sentimentChart"></canvas>
            <div class="axis-caption">Each point is one journal entry, in order by date (X-axis). The Y-axis is the sentiment of that entry's writing, from -1 (very negative tone) to +1 (very positive tone), with 0 being neutral.</div>
          </div>
          <div class="chart-wrap">
            <div class="chart-label">Moments that stood out as unusual</div>
            <canvas id="anomalyChart"></canvas>
            <div class="axis-caption">Each point is one journal entry, in order by date (X-axis). The Y-axis is how unusual that entry looked compared to this person's own typical pattern, from 0 (completely typical) to 1 (very unusual).</div>
          </div>
        </div>
      </div>
    </details>

    <details class="section">
      <summary><div class="section-label">Your personal baseline</div></summary>
      <div class="section-body">
        <div class="chart-label" style="margin-bottom:10px;">
          This shows how well the system has learned what's "normal" for this specific person, and whether recent entries are drifting away from that.
        </div>
        <div class="cusum-banner" id="baselineBanner">
          <div class="dot"></div>
          <div class="body">
            <div class="title" id="baselineTitle">—</div>
            <div class="msg" id="baselineMessage"></div>
          </div>
        </div>
        <div class="chart-label" id="calibrationLabel" style="margin-bottom:6px;"></div>
        <div class="progress-bar"><div class="progress-fill" id="calibrationFill" style="width:0%;"></div></div>
      </div>
    </details>

    <details class="section">
      <summary><div class="section-label">Trend stability (CUSUM)</div></summary>
      <div class="section-body">
        <div class="cusum-banner" id="cusumBanner">
          <div class="dot"></div>
          <div class="body">
            <div class="title" id="cusumTitle">—</div>
            <div class="msg" id="cusumMessage"></div>
          </div>
        </div>
        <div class="chart-label" style="margin-bottom:14px;">
          A running tally of how far this person's readings have drifted above (red) or below (blue) their own baseline, added up over time rather than looked at one entry at a time. This makes it easier to tell a real sustained shift apart from one noisy day.
        </div>
        <canvas id="cusumChart" style="max-height:220px;"></canvas>
        <div class="axis-caption">X-axis: date of each entry. Y-axis: cumulative drift score — the dashed line is the alert threshold. Crossing it means the drift has been sustained, not just a single unusual entry.</div>
      </div>
    </details>

    <details class="section">
      <summary><div class="section-label">What's driving that signal</div></summary>
      <div class="section-body">
        <div class="chart-label" style="margin-bottom:14px;">
          These four methods each define "unusual" differently, so they can disagree — that's expected, not a bug. The number to actually trust is the "Moments that stood out as unusual" chart above, which already combines all four. What's below explains why that combined number looks the way it does, not four separate verdicts to choose between.
        </div>
        <div id="detectorConsensus" class="note" style="margin-top:0;margin-bottom:20px;"></div>
        <div id="detectorCards"></div>
      </div>
    </details>

    <details class="section">
      <summary><div class="section-label">Technical details</div></summary>
      <div class="section-body">
        <div class="chart-label" style="margin-bottom:10px;">
          For debugging and transparency: the risk model used here is a pretrained clinical model, not one trained on this specific dataset. The raw model output and the calibrated (adjusted) probability are shown separately below so any mismatch is visible rather than hidden.
        </div>
        <div id="technicalDetails" style="font-size:12px;color:var(--dim);line-height:2;"></div>
      </div>
    </details>

  </div>
</div>

<script>

let charts = {};

function setStatus(msg, loading=false) {
  document.getElementById("status").innerHTML =
    (loading ? '<span class="spinner"></span>' : '') + msg;
}

function runDemo(atRisk) {
  const uid = atRisk ? "demo_atrisk" : "demo_healthy";
  document.getElementById("userId").value = uid;
  callApi(null, uid);
}

function submitFile() {
  const file = document.getElementById("fileInput").files[0];
  const uid  = document.getElementById("userId").value.trim() || "user_demo";
  callApi(file, uid);
}

function callApi(file, uid) {
  setStatus("Reading through your entries — this takes a minute or two…", true);
  document.getElementById("results").style.display = "none";
  const fd = new FormData();
  fd.append("user_id", uid);
  if (file) fd.append("file", file);
  else fd.append("demo", "true");

  fetch("/run", { method: "POST", body: fd })
    .then(r => r.json())
    .then(d => {
      if (d.error) { setStatus("Something went wrong: " + d.error); return; }
      setStatus("Here's what we found.");
      renderResults(d);
    })
    .catch(e => setStatus("Something went wrong: " + e));
}

function mkLine(id, labels, datasets, yMin=null, yMax=null) {
  if (charts[id]) charts[id].destroy();
  const scales = {
    x: { ticks: { color:"#4a4a4a", font:{size:10}, maxTicksLimit:7 }, grid: { color:"#161616" } },
    y: { ticks: { color:"#4a4a4a", font:{size:10} }, grid: { color:"#161616" } }
  };
  if (yMin !== null) scales.y.min = yMin;
  if (yMax !== null) scales.y.max = yMax;
  charts[id] = new Chart(document.getElementById(id).getContext("2d"), {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color:"#555", font:{size:11} } } },
      scales
    }
  });
}

function mkBar(id, labels, datasets) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(document.getElementById(id).getContext("2d"), {
    type: "bar",
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color:"#555", font:{size:11} } } },
      scales: {
        x: { ticks: { color:"#4a4a4a", font:{size:10}, maxTicksLimit:7 }, grid: { color:"#161616" } },
        y: { ticks: { color:"#4a4a4a", font:{size:10} }, grid: { color:"#161616" } }
      }
    }
  });
}

function movingAverage(arr, window=3) {
  return arr.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = arr.slice(start, i + 1);
    return slice.reduce((a,b) => a+b, 0) / slice.length;
  });
}

function scoreBand(v) {
  if (v < 0.15) return { label: "Excellent", color: "#27ae60" };
  if (v < 0.30) return { label: "Healthy", color: "#4bbf73" };
  if (v < 0.45) return { label: "Stable", color: "#4a90d9" };
  if (v < 0.60) return { label: "Slight Concern", color: "#d4a017" };
  if (v < 0.75) return { label: "Moderate Risk", color: "#e08b2f" };
  if (v < 0.90) return { label: "High Risk", color: "#d9534f" };
  return { label: "Critical", color: "#c0392b" };
}

function scoreBadgeHTML(v) {
  const b = scoreBand(v);
  return `<span class="score-badge" style="background:${b.color}22;color:${b.color};border-color:${b.color}66;">${b.label} &middot; ${(v*100).toFixed(0)}%</span>`;
}

function renderResults(d) {
  document.getElementById("results").style.display = "block";
  const p = d.prediction;
  const dense = d.n_entries > 60;

  const cls = { LOW:"col-low", MODERATE:"col-moderate", HIGH:"col-high" }[p.risk_level] || "";
  document.getElementById("riskLevel").className = "level " + cls;
  document.getElementById("riskLevel").innerHTML = scoreBadgeHTML(p.probability);

  document.getElementById("riskStats").innerHTML = `
    <div class="stat"><div class="val col-blue">${(p.probability*100).toFixed(1)}%</div><div class="lbl">estimated risk</div></div>
    <div class="stat"><div class="val col-dim">${d.n_entries}</div><div class="lbl">entries looked at</div></div>
    <div class="stat"><div class="val ${p.intervention_recommended?'col-high':'col-low'}">${p.intervention_recommended?"Yes":"No"}</div><div class="lbl">worth a check-in</div></div>
  `;

  const note = document.getElementById("interventionNote");
  if (p.intervention_recommended) {
    note.className = "note warn";
    note.textContent = "A few signals here are worth paying attention to. It might help to talk to someone — a friend, a counsellor, or a professional you trust.";
  } else {
    note.className = "note ok";
    note.textContent = "Things look fairly steady right now. Worth keeping an eye on, as always, but nothing stands out as urgent.";
  }

  const lbl = d.timestamps;
  const pr = dense ? 0 : 3;
  const bw = dense ? 1 : 1.5;

  mkLine("sentimentChart", lbl, [{
    label:"Sentiment", data: d.sentiment_series,
    borderColor:"#4a90d9", backgroundColor:"rgba(74,144,217,0.06)",
    tension:0.3, fill:true, pointRadius:pr, borderWidth:bw
  }], -1, 1);

  mkLine("anomalyChart", lbl, [{
    label:"Anomaly Risk", data: d.anomaly_scores,
    borderColor:"#c0392b", backgroundColor:"rgba(192,57,43,0.06)",
    tension:0.3, fill:true, pointRadius:pr, borderWidth:bw
  }], 0, 1);

  const oldNote = document.getElementById("persistentNote");
  if (oldNote) oldNote.remove();
  if (d.persistent_anomaly_flags?.length) {
    const persistentDates = d.timestamps.filter((_, i) => d.persistent_anomaly_flags[i]);
    if (persistentDates.length > 0) {
      const div = document.createElement("div");
      div.id = "persistentNote";
      div.style.cssText = "margin-top:8px;font-size:11px;color:#c0392b;";
      const shown = persistentDates.length > 6 ? persistentDates.slice(0,6).join(", ") + ` and ${persistentDates.length-6} more` : persistentDates.join(", ");
      div.textContent = "Persistent signal on: " + shown;
      document.getElementById("anomalyChart").parentNode.appendChild(div);
    }
  }

  if (d.calibration_status) {
    const cs = d.calibration_status;
    const banner = document.getElementById("baselineBanner");
    const title = document.getElementById("baselineTitle");
    const msg = document.getElementById("baselineMessage");

    const trendText = {
      stable: { title: "Staying steady", message: "Recent entries are consistent with this person's own typical baseline.", cls: "cusum-stable" },
      moving_away: { title: "Drifting from their own baseline", message: "Recent entries are moving further from this person's usual patterns than they were before.", cls: "cusum-upper" },
      returning_to_normal: { title: "Returning toward their baseline", message: "Recent entries are moving back closer to this person's usual patterns.", cls: "cusum-lower" },
      insufficient_data: { title: "Still calibrating", message: "Not enough entries yet to judge whether this person is drifting from their own baseline.", cls: "cusum-both" }
    }[d.baseline_trend] || { title: "—", message: "", cls: "cusum-stable" };

    banner.className = "cusum-banner " + trendText.cls;
    title.textContent = trendText.title;
    msg.textContent = trendText.message;

    document.getElementById("calibrationLabel").textContent = cs.calibrated
      ? "Baseline calibrated"
      : `Calibrating baseline: ${cs.calibration_progress} entries`;

    const pct = cs.calibrated ? 100 : Math.min(100, (cs.entries_so_far / cs.entries_needed) * 100);
    document.getElementById("calibrationFill").style.width = pct + "%";
  }

  if (d.cusum_status) {
    const cs = d.cusum_status;
    const bannerCls = { stable:"cusum-stable", upper_alert:"cusum-upper",
                         lower_alert:"cusum-lower", both_alert:"cusum-both",
                         recovered:"cusum-recovered" }[cs.current_state] || "cusum-stable";
    const banner = document.getElementById("cusumBanner");
    banner.className = "cusum-banner " + bannerCls;
    document.getElementById("cusumTitle").textContent = cs.current_title;
    document.getElementById("cusumMessage").textContent = cs.current_message;
  }

  if (d.cusum_upper?.length) {
    const h = d.cusum_threshold || 0;
    mkLine("cusumChart", lbl, [
      {
        label:"Upper CUSUM", data: d.cusum_upper,
        borderColor:"#c0392b", backgroundColor:"rgba(192,57,43,0.06)",
        tension:0.25, fill:false, pointRadius:pr, borderWidth:bw
      },
      {
        label:"Lower CUSUM", data: d.cusum_lower,
        borderColor:"#4a90d9", backgroundColor:"rgba(74,144,217,0.06)",
        tension:0.25, fill:false, pointRadius:pr, borderWidth:bw
      },
      {
        label:"Alert threshold (h)", data: lbl.map(()=>h),
        borderColor:"#6b6b6b", borderDash:[5,4],
        pointRadius:0, borderWidth:1, fill:false
      }
    ]);
  }

  if (d.detector_scores?.length) {
    const detectors = [
      { key: "mahalanobis",      canvas: "detectorChartMahalanobis",      color: "#4a90d9",
        name: "Mahalanobis distance", blurb: "Flags entries that sit far from this person's usual pattern across all features at once." },
      { key: "copula",           canvas: "detectorChartCopula",           color: "#c0392b",
        name: "Copula", blurb: "Looks at how features relate to each other and flags when those relationships break down." },
      { key: "isolation_forest", canvas: "detectorChartIsolationForest",  color: "#27ae60",
        name: "Isolation forest", blurb: "Flags entries that are easy to separate from the rest — the outliers that stand apart." },
      { key: "knn",              canvas: "detectorChartKnn",              color: "#d4a017",
        name: "K-nearest neighbors", blurb: "Flags entries that don't have many similar-looking entries nearby." }
    ];

    const latestVals = detectors.map(det => (d.detector_scores[d.detector_scores.length-1] || {})[det.key] || 0);
    const elevatedCount = latestVals.filter(v => v >= 0.6).length;
    const consensusEl = document.getElementById("detectorConsensus");
    if (elevatedCount >= 3) {
      consensusEl.className = "note warn";
      consensusEl.textContent = `${elevatedCount} of 4 methods currently read this as elevated — that agreement is why the combined signal is high.`;
    } else if (elevatedCount === 0) {
      consensusEl.className = "note ok";
      consensusEl.textContent = "All 4 methods currently read this as typical — no single one is flagging anything unusual right now.";
    } else {
      consensusEl.className = "note";
      consensusEl.textContent = `${elevatedCount} of 4 methods currently read this as elevated, the rest read it as typical — this kind of partial disagreement is normal and means the entry is unusual in one specific way, not across the board.`;
    }

    const container = document.getElementById("detectorCards");
    container.innerHTML = detectors.map(det => `
      <details class="detector-card">
        <summary>
          <div>
            <div class="det-name">${det.name}</div>
            <div class="det-summary" id="detSummary_${det.key}">Loading…</div>
          </div>
          <div id="detBadge_${det.key}"></div>
        </summary>
        <div class="det-body">
          <div class="chart-label" style="margin:14px 0 10px;">${det.blurb}</div>
          <canvas id="${det.canvas}"></canvas>
          <div class="axis-caption">X-axis: date of each entry. Y-axis: this detector's own unusualness score, 0 to 1. Dashed line is the raw day-to-day score; solid line is a smoothed 3-entry trend.</div>
        </div>
      </details>
    `).join("");

    detectors.forEach(det => {
      const raw = d.detector_scores.map(s => s[det.key] || 0);
      const smoothed = movingAverage(raw, 3);
      const latest = raw[raw.length - 1] || 0;

      document.getElementById(`detBadge_${det.key}`).innerHTML = scoreBadgeHTML(latest);
      const band = scoreBand(latest);
      document.getElementById(`detSummary_${det.key}`).textContent =
        `Latest reading: ${band.label.toLowerCase()} (${(latest*100).toFixed(0)}%)`;

      mkLine(det.canvas, lbl, [
        {
          label: "raw", data: raw,
          borderColor: det.color, backgroundColor: "transparent",
          tension: 0.2, fill: false, pointRadius: 0, borderWidth: 1, borderDash: [2,2]
        },
        {
          label: "trend", data: smoothed,
          borderColor: det.color, backgroundColor: "transparent",
          tension: 0.35, fill: false, pointRadius: 0, borderWidth: 2.5
        }
      ], 0, 1);
    });
  }

  const rawP = (p.probability_raw !== undefined && p.probability_raw !== null) ? p.probability_raw : p.probability;
  const gap = Math.abs(rawP - p.probability);
  document.getElementById("technicalDetails").innerHTML = `
    <div>Raw model output (before calibration): <strong>${(rawP*100).toFixed(1)}%</strong></div>
    <div>Calibrated probability (shown above): <strong>${(p.probability*100).toFixed(1)}%</strong></div>
    <div>Entries used for this run: <strong>${d.n_entries}</strong></div>
    <div style="margin-top:10px;">${gap > 0.15
      ? "The raw and calibrated values differ noticeably here, which means the calibration step is doing real work adjusting the model's output for this input."
      : "The raw and calibrated values are close for this run. If this number looks very similar across very different datasets, the underlying model itself may be saturating rather than the calibration step being the cause — worth comparing raw values across runs, not just calibrated ones."}</div>
  `;

  window.scrollTo({ top: document.getElementById("results").offsetTop - 20, behavior:"smooth" });
}

document.getElementById("fileInput").addEventListener("change", e => {
  const f = e.target.files[0];
  if (f) document.getElementById("dropLabel").innerHTML = `<strong>${f.name}</strong>`;
});

const dz = document.getElementById("dropZone");
dz.addEventListener("dragover", e => { e.preventDefault(); dz.style.borderColor="#555"; });
dz.addEventListener("dragleave", () => dz.style.borderColor="");
dz.addEventListener("drop", e => {
  e.preventDefault(); dz.style.borderColor="";
  const f = e.dataTransfer.files[0];
  if (f) {
    document.getElementById("fileInput").files = e.dataTransfer.files;
    document.getElementById("dropLabel").innerHTML = `<strong>${f.name}</strong>`;
  }
});
</script>
</body>
</html>"""


@app.route("/")
def index():
    return jsonify({
        "service": "Mental Health Digital Twin API",
        "status": "running",
        "frontend": "http://localhost:3000",
        "endpoints": {
            "run": "POST /run",
            "submit": "POST /daily/submit",
            "status": "GET /daily/status",
            "calibrate": "POST /daily/calibrate",
        }
    })


@app.route("/run", methods=["POST"])
def run():
    try:
        user_id = request.form.get("user_id", "user_demo").strip()
        file    = request.files.get("file")

        if not file or not file.filename:
            return jsonify({"error": "No file uploaded. Upload a CSV, JSON, TXT, PDF, or DOCX file with journal entries."}), 400

        suffix = Path(file.filename).suffix.lower()
        if suffix not in {".csv",".json",".txt",".pdf",".docx",".doc"}:
            return jsonify({"error": f"Unsupported file type: {suffix}"})

        from pipeline_runner import run_pipeline

        fd, tmp_path = tempfile.mkstemp(suffix=suffix)
        os.close(fd)
        file.save(tmp_path)
        try:
            result = run_pipeline(user_id, file_path=tmp_path)
        finally:
            for _delay in [0, 0.5, 1.0]:
                try:
                    os.unlink(tmp_path)
                    break
                except PermissionError:
                    if _delay == 1.0:
                        pass
                    else:
                        time.sleep(_delay)

        result["cusum_status"] = build_cusum_status(
            result.get("cusum_alert_upper", []),
            result.get("cusum_alert_lower", []),
            result.get("timestamps", []),
        )

        return jsonify(result)

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)})


@app.route("/internal/feature-extractor", methods=["POST"])
def internal_feature_extractor():
    try:
        body = request.get_json(force=True)
        user_id = body.get("user_id", "").strip()
        text = body.get("text", "").strip()
        if not user_id or not text:
            return jsonify({"error": "user_id and text are required"}), 400

        ts = None
        if body.get("timestamp"):
            try:
                ts = datetime.fromisoformat(body["timestamp"])
            except Exception:
                pass

        result = _pipeline.process_entry(
            user_id=user_id,
            text=text,
            timestamp=ts,
            sleep_hours=body.get("sleep_hours"),
            sleep_quality=body.get("sleep_quality"),
            activity_level=body.get("activity_level"),
            music_mood_score=body.get("music_mood_score"),
        )

        ub = _pipeline.user_baselines.get(user_id)
        return jsonify({
            "user_id": user_id,
            "feature_vector_shape": result["stage_1"]["feature_vector_shape"],
            "readable_metrics": result["stage_1"]["readable_metrics"],
            "normalized_vector": result["stage_2_output"]["z_scored_vector"].tolist(),
            "context_bin": result["stage_2"]["context_bin"],
            "calibrated": result["stage_2"]["calibrated"],
            "calibration_status": ub.calibration_status() if ub else None,
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/internal/forecaster", methods=["POST"])
def internal_forecaster():
    try:
        body = request.get_json(force=True)
        user_id = body.get("user_id", "").strip()
        if not user_id:
            return jsonify({"error": "user_id is required"}), 400

        n = len(_pipeline.normalized_vectors.get(user_id, []))
        if n < 3:
            return jsonify({"error": f"Need at least 3 entries, got {n}"}), 400

        num_patches = min(10, max(3, n - 1))
        tft = _pipeline.train_tft_model(
            num_patches=num_patches,
            hidden_size=32,
            max_epochs=5,
            batch_size=8,
        )

        return jsonify({
            "user_id": user_id,
            "latent_shape": list(tft["latents"].shape),
            "attention_shape": list(tft["attention"].shape),
            "umap_coords": tft["umap_coords"].tolist() if hasattr(tft["umap_coords"], "tolist") else tft["umap_coords"],
            "n_entries": n,
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/internal/consensus", methods=["POST"])
def internal_consensus():
    try:
        body = request.get_json(force=True)
        user_id = body.get("user_id", "").strip()
        if not user_id:
            return jsonify({"error": "user_id is required"}), 400

        if user_id not in _pipeline.normalized_vectors or len(_pipeline.normalized_vectors[user_id]) == 0:
            return jsonify({"error": f"No normalized vectors for user {user_id}"}), 400

        all_vecs = _pipeline.get_batch_consistent_vectors(user_id)

        if not _pipeline.anomaly_detector:
            n_train = max(10, int(len(all_vecs) * 0.7))
            from stage_4.anomaly_pipeline import MultiDetectorPipeline
            X_train = np.array(all_vecs[:n_train])
            _pipeline.anomaly_detector = MultiDetectorPipeline()
            _pipeline.anomaly_detector.fit(X_train)
            print(f"[consensus] Trained fresh detector on {n_train}/{len(all_vecs)} vectors")
        anomaly_results = []
        for vec in all_vecs:
            anomaly_results.append(_pipeline.detect_anomalies(vec))

        _pipeline.anomaly_scores[user_id] = anomaly_results

        cusum_results = _pipeline.fit_and_run_cusum(user_id)
        cusum_threshold = round(float(_pipeline.cusum_detectors[user_id].h), 4)

        return jsonify({
            "user_id": user_id,
            "overall_anomaly_scores": [round(a["overall_risk_score"], 4) for a in anomaly_results],
            "detector_scores": [a["detector_scores"] for a in anomaly_results],
            "is_anomaly": [bool(a["is_anomaly"]) for a in anomaly_results],
            "cusum_upper": [round(float(c["cusum_upper"]), 4) for c in cusum_results],
            "cusum_lower": [round(float(c["cusum_lower"]), 4) for c in cusum_results],
            "cusum_alert_upper": [bool(c["cusum_alert_upper"]) for c in cusum_results],
            "cusum_alert_lower": [bool(c["cusum_alert_lower"]) for c in cusum_results],
            "cusum_threshold": cusum_threshold,
            "n_entries": len(anomaly_results),
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/internal/risk-calculator", methods=["POST"])
def internal_risk_calculator():
    try:
        body = request.get_json(force=True)
        user_id = body.get("user_id", "").strip()
        if not user_id:
            return jsonify({"error": "user_id is required"}), 400

        vecs = _pipeline.normalized_vectors.get(user_id, [])
        anomalies = _pipeline.anomaly_scores.get(user_id, [])
        if len(vecs) < 5:
            return jsonify({
                "user_id": user_id,
                "n_entries": len(vecs),
                "note": "insufficient entries for reliable classification",
                "probability": 0.0,
                "risk_level": "LOW",
                "intervention_recommended": False,
            })

        features = _pipeline.assemble_stage5_features(vecs, anomalies)
        prediction = _pipeline.predict_classification(features)
        return jsonify({
            "user_id": user_id,
            "n_entries": len(vecs),
            "probability": prediction["probability"],
            "probability_raw": prediction["probability_raw"],
            "risk_level": prediction["risk_level"],
            "intervention_recommended": prediction["intervention_recommended"],
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/internal/calibration", methods=["POST"])
def internal_calibration():
    try:
        body = request.get_json(force=True)
        user_id = body.get("user_id", "").strip()
        calibration_method = body.get("calibration_method", "temperature")
        if calibration_method not in ("temperature", "platt"):
            return jsonify({"error": "Unsupported calibration method. Accepted: 'temperature', 'platt'"}), 400

        if not user_id:
            return jsonify({"error": "user_id is required"}), 400

        vecs = _pipeline.normalized_vectors.get(user_id, [])
        anomalies = _pipeline.anomaly_scores.get(user_id, [])
        if len(vecs) < 5:
            return jsonify({
                "user_id": user_id,
                "n_entries": len(vecs),
                "note": "insufficient entries for calibration",
                "probability": 0.0,
                "risk_level": "LOW",
            })

        features = _pipeline.assemble_stage5_features(vecs, anomalies)
        prediction = _pipeline.predict_classification(features, calibration=calibration_method)
        return jsonify({
            "user_id": user_id,
            "calibration_method": calibration_method,
            "probability": prediction["probability"],
            "probability_raw": prediction["probability_raw"],
            "risk_level": prediction["risk_level"],
            "intervention_recommended": prediction["intervention_recommended"],
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/internal/explainer", methods=["POST"])
def internal_explainer():
    try:
        body = request.get_json(force=True)
        user_id = body.get("user_id", "").strip()
        calibration_method = body.get("calibration_method", "temperature")
        if calibration_method not in ("temperature", "platt"):
            return jsonify({"error": "Unsupported calibration method. Accepted: 'temperature', 'platt'"}), 400

        if not user_id:
            return jsonify({"error": "user_id is required"}), 400

        vecs = _pipeline.normalized_vectors.get(user_id, [])
        anomalies = _pipeline.anomaly_scores.get(user_id, [])
        if len(vecs) < 5:
            return jsonify({
                "user_id": user_id,
                "n_entries": len(vecs),
                "note": "insufficient entries",
                "probability": 0.0,
                "risk_level": "LOW",
                "explanation": "Not enough journal entries to generate a meaningful explanation."
            })

        features = _pipeline.assemble_stage5_features(vecs, anomalies)
        prediction = _pipeline.predict_classification(features, calibration=calibration_method)

        # Simple feature-level explanation based on aggregate anomaly signals
        latest_anomaly = anomalies[-1] if anomalies else {}
        det_scores = latest_anomaly.get("detector_scores", {})
        contributors = sorted(det_scores.items(), key=lambda x: x[1], reverse=True) if det_scores else []

        explanation = f"Risk assessment based on {len(vecs)} journal entries."
        if contributors:
            top = contributors[0]
            explanation += f" Primary signal driver: {top[0]} detector (score: {top[1]:.3f})."
        if prediction["risk_level"] != "LOW":
            explanation += " Consider consulting a mental health professional for a complete evaluation."

        return jsonify({
            "user_id": user_id,
            "calibration_method": calibration_method,
            "probability": prediction["probability"],
            "probability_raw": prediction["probability_raw"],
            "risk_level": prediction["risk_level"],
            "intervention_recommended": prediction["intervention_recommended"],
            "explanation": explanation,
            "feature_contributors": contributors,
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


PORTAL_HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Daily Alignment Portal</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:       #0a0a0a;
    --surface:  #111111;
    --border:   #1f1f1f;
    --muted:    #3a3a3a;
    --text:     #d4d4d4;
    --dim:      #6b6b6b;
    --accent:   #e2e2e2;
    --blue:     #4a90d9;
    --red:      #c0392b;
    --green:    #27ae60;
    --amber:    #d4a017;
  }

  body {
    font-family: 'Inter', system-ui, sans-serif;
    background: var(--bg);
    color: var(--text);
    font-size: 14px;
    line-height: 1.6;
    min-height: 100vh;
  }

  header {
    padding: 24px 32px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
  }
  header h1 { font-size: 16px; font-weight: 500; color: var(--accent); }
  header .sub { font-size: 11px; color: var(--dim); }
  header nav { display: flex; gap: 8px; }

  .container { max-width: 800px; margin: 0 auto; padding: 32px 20px; }

  .nav-btn {
    padding: 6px 14px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--surface);
    color: var(--dim);
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
    text-decoration: none;
    transition: background .15s;
  }
  .nav-btn:hover { background: var(--border); color: var(--text); }
  .nav-btn.active { background: var(--accent); color: #000; border-color: var(--accent); }
  .nav-btn:disabled { opacity: .4; cursor: not-allowed; }

  .card {
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 24px;
    margin-bottom: 20px;
  }
  .card-title {
    font-size: 11px;
    font-weight: 500;
    color: var(--dim);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 16px;
  }

  .calibration-bar {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 4px;
  }
  .calibration-bar .progress {
    flex: 1;
    height: 8px;
    background: var(--border);
    border-radius: 4px;
    overflow: hidden;
  }
  .calibration-bar .fill {
    height: 100%;
    background: var(--blue);
    transition: width .4s;
    border-radius: 4px;
  }
  .calibration-bar .fill.done { background: var(--green); }
  .cal-text { font-size: 12px; color: var(--dim); }

  .form-group { margin-bottom: 16px; }
  .form-group label {
    display: block;
    font-size: 12px;
    color: var(--dim);
    margin-bottom: 6px;
  }
  .form-group textarea, .form-group input[type=file] {
    width: 100%;
  }
  .form-group textarea {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 10px 12px;
    color: var(--text);
    font-size: 13px;
    font-family: inherit;
    outline: none;
    min-height: 80px;
    resize: vertical;
  }
  .form-group textarea:focus { border-color: var(--muted); }

  .slider-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  .slider-group { }
  .slider-group label {
    font-size: 11px;
    color: var(--dim);
    display: block;
    margin-bottom: 4px;
  }
  .slider-group input[type=range] {
    width: 100%;
    -webkit-appearance: none;
    appearance: none;
    height: 4px;
    background: var(--border);
    border-radius: 2px;
    outline: none;
  }
  .slider-group input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px; height: 14px;
    border-radius: 50%;
    background: var(--accent);
    cursor: pointer;
  }
  .slider-value { font-size: 13px; color: var(--text); margin-top: 2px; }

  .btn {
    padding: 8px 20px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--surface);
    color: var(--text);
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
    transition: background .15s;
  }
  .btn:hover { background: var(--border); }
  .btn-primary { background: var(--accent); color: #000; border-color: var(--accent); font-weight: 500; }
  .btn-primary:hover { background: #c8c8c8; }
  .btn-danger { border-color: #3a1a1a; color: var(--red); }
  .btn-danger:hover { background: #1a0a0a; }
  .btn-sm { padding: 5px 12px; font-size: 12px; }
  .btn:disabled { opacity: .4; cursor: not-allowed; }

  .inline-status {
    margin-top: 12px;
    font-size: 12px;
    color: var(--dim);
    min-height: 18px;
  }
  .spinner {
    display: inline-block;
    width: 12px; height: 12px;
    border: 1.5px solid var(--muted);
    border-top-color: var(--text);
    border-radius: 50%;
    animation: spin .7s linear infinite;
    vertical-align: middle;
    margin-right: 6px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .history-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  .history-table th {
    text-align: left;
    padding: 8px 10px;
    color: var(--dim);
    font-weight: 500;
    border-bottom: 1px solid var(--border);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .history-table td {
    padding: 8px 10px;
    border-bottom: 1px solid var(--border);
    color: var(--text);
  }
  .history-table tr:hover td { background: var(--surface); }
  .badge {
    display: inline-block;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 3px;
    border: 1px solid;
  }
  .badge-yes { border-color: #1a2e1a; color: var(--green); }
  .badge-no  { border-color: #3a1a1a; color: var(--red); }

  .empty-state {
    text-align: center;
    padding: 40px 20px;
    color: var(--dim);
    font-size: 13px;
  }

  .tab-bar { display: flex; gap: 0; border-bottom: 1px solid var(--border); margin-bottom: 24px; }
  .tab {
    padding: 10px 20px;
    font-size: 12px;
    color: var(--dim);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: color .15s, border-color .15s;
    font-family: inherit;
    background: none;
    border-top: none; border-left: none; border-right: none;
  }
  .tab:hover { color: var(--text); }
  .tab.active { color: var(--accent); border-bottom-color: var(--accent); }

  .audio-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 8px; }
  .audio-actions .btn { font-size: 12px; }

  .dashboard-link {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    border: 1px solid var(--border);
    border-radius: 6px;
    margin-top: 16px;
    text-decoration: none;
    color: var(--text);
    transition: background .15s;
  }
  .dashboard-link:hover { background: var(--surface); }
  .dashboard-link .arrow { font-size: 18px; color: var(--dim); }

  @media (max-width: 600px) {
    .slider-row { grid-template-columns: 1fr; }
    header { flex-direction: column; align-items: flex-start; }
  }
</style>
</head>
<body>
<header>
  <div>
    <h1>Daily Alignment Portal</h1>
    <div class="sub">Check in each day to help the system learn your baseline</div>
  </div>
  <nav>
    <a href="/" class="nav-btn">Dashboard</a>
    <a href="/portal" class="nav-btn active">Daily Portal</a>
  </nav>
</header>
<div class="container">
  <div class="card" id="calibrationCard">
    <div class="card-title">Calibration Progress</div>
    <div class="calibration-bar">
      <div class="progress"><div class="fill" id="calFill" style="width:0%"></div></div>
      <span class="cal-text" id="calText">0 / 14 entries</span>
    </div>
    <div id="calMessage" style="font-size:12px;color:var(--dim);margin-top:8px;">
      Submit entries daily to calibrate your personal baseline.
    </div>
    <a href="/" id="dashboardLink" class="dashboard-link" style="display:none;">
      <span style="flex:1;"><strong>Fully Calibrated</strong> &mdash; your dashboards are ready</span>
      <span class="arrow">&rarr;</span>
    </a>
  </div>

  <div class="tab-bar">
    <button class="tab active" onclick="switchTab('submit')">Submit Entry</button>
    <button class="tab" onclick="switchTab('history')">History</button>
  </div>

  <div id="tabSubmit">
    <div class="card">
      <div class="card-title">Today's Check-In</div>

      <div class="form-group">
        <label>User ID</label>
        <input type="text" id="userId" value="rohith_ms" style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:9px 12px;color:var(--text);font-size:13px;font-family:inherit;outline:none;">
      </div>

      <div class="form-group">
        <label>Journal Text (paste or type)</label>
        <textarea id="journalText" placeholder="How was your day?..."></textarea>
      </div>

      <div class="form-group">
        <label>Text File (.txt)</label>
        <input type="file" id="textFile" accept=".txt" style="font-size:12px;color:var(--dim);">
      </div>

      <div class="form-group">
        <label>Audio Recording (.wav)</label>
        <div class="audio-actions">
          <input type="file" id="audioFile" accept=".wav" style="font-size:12px;color:var(--dim);flex:1;">
        </div>
      </div>

      <div class="form-group">
        <label>Health Sliders</label>
        <div class="slider-row">
          <div class="slider-group">
            <label>Sleep Hours <span class="slider-value" id="sleepHoursVal">7.0</span></label>
            <input type="range" min="0" max="12" step="0.5" value="7" oninput="document.getElementById('sleepHoursVal').textContent=this.value">
          </div>
          <div class="slider-group">
            <label>Sleep Quality <span class="slider-value" id="sleepQualityVal">0.7</span></label>
            <input type="range" min="0" max="1" step="0.05" value="0.7" oninput="document.getElementById('sleepQualityVal').textContent=this.value">
          </div>
          <div class="slider-group">
            <label>Activity Level <span class="slider-value" id="activityVal">0.6</span></label>
            <input type="range" min="0" max="1" step="0.05" value="0.6" oninput="document.getElementById('activityVal').textContent=this.value">
          </div>
          <div class="slider-group">
            <label>Music Mood <span class="slider-value" id="musicVal">0.5</span></label>
            <input type="range" min="0" max="1" step="0.05" value="0.5" oninput="document.getElementById('musicVal').textContent=this.value">
          </div>
        </div>
      </div>

      <button class="btn btn-primary" onclick="submitDaily()">Submit Today's Entry</button>
      <div class="inline-status" id="submitStatus"></div>
    </div>
  </div>

  <div id="tabHistory" style="display:none;">
    <div class="card">
      <div class="card-title">Entry History</div>
      <div id="historyContent"><div class="empty-state">Loading...</div></div>
    </div>
  </div>
</div>

<script>
let CURRENT_USER = "";
const MIN_ENTRIES = 14;

function setStatus(el, msg, loading) {
  document.getElementById(el).innerHTML = (loading ? '<span class="spinner"></span>' : '') + msg;
}

function switchTab(name) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelector(`.tab[onclick*="${name}"]`).classList.add("active");
  document.getElementById("tabSubmit").style.display = name === "submit" ? "block" : "none";
  document.getElementById("tabHistory").style.display = name === "history" ? "block" : "none";
  if (name === "history") loadHistory();
}

function refreshStatus() {
  const uid = document.getElementById("userId").value.trim() || "rohith_ms";
  CURRENT_USER = uid;
  fetch(`/daily/status?user_id=${encodeURIComponent(uid)}`)
    .then(r => r.json())
    .then(d => {
      if (d.error) return;
      const fill = document.getElementById("calFill");
      const text = document.getElementById("calText");
      const msg = document.getElementById("calMessage");
      const link = document.getElementById("dashboardLink");
      const pct = d.calibrated ? 100 : d.progress_pct;
      fill.style.width = pct + "%";
      fill.className = "fill" + (d.calibrated ? " done" : "");
      text.textContent = d.calibrated ? "Calibrated!" : `${d.calibration_progress}`;
      if (d.calibrated) {
        msg.innerHTML = "Your personal baseline is calibrated. All dashboards are unlocked.";
        link.style.display = "flex";
      } else {
        const rem = d.entries_needed - d.entry_count;
        msg.innerHTML = rem > 0 ? `${rem} more day${rem > 1 ? 's' : ''} until full calibration.` : "Ready to calibrate! Click the button below.";
        link.style.display = "none";
      }
    })
    .catch(() => {});
}

function submitDaily() {
  const uid = document.getElementById("userId").value.trim() || "rohith_ms";
  CURRENT_USER = uid;
  const text = document.getElementById("journalText").value.trim();
  const textFile = document.getElementById("textFile").files[0];
  const audioFile = document.getElementById("audioFile").files[0];

  if (!text && !textFile && !audioFile) {
    setStatus("submitStatus", "Provide text, a .txt file, or audio to submit.");
    return;
  }

  const fd = new FormData();
  fd.append("user_id", uid);
  fd.append("sleep_hours", document.querySelector("#sleepHoursVal").textContent);
  fd.append("sleep_quality", document.querySelector("#sleepQualityVal").textContent);
  fd.append("activity_level", document.querySelector("#activityVal").textContent);
  fd.append("music_mood_score", document.querySelector("#musicVal").textContent);

  if (text) fd.append("text", text);
  if (textFile) fd.append("text", textFile);
  if (audioFile) fd.append("audio", audioFile);

  setStatus("submitStatus", "Extracting features and saving...", true);

  fetch("/daily/submit", { method: "POST", body: fd })
    .then(r => r.json())
    .then(d => {
      if (d.error) {
        setStatus("submitStatus", d.error);
        return;
      }
      setStatus("submitStatus", "Done! Entry saved for " + d.entry_date);
      refreshStatus();
      document.getElementById("journalText").value = "";
      document.getElementById("textFile").value = "";
      document.getElementById("audioFile").value = "";
    })
    .catch(e => setStatus("submitStatus", "Error: " + e));
}

function loadHistory() {
  const uid = document.getElementById("userId").value.trim() || "rohith_ms";
  CURRENT_USER = uid;
  const el = document.getElementById("historyContent");
  el.innerHTML = '<div class="empty-state">Loading...</div>';

  fetch(`/daily/status?user_id=${encodeURIComponent(uid)}`)
    .then(r => r.json())
    .then(d => {
      if (d.error) { el.innerHTML = '<div class="empty-state">' + d.error + '</div>'; return; }
      if (!d.history || d.history.length === 0) {
        el.innerHTML = '<div class="empty-state">No entries yet. Start submitting daily!</div>';
        return;
      }
      let html = `<table class="history-table">
        <thead><tr>
          <th>Date</th>
          <th>Text</th>
          <th>Audio</th>
          <th>Sleep</th>
          <th>Quality</th>
          <th>Activity</th>
          <th>Music</th>
          <th>Status</th>
        </tr></thead><tbody>`;
      d.history.forEach(e => {
        const yes = '<span class="badge badge-yes">yes</span>';
        const no = '<span class="badge badge-no">no</span>';
        html += `<tr>
          <td>${e.entry_date}</td>
          <td>${e.has_text ? yes : no}</td>
          <td>${e.has_audio ? yes : no}</td>
          <td>${e.sleep_hours != null ? e.sleep_hours : '—'}</td>
          <td>${e.sleep_quality != null ? e.sleep_quality.toFixed(2) : '—'}</td>
          <td>${e.activity_level != null ? e.activity_level.toFixed(2) : '—'}</td>
          <td>${e.music_mood_score != null ? e.music_mood_score.toFixed(2) : '—'}</td>
          <td>${e.features_extracted ? yes : no}</td>
        </tr>`;
      });
      html += "</tbody></table>";
      el.innerHTML = html;
    })
    .catch(() => el.innerHTML = '<div class="empty-state">Failed to load history</div>');
}

document.getElementById("userId").addEventListener("change", refreshStatus);
document.getElementById("userId").addEventListener("keyup", refreshStatus);

refreshStatus();
</script>
</body>
</html>"""


if __name__ == "__main__":
    print("Flask API running on http://localhost:5000")
    print("  GET /             — API info")
    print("  POST /run         — Run full pipeline (file upload / demo)")
    print("  POST /daily/submit   — Submit daily entry")
    print("  GET  /daily/status   — Calibration progress + history")
    print("  POST /daily/calibrate — Force baseline calibration")
    print("  POST /daily/delete   — Delete user data")
    print("")
    print("Frontend: cd User Interface && npm run dev  →  http://localhost:3000")
    app.run(debug=False, port=5000, threaded=True)