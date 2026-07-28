"""
Mental Health Digital Twin — End-to-End XAI (Explainable AI) Documentation PDF
Generated using reportlab.
"""

import io
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether, PageBreak,
)
from reportlab.graphics.shapes import Drawing, Rect, String, Line
from reportlab.graphics import renderPDF


# ── Colour palette ──────────────────────────────────────────────────────────
C_PRIMARY   = colors.HexColor("#1a1a2e")
C_ACCENT    = colors.HexColor("#0f3460")
C_HIGHLIGHT = colors.HexColor("#e94560")
C_GREEN     = colors.HexColor("#27ae60")
C_AMBER     = colors.HexColor("#f39c12")
C_RED       = colors.HexColor("#c0392b")
C_LIGHT_BG  = colors.HexColor("#f5f6fa")
C_DARK_BG   = colors.HexColor("#1a1a2e")
C_BORDER    = colors.HexColor("#dcdde1")
C_MUTED     = colors.HexColor("#7f8c8d")
C_TEXT      = colors.HexColor("#2c3e50")
C_BLUE      = colors.HexColor("#3498db")
C_PURPLE    = colors.HexColor("#9b59b6")


# ── Styles ──────────────────────────────────────────────────────────────────
def _styles():
    ss = getSampleStyleSheet()
    ss.add(ParagraphStyle(
        "DocTitle", fontSize=22, leading=28, textColor=C_PRIMARY,
        fontName="Helvetica-Bold", alignment=TA_CENTER, spaceAfter=4,
    ))
    ss.add(ParagraphStyle(
        "DocSubtitle", fontSize=10, leading=14, textColor=C_MUTED,
        fontName="Helvetica", alignment=TA_CENTER, spaceAfter=20,
    ))
    ss.add(ParagraphStyle(
        "SectionHead", fontSize=13, leading=16, textColor=C_ACCENT,
        fontName="Helvetica-Bold", spaceBefore=18, spaceAfter=8,
    ))
    ss.add(ParagraphStyle(
        "SubHead", fontSize=10, leading=13, textColor=C_PRIMARY,
        fontName="Helvetica-Bold", spaceBefore=10, spaceAfter=4,
    ))
    ss.add(ParagraphStyle(
        "SubHead2", fontSize=9, leading=12, textColor=C_ACCENT,
        fontName="Helvetica-Bold", spaceBefore=8, spaceAfter=3,
    ))
    ss.add(ParagraphStyle(
        "BodyText2", fontSize=9, leading=13, textColor=C_TEXT,
        fontName="Helvetica", spaceAfter=4,
    ))
    ss.add(ParagraphStyle(
        "CodeBlock", fontSize=8, leading=11, textColor=colors.HexColor("#2c3e50"),
        fontName="Courier", backColor=C_LIGHT_BG, spaceAfter=6,
        leftIndent=12, rightIndent=12, spaceBefore=4,
        borderWidth=0.5, borderColor=C_BORDER, borderPadding=6,
    ))
    ss.add(ParagraphStyle(
        "BulletItem", fontSize=9, leading=13, textColor=C_TEXT,
        fontName="Helvetica", leftIndent=20, bulletIndent=8,
        spaceAfter=2,
    ))
    ss.add(ParagraphStyle(
        "SmallMuted", fontSize=8, leading=10, textColor=C_MUTED,
        fontName="Helvetica",
    ))
    ss.add(ParagraphStyle(
        "TableHeader", fontSize=8, leading=10, textColor=colors.white,
        fontName="Helvetica-Bold",
    ))
    ss.add(ParagraphStyle(
        "TableCell", fontSize=8, leading=10, textColor=C_TEXT,
        fontName="Helvetica",
    ))
    return ss


# ── Flow diagram ────────────────────────────────────────────────────────────
def _build_flow_diagram(s):
    d = Drawing(500, 200)

    # Background
    d.add(Rect(0, 0, 500, 200, fillColor=colors.HexColor("#fafbfc"),
               strokeColor=C_BORDER, strokeWidth=0.5, rx=6))

    # Title
    d.add(String(250, 182, "End-to-End XAI Data Flow",
                 fontSize=11, fontName="Helvetica-Bold",
                 fillColor=C_PRIMARY, textAnchor="middle"))

    boxes = [
        (30,  120, 90,  40, "User Input\n(Text / Audio)",    C_BLUE),
        (140, 120, 90,  40, "Stage 1\n466 Features",        C_GREEN),
        (250, 120, 90,  40, "Stage 4\nAnomaly Scores",      C_AMBER),
        (360, 120, 90,  40, "Stage 5\n2336 Features",       C_RED),
        (30,  30,  90,  40, "XGBoost\nClassifier",          C_PURPLE),
        (140, 30,  90,  40, "TreeSHAP\nExplainer",          C_HIGHLIGHT),
        (250, 30,  90,  40, "grouping.py\nFeature Mapping", C_ACCENT),
        (360, 30,  90,  40, "Frontend\nRendered Bars",      C_PRIMARY),
    ]

    for (x, y, w, h, label, color) in boxes:
        d.add(Rect(x, y, w, h, fillColor=color, strokeColor=None, rx=4, opacity=0.9))
        lines = label.split("\n")
        for i, line in enumerate(lines):
            d.add(String(x + w/2, y + h/2 + (5 if i == 0 else -7),
                         line, fontSize=7, fontName="Helvetica-Bold",
                         fillColor=colors.white, textAnchor="middle"))

    # Arrows (lines with small arrowheads)
    arrow_style = dict(strokeColor=C_MUTED, strokeWidth=1.2)
    arrows = [
        (120, 140, 140, 140),   # Stage1 → Stage4
        (230, 140, 250, 140),   # Stage4 → Stage5
        (340, 140, 360, 140),   # Stage5 → XGBoost (no, this is top row)
        # Top row to bottom row
        (405, 120, 405, 70),    # Stage5 → XGBoost (vertical)
        (360, 50, 340, 50),     # XGBoost → TreeSHAP (left)
        (250, 50, 230, 50),     # TreeSHAP → grouping (left)
        (140, 50, 120, 50),     # grouping → Frontend (left)
    ]
    # Actually let's do a simpler flow: left to right top, then right to left bottom
    arrows2 = [
        (120, 140, 140, 140),
        (230, 140, 250, 140),
        (340, 140, 360, 140),
        (450, 140, 450, 70),    # down from Stage5
        (450, 50, 340, 50),     # left to XGBoost... 
    ]
    # Simplified: just horizontal flow top, vertical down, horizontal flow bottom reversed
    flow_lines = [
        ((120, 140), (140, 140)),   # Input → Stage1
        ((230, 140), (250, 140)),   # Stage1 → Stage4
        ((340, 140), (360, 140)),   # Stage4 → Stage5
        ((405, 120), (405, 70)),    # Stage5 → Classifier (down)
        ((340, 50),  (250, 50)),    # XGBoost → TreeSHAP (left)
        ((230, 50),  (140, 50)),    # TreeSHAP → grouping (left)
        ((120, 50),  (30, 50)),     # grouping → Frontend (left)
    ]
    for (x1, y1), (x2, y2) in flow_lines:
        d.add(Line(x1, y1, x2, y2, **arrow_style))
        # Simple arrowhead
        if x2 > x1:
            d.add(Line(x2, y2, x2-4, y2+3, **arrow_style))
            d.add(Line(x2, y2, x2-4, y2-3, **arrow_style))
        elif x2 < x1:
            d.add(Line(x2, y2, x2+4, y2+3, **arrow_style))
            d.add(Line(x2, y2, x2+4, y2-3, **arrow_style))
        elif y2 < y1:
            d.add(Line(x2, y2, x2-3, y2+4, **arrow_style))
            d.add(Line(x2, y2, x2+3, y2+4, **arrow_style))
        elif y2 > y1:
            d.add(Line(x2, y2, x2-3, y2-4, **arrow_style))
            d.add(Line(x2, y2, x2+3, y2-4, **arrow_style))

    return d


# ── Build the document ─────────────────────────────────────────────────────
def generate_xai_pdf(output_path: str = "XAI_End_to_End_Documentation.pdf"):
    styles = _styles()
    doc = SimpleDocTemplate(
        output_path, pagesize=letter,
        leftMargin=0.75*inch, rightMargin=0.75*inch,
        topMargin=0.6*inch, bottomMargin=0.6*inch,
    )

    story = []

    # ── TITLE PAGE ──────────────────────────────────────────────────────
    story.append(Spacer(1, 60))
    story.append(Paragraph("End-to-End Explainable AI (XAI)", styles["DocTitle"]))
    story.append(Paragraph("Mental Health Digital Twin AI System", styles["DocSubtitle"]))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="60%", thickness=1.5, color=C_ACCENT, spaceAfter=12))
    story.append(Paragraph(
        "Technical documentation covering the complete SHAP-based explainability pipeline "
        "from feature extraction through clinical visualization.",
        styles["BodyText2"]))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        f"Generated: {datetime.now().strftime('%d %B %Y %H:%M')}  |  "
        "Version: 1.0  |  "
        "SHAP Library: TreeSHAP (fast, exact, model-specific)",
        styles["SmallMuted"]))
    story.append(Spacer(1, 30))

    # Flow diagram
    story.append(_build_flow_diagram(styles))
    story.append(Spacer(1, 30))

    # ── TABLE OF CONTENTS ───────────────────────────────────────────────
    story.append(Paragraph("Table of Contents", styles["SectionHead"]))
    toc_items = [
        "1. Architecture Overview",
        "2. Stage 1 — Feature Extraction (466 dimensions)",
        "3. Stage 4 — Anomaly Detection & Temporal Features",
        "4. Stage 5 — XGBoost Classification & Feature Assembly (2336 dimensions)",
        "5. XAI Module — SHAPExplainer (XAI.py)",
        "6. Feature Grouping (grouping.py)",
        "7. Backend Integration Pipeline",
        "8. API Endpoints",
        "9. Frontend Rendering & Visualization",
        "10. Configuration & File Reference",
    ]
    for item in toc_items:
        story.append(Paragraph(item, styles["BulletItem"]))
    story.append(PageBreak())

    # ════════════════════════════════════════════════════════════════════
    # SECTION 1: Architecture Overview
    # ════════════════════════════════════════════════════════════════════
    story.append(Paragraph("1. Architecture Overview", styles["SectionHead"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_BORDER, spaceAfter=8))

    story.append(Paragraph(
        "The Mental Health Digital Twin AI system uses <b>SHAP (SHapley Additive exPlanations)</b> "
        "to provide transparent, interpretable explanations for every risk prediction. "
        "The XAI module sits at the end of the ML pipeline and answers one question: "
        "<b>\"Why did the model assign this specific risk score?\"</b>",
        styles["BodyText2"]))
    story.append(Spacer(1, 6))

    story.append(Paragraph("Key Design Decisions", styles["SubHead"]))
    bullets = [
        "<b>TreeSHAP</b> — Uses the model-specific TreeExplainer for XGBoost, providing exact SHAP values in O(TLD) time (not approximate).",
        "<b>2,336 features</b> — The explanation covers every signal the model sees: 466 base features × 4 statistical windows + 466 temporal deltas + 6 anomaly scores.",
        "<b>Grouped by clinical domain</b> — Features are mapped to 5 behavioral domains (Emotional State, Sentiment, Cognitive Patterns, Writing Style, Behavioural Patterns) via grouping.py.",
        "<b>Real-time</b> — SHAP computation takes &lt;500ms on the local server and is triggered on every diagnosis.",
        "<b>No external APIs</b> — All computation runs locally. No patient data leaves the machine.",
    ]
    for b in bullets:
        story.append(Paragraph(f"• {b}", styles["BulletItem"]))

    story.append(Spacer(1, 10))

    story.append(Paragraph("Data Flow Summary", styles["SubHead"]))
    flow_data = [
        ["Step", "Component", "Input", "Output"],
        ["1", "Stage 1 (Extract_features.py)", "Raw text, audio, metadata", "466-dim feature vector"],
        ["2", "Stage 2 (temporal_bin.py)", "466-dim vectors over time", "Sliding window (10 entries)"],
        ["3", "Stage 4 (anomaly detectors)", "466-dim windowed vectors", "6 anomaly scores"],
        ["4", "Stage 5 (feature_assembler.py)", "Windowed vectors + anomaly scores", "2336-dim feature vector"],
        ["5", "XGBoost classifier (model.json)", "2336-dim vector", "Calibrated risk probability"],
        ["6", "SHAPExplainer (XAI.py)", "Model + 2336-dim vector", "Structured explanation dict"],
        ["7", "grouping.py", "466 base feature names", "Domain grouping + display info"],
        ["8", "Frontend (App.tsx)", "Explanation dict via /api/explain", "Waterfall bars, group cards"],
    ]
    t = Table(flow_data, colWidths=[0.4*inch, 1.8*inch, 2.0*inch, 2.2*inch])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), C_ACCENT),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.5, C_BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, C_LIGHT_BG]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(t)
    story.append(PageBreak())

    # ════════════════════════════════════════════════════════════════════
    # SECTION 2: Stage 1 — Feature Extraction
    # ════════════════════════════════════════════════════════════════════
    story.append(Paragraph("2. Stage 1 — Feature Extraction (466 dimensions)", styles["SectionHead"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_BORDER, spaceAfter=8))

    story.append(Paragraph(
        "Every user entry (text journal, audio transcript, or clinical note) is converted into "
        "a <b>466-dimensional feature vector</b>. This vector captures linguistic, emotional, "
        "behavioral, and physiological signals.",
        styles["BodyText2"]))

    story.append(Paragraph("Feature Categories", styles["SubHead"]))
    feat_data = [
        ["Category", "Features", "Dims", "Source"],
        ["SBERT Embeddings", "sbert_0 .. sbert_383", "384", "sentence-transformers (all-MiniLM-L6-v2)"],
        ["GoEmotions", "emotion_admiration .. emotion_neutral", "28", "GoEmotions classifier"],
        ["VADER Sentiment", "vader_neg, vader_neu, vader_pos, vader_compound\nvader_min_compound, vader_max_compound, vader_std_compound", "7", "nltk.sentiment.vader"],
        ["Lexical Diversity", "ttr, mtld", "2", "Custom NLP"],
        ["Readability", "readability_fre, readability_fkgl, readability_ari", "3", "textstat library"],
        ["Pronoun Usage", "first_person_singular, first_person_plural", "2", "Custom NLP"],
        ["Length Features", "word_count, sentence_count, avg_sentence_length", "3", "Custom NLP"],
        ["Punctuation", "question_ratio, exclamation_ratio, ellipsis_ratio, caps_ratio", "4", "Custom NLP"],
        ["Temporal", "hour_sin, hour_cos, days_gap", "3", "Timestamp-derived"],
        ["Health Metrics", "sleep_hours, sleep_quality, activity_level, music_mood\nmask_sleep, mask_sleep_quality, mask_activity, mask_music", "8", "User self-report"],
        ["Audio Features", "audio_speech_rate .. audio_rms_std\naudio_emotion_angry .. audio_emotion_sad\naudio_mask_0 .. audio_mask_6", "22", "Audio analysis"],
        ["TOTAL", "", "466", ""],
    ]
    t2 = Table(feat_data, colWidths=[1.3*inch, 2.2*inch, 0.5*inch, 2.4*inch])
    t2.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), C_ACCENT),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("ALIGN", (2, 0), (2, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.5, C_BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, C_LIGHT_BG]),
        ("BACKGROUND", (0, -1), (-1, -1), C_LIGHT_BG),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t2)
    story.append(Spacer(1, 8))

    story.append(Paragraph("Feature Vector Layout", styles["SubHead2"]))
    story.append(Paragraph(
        "<font face='Courier' size='7'>"
        "466 dims = sbert(384) + emotion(28) + vader(7) + lexical(2) + readability(3) + "
        "first_person(2) + length(3) + punctuation(4) + temporal(3) + health(8) + audio(22)"
        "</font>",
        styles["BodyText2"]))

    story.append(Paragraph("Code Reference", styles["SubHead2"]))
    story.append(Paragraph(
        "<font face='Courier' size='7'>Stage_1/Extract_features.py</font> — "
        "<font face='Courier' size='7'>extract_features()</font> function. "
        "Returns a numpy array of shape (466,) and a human-readable dict.",
        styles["BodyText2"]))
    story.append(PageBreak())

    # ════════════════════════════════════════════════════════════════════
    # SECTION 3: Stage 4 — Anomaly Detection
    # ════════════════════════════════════════════════════════════════════
    story.append(Paragraph("3. Stage 4 — Anomaly Detection & Temporal Features", styles["SectionHead"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_BORDER, spaceAfter=8))

    story.append(Paragraph(
        "Stage 4 applies four anomaly detectors to the temporal window of 466-dim vectors "
        "and produces <b>6 anomaly scores</b> that are appended to the Stage 5 feature vector:",
        styles["BodyText2"]))

    anom_data = [
        ["Score", "Range", "Description"],
        ["mahalanobis", "0.0 – 1.0", "Mahalanobis distance from the user's personal baseline (weighted 0.35)"],
        ["copula", "0.0 – 1.0", "Copula-based multivariate dependency score (weighted 0.35)"],
        ["isolation_forest", "0.0 – 1.0", "Isolation Forest anomaly score (weighted 0.15)"],
        ["knn", "0.0 – 1.0", "K-Nearest Neighbors distance score (weighted 0.15)"],
        ["is_anomaly", "0 or 1", "Binary flag: 1 if any detector exceeds its threshold"],
        ["overall_risk_score", "0.0 – 1.0", "Weighted combination of all detector scores"],
    ]
    t3 = Table(anom_data, colWidths=[1.4*inch, 0.8*inch, 4.2*inch])
    t3.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), C_ACCENT),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTNAME", (0, 1), (0, -1), "Courier"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.5, C_BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, C_LIGHT_BG]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(t3)
    story.append(Spacer(1, 8))

    story.append(Paragraph("Detector Weighting", styles["SubHead2"]))
    story.append(Paragraph(
        "The overall anomaly score is a weighted average: "
        "<font face='Courier' size='7'>mahalanobis(0.35) + copula(0.35) + "
        "isolation_forest(0.15) + knn(0.15)</font>. "
        "All detectors use soft-boundary clipping to [0.001, 0.999] — no detector outputs exact 0.0 or 1.0.",
        styles["BodyText2"]))

    story.append(Paragraph("Code Reference", styles["SubHead2"]))
    story.append(Paragraph(
        "<font face='Courier' size='7'>Stage_4/anomaly_detectors.py</font> — "
        "<font face='Courier' size='7'>DynamicTrajectoryForecastingEngine</font> "
        "and individual detector implementations.",
        styles["BodyText2"]))
    story.append(PageBreak())

    # ════════════════════════════════════════════════════════════════════
    # SECTION 4: Stage 5 — Feature Assembly
    # ════════════════════════════════════════════════════════════════════
    story.append(Paragraph("4. Stage 5 — XGBoost Classification & Feature Assembly", styles["SectionHead"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_BORDER, spaceAfter=8))

    story.append(Paragraph(
        "The <font face='Courier' size='8'>assemble_stage5_features()</font> function "
        "transforms the windowed 466-dim vectors and 6 anomaly scores into a single "
        "<b>2,336-dimensional feature vector</b> that the XGBoost classifier consumes:",
        styles["BodyText2"]))

    story.append(Paragraph("Assembly Process", styles["SubHead"]))
    assembly_data = [
        ["Component", "Calculation", "Dimensions"],
        ["Statistical features", "For each of 466 base features, compute:\nmean, std, max, min across the sliding window", "466 × 4 = 1,864"],
        ["Delta features", "Difference between most recent and previous window values", "466 × 1 = 466"],
        ["Anomaly scores", "Mahalanobis, copula, isolation_forest, knn, is_anomaly, overall_risk_score", "6"],
        ["TOTAL", "", "2,336"],
    ]
    t4 = Table(assembly_data, colWidths=[1.3*inch, 3.2*inch, 1.5*inch])
    t4.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), C_ACCENT),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("ALIGN", (2, 0), (2, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.5, C_BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, C_LIGHT_BG]),
        ("BACKGROUND", (0, -1), (-1, -1), C_LIGHT_BG),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(t4)
    story.append(Spacer(1, 8))

    story.append(Paragraph("XGBoost Model", styles["SubHead"]))
    story.append(Paragraph(
        "The pretrained XGBoost binary classifier is stored in <font face='Courier' size='7'>"
        "Stage_5/model.json</font>. It is loaded via <font face='Courier' size='7'>"
        "xgb.Booster()</font> and calibrated using Platt scaling "
        "(<font face='Courier' size='7'>Stage_5/platt.pkl</font>) and "
        "temperature scaling (<font face='Courier' size='7'>Stage_5/temperature.json</font>).",
        styles["BodyText2"]))
    story.append(Paragraph(
        "The model was trained on the DAIC-WOZ clinical dataset for depression screening. "
        "AUROC is reported on every run for quality assurance.",
        styles["BodyText2"]))

    story.append(Paragraph("Feature Name Generation", styles["SubHead2"]))
    story.append(Paragraph(
        "The function <font face='Courier' size='7'>_generate_stage5_feature_names()</font> "
        "produces exactly 2,336 feature names matching the assembly order: "
        "<font face='Courier' size='7'>mean_sbert_0, mean_sbert_1, ..., "
        "min_days_gap, delta_sbert_0, ..., delta_days_gap, "
        "overall_risk_score, mahalanobis, copula, isolation_forest, knn, is_anomaly</font>.",
        styles["BodyText2"]))
    story.append(PageBreak())

    # ════════════════════════════════════════════════════════════════════
    # SECTION 5: XAI Module
    # ════════════════════════════════════════════════════════════════════
    story.append(Paragraph("5. XAI Module — SHAPExplainer (XAI.py)", styles["SectionHead"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_BORDER, spaceAfter=8))

    story.append(Paragraph(
        "The <font face='Courier' size='8'>SHAPExplainer</font> class in "
        "<font face='Courier' size='8'>XAI/XAI.py</font> wraps the SHAP library "
        "and produces the structured explanation dict consumed by the frontend.",
        styles["BodyText2"]))

    story.append(Paragraph("Initialization", styles["SubHead"]))
    story.append(Paragraph(
        "<font face='Courier' size='7'>"
        "explainer = SHAPExplainer(model, feature_names, background_data=None)<br/>"
        "</font>"
        "• <b>model</b> — XGBoost Booster from <font face='Courier' size='7'>get_model_for_shap()</font><br/>"
        "• <b>feature_names</b> — List of 2,336 strings from <font face='Courier' size='7'>_generate_stage5_feature_names()</font><br/>"
        "• <b>background_data</b> — Optional; not needed for tree models<br/>"
        "Internally creates a <font face='Courier' size='7'>shap.TreeExplainer(model)</font> for fast, exact computation.",
        styles["BodyText2"]))

    story.append(Paragraph("explain() Method", styles["SubHead"]))
    story.append(Paragraph(
        "<font face='Courier' size='7'>"
        "explanation = explainer.explain(X)  # X shape: (2336,) or (1, 2336)<br/>"
        "</font>"
        "Returns a dict with the following structure:",
        styles["BodyText2"]))

    explain_data = [
        ["Key", "Type", "Content"],
        ["base_value", "float", "SHAP base value (model's average prediction)"],
        ["top_features", "list[dict]", "Top 15 features sorted by |SHAP value|, each with:\nfull_name, stat, concept, group, description,\nshap_value, abs_impact, direction, feature_value"],
        ["top_concepts", "list[dict]", "Top 5 concepts aggregated across all stats\n(concept name + total absolute impact)"],
        ["group_impacts", "list[dict]", "5 behavioral domains with total absolute SHAP impact"],
        ["group_features", "dict", "Group name → list of top 5 features in that group"],
        ["sentences", "list[str]", "Plain-English sentences describing the top 3 concept impacts"],
        ["explanation_type", "str", "\"shap\" (constant)"],
    ]
    t5 = Table(explain_data, colWidths=[1.2*inch, 0.9*inch, 4.3*inch])
    t5.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), C_ACCENT),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("FONTNAME", (0, 1), (0, -1), "Courier"),
        ("FONTNAME", (1, 1), (-1, -1), "Helvetica"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.5, C_BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, C_LIGHT_BG]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t5)
    story.append(Spacer(1, 8))

    story.append(Paragraph("Sentence Generation", styles["SubHead2"]))
    story.append(Paragraph(
        "The <font face='Courier' size='7'>_generate_sentences()</font> function takes the "
        "top 3 concepts and generates clinical interpretation sentences. For each concept, "
        "it finds the most impactful stat (e.g., \"Average Sadness over recent entries\") "
        "and appends the direction (\"contributed to increasing the model's predicted risk\").",
        styles["BodyText2"]))

    story.append(Paragraph("Direction Logic", styles["SubHead2"]))
    story.append(Paragraph(
        "<font face='Courier' size='7'>direction = \"increases_risk\" if shap_value > 0 else \"reduces_risk\"</font><br/>"
        "Positive SHAP values push the prediction higher (more risk). "
        "Negative SHAP values push the prediction lower (less risk).",
        styles["BodyText2"]))
    story.append(PageBreak())

    # ════════════════════════════════════════════════════════════════════
    # SECTION 6: Feature Grouping
    # ════════════════════════════════════════════════════════════════════
    story.append(Paragraph("6. Feature Grouping (grouping.py)", styles["SectionHead"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_BORDER, spaceAfter=8))

    story.append(Paragraph(
        "The <font face='Courier' size='8'>XAI/grouping.py</font> file maps each of the 466 "
        "base feature names to a clinical domain, concept name, and display flag. "
        "This enables the XAI module to aggregate SHAP values by behavioral domain "
        "and generate human-readable descriptions.",
        styles["BodyText2"]))

    story.append(Paragraph("BASE_FEATURES Dictionary", styles["SubHead"]))
    story.append(Paragraph(
        "Keys match the pipeline's actual feature names exactly (no aliases needed). "
        "Each entry maps to a dict with:<br/>"
        "• <b>group</b> — Clinical domain (Emotional State, Sentiment, Cognitive Patterns, Writing Style, Behavioural Patterns)<br/>"
        "• <b>concept</b> — Human-readable name (e.g., \"Overall Sentiment\", \"Vocabulary Richness (TTR)\")<br/>"
        "• <b>show</b> — Boolean; whether to display in the SHAP explanation",
        styles["BodyText2"]))

    group_data = [
        ["Domain", "Features", "Show=True Count"],
        ["Emotional State", "emotion_admiration .. emotion_neutral (28)", "28"],
        ["Sentiment", "vader_compound, vader_pos, vader_neg, vader_min_compound,\nvader_max_compound, vader_std_compound", "6"],
        ["Writing Style", "ttr, mtld, readability_fre, readability_fkgl,\nword_count, avg_sentence_length", "6"],
        ["Cognitive Patterns", "first_person_singular, question_ratio, exclamation_ratio,\nellipsis_ratio, caps_ratio", "4"],
        ["Behavioural Patterns", "hour_sin, hour_cos, days_gap", "2"],
        ["TOTAL (show=True)", "", "46"],
    ]
    t6 = Table(group_data, colWidths=[1.5*inch, 3.2*inch, 1.3*inch])
    t6.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), C_ACCENT),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("ALIGN", (2, 0), (2, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.5, C_BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, C_LIGHT_BG]),
        ("BACKGROUND", (0, -1), (-1, -1), C_LIGHT_BG),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t6)
    story.append(Spacer(1, 8))

    story.append(Paragraph("parse_feature_name() Logic", styles["SubHead2"]))
    story.append(Paragraph(
        "Given a full Stage 5 feature name like <font face='Courier' size='7'>"
        "mean_emotion_sadness</font>, the function splits on the first underscore "
        "to extract the stat (<font face='Courier' size='7'>mean</font>) and base "
        "(<font face='Courier' size='7'>emotion_sadness</font>). "
        "The base is looked up in BASE_FEATURES. Stats are: mean, std, min, max, delta.",
        styles["BodyText2"]))

    story.append(Paragraph("ALWAYS_EXCLUDE Set", styles["SubHead2"]))
    story.append(Paragraph(
        "Health, audio, and mask features are excluded from SHAP display because they are "
        "not part of the DAIC-WOZ training data and would show misleading attributions. "
        "The check uses substring matching: <font face='Courier' size='7'>"
        "if excluded in base: return None</font>.",
        styles["BodyText2"]))
    story.append(PageBreak())

    # ════════════════════════════════════════════════════════════════════
    # SECTION 7: Backend Integration
    # ════════════════════════════════════════════════════════════════════
    story.append(Paragraph("7. Backend Integration Pipeline", styles["SectionHead"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_BORDER, spaceAfter=8))

    story.append(Paragraph(
        "The XAI module is integrated at three levels in the backend:",
        styles["BodyText2"]))

    story.append(Paragraph("7.1 Pipeline Integration (unified_pipeline.py)", styles["SubHead"]))
    story.append(Paragraph(
        "The <font face='Courier' size='8'>explain_prediction()</font> method is called "
        "inside <font face='Courier' size='8'>predict_complete_pipeline()</font> after "
        "Stage 5 classification. It:<br/>"
        "1. Retrieves the user's normalized vectors and anomaly scores<br/>"
        "2. Calls <font face='Courier' size='7'>assemble_stage5_features()</font> to build the 2336-dim vector<br/>"
        "3. Creates a <font face='Courier' size='7'>SHAPExplainer</font> with the loaded XGBoost model<br/>"
        "4. Calls <font face='Courier' size='7'>explainer.explain(feature_vec)</font><br/>"
        "5. Stores the result in <font face='Courier' size='7'>result[\"stage_5_explanation\"]</font>",
        styles["BodyText2"]))

    story.append(Paragraph("7.2 Pipeline Runner (pipeline_runner.py)", styles["SubHead"]))
    story.append(Paragraph(
        "After the main pipeline completes, <font face='Courier' size='8'>"
        "pipeline_runner.py</font> makes a second call to "
        "<font face='Courier' size='7'>pipeline.explain_prediction(user_id)</font> "
        "and stores it as <font face='Courier' size='7'>result[\"shap_explanation\"]</font>. "
        "This ensures the explanation is available in the API response even if the initial "
        "pipeline call didn't generate it.",
        styles["BodyText2"]))

    story.append(Paragraph("7.3 Flask API (app.py)", styles["SubHead"]))
    story.append(Paragraph(
        "Two routes serve XAI data:<br/>"
        "• <font face='Courier' size='7'>POST /api/diagnose</font> — Returns the full pipeline result "
        "including <font face='Courier' size='7'>shap_explanation</font> in the response body<br/>"
        "• <font face='Courier' size='7'>POST /api/explain</font> — Dedicated endpoint that calls "
        "<font face='Courier' size='7'>shared.explain_prediction(user_id)</font> directly. "
        "Used when the frontend needs a fresh explanation without re-running the full pipeline.",
        styles["BodyText2"]))
    story.append(PageBreak())

    # ════════════════════════════════════════════════════════════════════
    # SECTION 8: API Endpoints
    # ════════════════════════════════════════════════════════════════════
    story.append(Paragraph("8. API Endpoints", styles["SectionHead"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_BORDER, spaceAfter=8))

    api_data = [
        ["Endpoint", "Method", "Request Body", "Response (XAI portion)"],
        ["/api/diagnose", "POST", "{ user_id: string }", "{ ..., shap_explanation: { base_value, top_features, ... } }"],
        ["/api/explain", "POST", "{ user_id: string }", "{ user_id, explanation: { base_value, top_features, ... } }"],
    ]
    t7 = Table(api_data, colWidths=[1.1*inch, 0.5*inch, 1.6*inch, 3.2*inch])
    t7.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), C_ACCENT),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("FONTNAME", (0, 1), (-1, -1), "Courier"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.5, C_BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, C_LIGHT_BG]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t7)
    story.append(Spacer(1, 12))

    story.append(Paragraph("Example Response (/api/explain)", styles["SubHead"]))
    story.append(Paragraph(
        '<font face="Courier" size="7">'
        "{<br/>"
        '&nbsp;&nbsp;"user_id": "patient_123",<br/>'
        '&nbsp;&nbsp;"explanation": {<br/>'
        '&nbsp;&nbsp;&nbsp;&nbsp;"base_value": 0.4237,<br/>'
        '&nbsp;&nbsp;&nbsp;&nbsp;"top_features": [<br/>'
        '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{ "full_name": "mean_emotion_sadness", "stat": "mean",<br/>'
        '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"concept": "Sadness", "group": "Emotional State",<br/>'
        '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"description": "Average Sadness over recent entries",<br/>'
        '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"shap_value": 0.0823, "abs_impact": 0.0823,<br/>'
        '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"direction": "increases_risk", "feature_value": 0.7231 },<br/>'
        '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;...<br/>'
        '&nbsp;&nbsp;&nbsp;&nbsp;],<br/>'
        '&nbsp;&nbsp;&nbsp;&nbsp;"group_impacts": [<br/>'
        '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{ "group": "Emotional State", "total_impact": 0.2847 },<br/>'
        '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{ "group": "Sentiment", "total_impact": 0.1203 },<br/>'
        '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;...<br/>'
        '&nbsp;&nbsp;&nbsp;&nbsp;],<br/>'
        '&nbsp;&nbsp;&nbsp;&nbsp;"sentences": [<br/>'
        '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"Average Sadness over recent entries contributed to<br/>'
        '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;increasing the model\'s predicted risk."<br/>'
        '&nbsp;&nbsp;&nbsp;&nbsp;],<br/>'
        '&nbsp;&nbsp;&nbsp;&nbsp;"explanation_type": "shap"<br/>'
        '&nbsp;&nbsp;}<br/>'
        "}"
        "</font>",
        styles["BodyText2"]))
    story.append(PageBreak())

    # ════════════════════════════════════════════════════════════════════
    # SECTION 9: Frontend Rendering
    # ════════════════════════════════════════════════════════════════════
    story.append(Paragraph("9. Frontend Rendering & Visualization", styles["SectionHead"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_BORDER, spaceAfter=8))

    story.append(Paragraph(
        "The React frontend (Vite + TypeScript) renders the SHAP explanation in the "
        "dedicated <b>Explainable AI</b> tab.",
        styles["BodyText2"]))

    story.append(Paragraph("9.1 Data Flow (Frontend)", styles["SubHead"]))
    fe_steps = [
        "1. User clicks \"Explainable AI\" in the sidebar or \"Explainable Analysis\" button on the Analytics tab.",
        "2. <font face='Courier' size='7'>App.tsx</font> sets <font face='Courier' size='7'>activeTab = 'explainable'</font>.",
        "3. A <font face='Courier' size='7'>useEffect</font> triggers: if <font face='Courier' size='7'>diagnosticData.pipelineShapExplanation</font> exists (from diagnose response), it uses that directly. Otherwise, it fetches <font face='Courier' size='7'>POST /api/explain</font>.",
        "4. The SHAP data is stored in <font face='Courier' size='7'>shapData</font> state.",
        "5. The <font face='Courier' size='7'>shapData</font> object is destructured: top_features → pushedUp/pushedDown arrays, group_impacts → domain cards, sentences → clinical interpretation cards.",
    ]
    for step in fe_steps:
        story.append(Paragraph(step, styles["BulletItem"]))

    story.append(Paragraph("9.2 Visualization Components", styles["SubHead"]))
    viz_data = [
        ["Component", "Data Source", "Visual"],
        ["LIVE banner", "shapData exists", "Green badge: \"LIVE — TreeSHAP over N attributed features\""],
        ["Score decomposition", "base_value → finalPct", "Two large numbers: Baseline % → Calibrated Risk %"],
        ["Risk Elevating Factors", "pushedUp (top 5)", "Centered waterfall bars (red), extending right from center baseline"],
        ["Protective Factors", "pushedDown (top 5)", "Centered waterfall bars (green), extending left from center baseline"],
        ["Behavioral Signal Domains", "group_impacts (5 domains)", "Card grid with domain name, absolute impact, progress bar"],
        ["Clinical Interpretation", "sentences (top 3)", "Bullet-pointed cards with blue dot markers"],
    ]
    t8 = Table(viz_data, colWidths=[1.5*inch, 1.5*inch, 3.4*inch])
    t8.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), C_ACCENT),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.5, C_BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, C_LIGHT_BG]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t8)
    story.append(Spacer(1, 8))

    story.append(Paragraph("9.3 TypeScript Type Definition", styles["SubHead"]))
    story.append(Paragraph(
        '<font face="Courier" size="7">'
        "pipelineShapExplanation?: {<br/>"
        "&nbsp;&nbsp;base_value: number;<br/>"
        "&nbsp;&nbsp;top_features: { full_name: string; stat: string; concept: string;<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;group: string; description: string; shap_value: number;<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;abs_impact: number; direction: string; feature_value: number; }[];<br/>"
        "&nbsp;&nbsp;top_concepts: { concept: string; total_impact: number; }[];<br/>"
        "&nbsp;&nbsp;group_impacts: { group: string; total_impact: number; }[];<br/>"
        "&nbsp;&nbsp;group_features: Record&lt;string, any[]&gt;;<br/>"
        "&nbsp;&nbsp;sentences: string[];<br/>"
        "&nbsp;&nbsp;explanation_type: string;<br/>"
        "} | null;"
        "</font>",
        styles["BodyText2"]))
    story.append(PageBreak())

    # ════════════════════════════════════════════════════════════════════
    # SECTION 10: File Reference
    # ════════════════════════════════════════════════════════════════════
    story.append(Paragraph("10. Configuration & File Reference", styles["SectionHead"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_BORDER, spaceAfter=8))

    file_data = [
        ["File", "Role", "Key Functions/Exports"],
        ["Stage_1/Extract_features.py", "Feature extraction", "extract_features() → (466-dim array, dict)"],
        ["Stage_4/anomaly_detectors.py", "Anomaly detection", "4 detectors, weighted scoring"],
        ["Stage_4/forecasting/dynamic_detector.py", "Per-detector forecasting", "GradientBoostingRegressor, window=30"],
        ["Stage_5/feature_assembler.py", "Feature assembly", "assemble_stage5_features() → 2336-dim vector"],
        ["Stage_5/model.json", "XGBoost model", "Pretrained on DAIC-WOZ, loaded via xgb.Booster()"],
        ["Stage_5/platt.pkl", "Platt calibrator", "Sklearn PlattScaler for probability calibration"],
        ["Stage_5/temperature.json", "Temperature scaling", "Temperature parameter for calibration"],
        ["Stage_5/inference.py", "Model loading", "get_model_for_shap(), get_feature_names()"],
        ["XAI/XAI.py", "SHAP explanation", "SHAPExplainer class, explain() method"],
        ["XAI/grouping.py", "Feature grouping", "BASE_FEATURES dict, GROUP_ORDER, get_feature_info()"],
        ["unified_pipeline.py", "Pipeline orchestrator", "explain_prediction(), _generate_stage5_feature_names()"],
        ["pipeline_runner.py", "API response builder", "Calls explain_prediction(), stores in result"],
        ["app.py", "Flask API", "/api/diagnose, /api/explain endpoints"],
        ["User Interface/src/App.tsx", "Frontend UI", "Explainable AI tab, waterfall bars, group cards"],
        ["User Interface/src/types.ts", "TypeScript types", "pipelineShapExplanation interface"],
        ["User Interface/src/diagnosisEngine.ts", "Data mapping", "Maps shap_explanation → pipelineShapExplanation"],
    ]
    t9 = Table(file_data, colWidths=[2.0*inch, 1.3*inch, 3.1*inch])
    t9.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), C_ACCENT),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("FONTNAME", (0, 1), (0, -1), "Courier"),
        ("FONTNAME", (1, 1), (-1, -1), "Helvetica"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.5, C_BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, C_LIGHT_BG]),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(t9)
    story.append(Spacer(1, 16))

    story.append(Paragraph("Dependencies", styles["SubHead"]))
    deps = [
        ["Package", "Version", "Usage"],
        ["shap", "0.52.0", "TreeSHAP computation (TreeExplainer for XGBoost)"],
        ["xgboost", "≥2.0", "Model loading (xgb.Booster)"],
        ["numpy", "≥1.24", "Feature vector operations"],
        ["scikit-learn", "≥1.3", "Platt calibrator loading"],
        ["reportlab", "≥4.0", "PDF generation (this document)"],
        ["sentence-transformers", "≥2.2", "SBERT embeddings (Stage 1)"],
        ["nltk", "≥3.8", "VADER sentiment (Stage 1)"],
    ]
    t10 = Table(deps, colWidths=[1.5*inch, 0.8*inch, 4.1*inch])
    t10.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), C_ACCENT),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("ALIGN", (1, 0), (1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.5, C_BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, C_LIGHT_BG]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t10)

    # ── Build ───────────────────────────────────────────────────────────
    doc.build(story)
    print(f"[OK] XAI PDF generated: {output_path}")
    return output_path


if __name__ == "__main__":
    generate_xai_pdf()
