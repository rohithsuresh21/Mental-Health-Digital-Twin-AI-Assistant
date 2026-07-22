"""
Mental Health Digital Twin — Medical Summary PDF Generator
Uses reportlab to produce a clean, professional clinical PDF.
"""

import io
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether, PageBreak,
)
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.graphics.charts.barcharts import VerticalBarChart


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


def _styles():
    ss = getSampleStyleSheet()
    ss.add(ParagraphStyle(
        "DocTitle", fontSize=20, leading=26, textColor=C_PRIMARY,
        fontName="Helvetica-Bold", alignment=TA_CENTER, spaceAfter=4,
    ))
    ss.add(ParagraphStyle(
        "DocSubtitle", fontSize=10, leading=14, textColor=C_MUTED,
        fontName="Helvetica", alignment=TA_CENTER, spaceAfter=20,
    ))
    ss.add(ParagraphStyle(
        "SectionHead", fontSize=11, leading=14, textColor=C_ACCENT,
        fontName="Helvetica-Bold", spaceBefore=16, spaceAfter=6,
    ))
    ss.add(ParagraphStyle(
        "SubHead", fontSize=9, leading=12, textColor=C_PRIMARY,
        fontName="Helvetica-Bold", spaceBefore=8, spaceAfter=4,
    ))
    ss.add(ParagraphStyle(
        "BodyText2", fontSize=9, leading=13, textColor=C_TEXT,
        fontName="Helvetica", spaceAfter=4,
    ))
    ss.add(ParagraphStyle(
        "SmallMuted", fontSize=8, leading=10, textColor=C_MUTED,
        fontName="Helvetica",
    ))
    ss.add(ParagraphStyle(
        "TableCell", fontSize=8, leading=10, textColor=C_TEXT,
        fontName="Helvetica",
    ))
    ss.add(ParagraphStyle(
        "TableCellBold", fontSize=8, leading=10, textColor=C_PRIMARY,
        fontName="Helvetica-Bold",
    ))
    ss.add(ParagraphStyle(
        "TableHeader", fontSize=8, leading=10, textColor=colors.white,
        fontName="Helvetica-Bold",
    ))
    ss.add(ParagraphStyle(
        "RiskHigh", fontSize=9, leading=12, textColor=C_RED,
        fontName="Helvetica-Bold",
    ))
    ss.add(ParagraphStyle(
        "RiskModerate", fontSize=9, leading=12, textColor=C_AMBER,
        fontName="Helvetica-Bold",
    ))
    ss.add(ParagraphStyle(
        "RiskLow", fontSize=9, leading=12, textColor=C_GREEN,
        fontName="Helvetica-Bold",
    ))
    return ss


def _section_divider():
    return HRFlowable(
        width="100%", thickness=0.5, color=C_BORDER,
        spaceBefore=6, spaceAfter=6,
    )


def _kv_table(data, col_widths=None):
    """Key-value pair table (two columns)."""
    if col_widths is None:
        col_widths = [2.2 * inch, 4.3 * inch]
    t = Table(data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), C_MUTED),
        ("TEXTCOLOR", (1, 0), (1, -1), C_TEXT),
    ]))
    return t


def _risk_color(score):
    if score > 75:
        return C_RED
    if score > 55:
        return C_AMBER
    if score > 40:
        return C_AMBER
    return C_GREEN


def _risk_label(score):
    if score > 75:
        return "Critical Concern"
    if score > 55:
        return "Moderate Concern"
    if score > 40:
        return "Slight Concern"
    return "Excellent"


def generate_pdf(diagnostic_data: dict, inputs: dict) -> bytes:
    """
    Generate a professional clinical summary PDF.

    Parameters
    ----------
    diagnostic_data : dict
        The DiagnosticData object mapped in the frontend (anomalyBehaviourScore, etc.)
    inputs : dict
        The IngestionInput (fullName, age, gender, sleepDuration, etc.)

    Returns
    -------
    bytes  — PDF file content
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=letter,
        leftMargin=0.6 * inch, rightMargin=0.6 * inch,
        topMargin=0.5 * inch, bottomMargin=0.6 * inch,
    )
    S = _styles()
    story = []
    date_str = datetime.now().strftime("%B %d, %Y")
    time_str = datetime.now().strftime("%I:%M %p")

    # ── HEADER ──────────────────────────────────────────────────────────────
    story.append(Paragraph("Mental Health Digital Twin AI", S["DocTitle"]))
    story.append(Paragraph("Ongoing Medical Summary Report", S["DocSubtitle"]))
    story.append(_section_divider())

    # ── PATIENT INFORMATION ─────────────────────────────────────────────────
    story.append(Paragraph("PATIENT INFORMATION", S["SectionHead"]))
    d = diagnostic_data
    p = inputs
    score_val = d.get("anomalyBehaviourScore", 0)

    patient_data = [
        [Paragraph("Name", S["TableCellBold"]),
         Paragraph(str(p.get("fullName", "N/A")), S["TableCell"]),
         Paragraph("Report Date", S["TableCellBold"]),
         Paragraph(date_str, S["TableCell"])],
        [Paragraph("Age", S["TableCellBold"]),
         Paragraph(str(p.get("age", "N/A")), S["TableCell"]),
         Paragraph("Gender", S["TableCellBold"]),
         Paragraph(str(p.get("gender", "N/A")), S["TableCell"])],
        [Paragraph("Report Time", S["TableCellBold"]),
         Paragraph(time_str, S["TableCell"]),
         Paragraph("Risk Classification", S["TableCellBold"]),
         Paragraph(_risk_label(score_val), S["TableCell"])],
    ]
    pt = Table(patient_data, colWidths=[1.1*inch, 2.4*inch, 1.3*inch, 2.1*inch])
    pt.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, C_BORDER),
        ("BACKGROUND", (0, 0), (0, -1), C_LIGHT_BG),
        ("BACKGROUND", (2, 0), (2, -1), C_LIGHT_BG),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(pt)
    story.append(Spacer(1, 8))

    # ── OVERALL ASSESSMENT ──────────────────────────────────────────────────
    story.append(Paragraph("OVERALL ASSESSMENT", S["SectionHead"]))
    story.append(_section_divider())

    intervention = "Yes" if score_val > 40 else "No"
    entries_count = d.get("pipelineNEntries") or d.get("extractedDimensions", "N/A")

    assess_data = [
        [Paragraph("Metric", S["TableHeader"]),
         Paragraph("Value", S["TableHeader"]),
         Paragraph("Details", S["TableHeader"])],
        [Paragraph("Risk Score", S["TableCellBold"]),
         Paragraph(f"{score_val}%", S["TableCell"]),
         Paragraph(_risk_label(score_val), S["TableCell"])],
        [Paragraph("Anomaly Status", S["TableCellBold"]),
         Paragraph(str(d.get("anomalyStatus", "N/A")), S["TableCell"]),
         Paragraph(f"Trend: {'Rising' if d.get('anomalyDirection') == 'up' else 'Stable'}", S["TableCell"])],
        [Paragraph("Entries Analyzed", S["TableCellBold"]),
         Paragraph(str(entries_count), S["TableCell"]),
         Paragraph(f"Risk Level: {d.get('pipelineRiskLevel', 'N/A')}", S["TableCell"])],
        [Paragraph("Intervention", S["TableCellBold"]),
         Paragraph(intervention, S["TableCell"]),
         Paragraph("Recommended clinical review" if intervention == "Yes" else "Routine monitoring", S["TableCell"])],
        [Paragraph("Model Confidence", S["TableCellBold"]),
         Paragraph(f"{d.get('modelConfidence', 0):.1f}%", S["TableCell"]),
         Paragraph("", S["TableCell"])],
    ]
    at = Table(assess_data, colWidths=[1.5*inch, 2.5*inch, 2.9*inch])
    at.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), C_DARK_BG),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, C_BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, C_LIGHT_BG]),
    ]))
    story.append(at)

    # Risk colour bar
    risk_pct = min(score_val, 100)
    bar_drawing = Drawing(6.9 * inch, 14)
    bar_drawing.add(Rect(0, 0, 6.9 * inch, 10, fillColor=C_LIGHT_BG, strokeColor=None))
    bar_drawing.add(Rect(0, 0, 6.9 * inch * risk_pct / 100, 10,
                         fillColor=_risk_color(score_val), strokeColor=None))
    story.append(Spacer(1, 4))
    story.append(bar_drawing)
    story.append(Spacer(1, 6))

    # ── KEY BEHAVIORAL METRICS ──────────────────────────────────────────────
    story.append(Paragraph("KEY BEHAVIORAL METRICS", S["SectionHead"]))
    story.append(_section_divider())

    metrics_data = [
        [Paragraph("Metric", S["TableHeader"]),
         Paragraph("Value", S["TableHeader"]),
         Paragraph("Interpretation", S["TableHeader"])],
        [Paragraph("Linguistic Shift", S["TableCellBold"]),
         Paragraph(f"{d.get('linguisticShift', 0):.4f}", S["TableCell"]),
         Paragraph("Degree of change in language patterns over time", S["TableCell"])],
        [Paragraph("Behavioral Prosody", S["TableCellBold"]),
         Paragraph(f"{d.get('behavioralProsody', 0):.4f}", S["TableCell"]),
         Paragraph("Vocal rhythm and speech pause patterns", S["TableCell"])],
        [Paragraph("Routine Disruption", S["TableCellBold"]),
         Paragraph(f"{d.get('routineDisruption', 0):.1f}%", S["TableCell"]),
         Paragraph("Deviation from normal sleep and daily routine", S["TableCell"])],
        [Paragraph("Daily Variance", S["TableCellBold"]),
         Paragraph(f"{d.get('avgDailyVariance', 0):.1f}%", S["TableCell"]),
         Paragraph("Average day-to-day behavioral fluctuation", S["TableCell"])],
        [Paragraph("Transparency Score", S["TableCellBold"]),
         Paragraph(f"{d.get('transparencyScore', 0):.2f}", S["TableCell"]),
         Paragraph("Model explainability index (higher = more transparent)", S["TableCell"])],
    ]
    mt = Table(metrics_data, colWidths=[1.5*inch, 1.3*inch, 4.1*inch])
    mt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), C_DARK_BG),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, C_BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, C_LIGHT_BG]),
    ]))
    story.append(mt)
    story.append(Spacer(1, 6))

    # ── TOP FEATURE CONTRIBUTORS ────────────────────────────────────────────
    story.append(Paragraph("TOP FEATURE CONTRIBUTORS", S["SectionHead"]))
    story.append(_section_divider())

    top_features = d.get("top3FeatureIndices", [])
    if top_features:
        feat_data = [
            [Paragraph("#", S["TableHeader"]),
             Paragraph("Feature", S["TableHeader"]),
             Paragraph("Correlation", S["TableHeader"]),
             Paragraph("Confidence", S["TableHeader"]),
             Paragraph("Status", S["TableHeader"])],
        ]
        for i, f in enumerate(top_features, 1):
            status = f.get("status", "Normal")
            if status and status != "Normal":
                status_text = f'<font color="#c0392b"><b>{status}</b></font>'
            else:
                status_text = '<font color="#27ae60">Normal</font>'
            feat_data.append([
                Paragraph(str(i), S["TableCell"]),
                Paragraph(f.get("indexTarget", "N/A"), S["TableCellBold"]),
                Paragraph(f"{f.get('correlationScore', 0):.2f}", S["TableCell"]),
                Paragraph(f"{f.get('confidence', 0):.2f}", S["TableCell"]),
                Paragraph(status_text, S["TableCell"]),
            ])
        ft = Table(feat_data, colWidths=[0.4*inch, 2.0*inch, 1.3*inch, 1.2*inch, 2.0*inch])
        ft.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), C_DARK_BG),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.5, C_BORDER),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, C_LIGHT_BG]),
        ]))
        story.append(ft)
    story.append(Spacer(1, 6))

    # ── LIFESTYLE CORRELATIONS ──────────────────────────────────────────────
    story.append(Paragraph("LIFESTYLE vs DIAGNOSTIC CORRELATIONS", S["SectionHead"]))
    story.append(_section_divider())

    lifestyle = d.get("lifestyleVsDiagnosticCorrelation", [])
    if lifestyle:
        lc_data = [
            [Paragraph("Lifestyle Factor", S["TableHeader"]),
             Paragraph("Correlation", S["TableHeader"]),
             Paragraph("Strength", S["TableHeader"])],
        ]
        for c in lifestyle:
            corr = c.get("correlation", 0)
            if corr >= 0.7:
                strength = '<font color="#c0392b"><b>Strong</b></font>'
            elif corr >= 0.4:
                strength = '<font color="#f39c12"><b>Moderate</b></font>'
            else:
                strength = '<font color="#27ae60">Weak</font>'
            lc_data.append([
                Paragraph(c.get("target", "N/A"), S["TableCellBold"]),
                Paragraph(f"{corr:.2f}", S["TableCell"]),
                Paragraph(strength, S["TableCell"]),
            ])
        lct = Table(lc_data, colWidths=[2.5*inch, 2.0*inch, 2.4*inch])
        lct.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), C_DARK_BG),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.5, C_BORDER),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, C_LIGHT_BG]),
        ]))
        story.append(lct)
    story.append(Spacer(1, 6))

    # ── CLINICAL INSIGHTS ───────────────────────────────────────────────────
    insights = d.get("insights", [])
    if insights:
        story.append(Paragraph("CLINICAL INSIGHTS", S["SectionHead"]))
        story.append(_section_divider())
        for insight in insights:
            story.append(Paragraph(f"&#8226;  {insight}", S["BodyText2"]))
        story.append(Spacer(1, 6))

    # ── HEALTH INPUTS ───────────────────────────────────────────────────────
    story.append(Paragraph("PATIENT-REPORTED HEALTH DATA", S["SectionHead"]))
    story.append(_section_divider())

    health_data = [
        [Paragraph("Parameter", S["TableHeader"]),
         Paragraph("Value", S["TableHeader"])],
        [Paragraph("Sleep Duration", S["TableCellBold"]),
         Paragraph(f"{p.get('sleepDuration', 'N/A')} hours", S["TableCell"])],
        [Paragraph("Sleep Quality", S["TableCellBold"]),
         Paragraph(f"{p.get('sleepQuality', 'N/A')} / 5", S["TableCell"])],
        [Paragraph("Physical Activity", S["TableCellBold"]),
         Paragraph(f"{p.get('physicalActivity', 'N/A')} / 5", S["TableCell"])],
    ]
    if p.get("medicalHistory"):
        health_data.append([
            Paragraph("Medical History", S["TableCellBold"]),
            Paragraph(str(p["medicalHistory"]), S["TableCell"]),
        ])
    if p.get("symptoms"):
        health_data.append([
            Paragraph("Reported Symptoms", S["TableCellBold"]),
            Paragraph(str(p["symptoms"]), S["TableCell"]),
        ])
    ht = Table(health_data, colWidths=[2.0*inch, 4.9*inch])
    ht.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), C_DARK_BG),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, C_BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, C_LIGHT_BG]),
    ]))
    story.append(ht)

    # ── PAGE 2: FEATURE RISK ANALYSIS TABLE ─────────────────────────────────
    story.append(PageBreak())
    story.append(Paragraph("FEATURE RISK ANALYSIS", S["DocTitle"]))
    story.append(Paragraph("Which entries and features contributed to elevated risk scores", S["DocSubtitle"]))
    story.append(_section_divider())

    # Build the risk analysis table from available data
    timestamps = d.get("pipelineTimestamps", [])
    anomaly_scores = d.get("pipelineAnomalyScores", [])
    sentiments = d.get("pipelineSentimentSeries", [])
    emotions = d.get("pipelineEmotionsSeries", [])
    detector_scores = d.get("pipelineDetectorScores", [])

    if timestamps:
        story.append(Paragraph(
            "The table below shows each analyzed entry, its risk contribution, "
            "dominant emotion, sentiment, and the per-detector scores that drove "
            "the overall assessment.",
            S["BodyText2"],
        ))
        story.append(Spacer(1, 8))

        # Summary stats
        avg_anomaly = sum(anomaly_scores) / len(anomaly_scores) * 100 if anomaly_scores else 0
        max_anomaly = max(anomaly_scores) * 100 if anomaly_scores else 0
        high_risk_count = sum(1 for s in anomaly_scores if s > 0.6)
        story.append(Paragraph(
            f"<b>Total entries:</b> {len(timestamps)} &nbsp;&nbsp;|&nbsp;&nbsp; "
            f"<b>Avg anomaly:</b> {avg_anomaly:.1f}% &nbsp;&nbsp;|&nbsp;&nbsp; "
            f"<b>Peak anomaly:</b> {max_anomaly:.1f}% &nbsp;&nbsp;|&nbsp;&nbsp; "
            f"<b>High-risk entries:</b> {high_risk_count}/{len(timestamps)}",
            S["BodyText2"],
        ))
        story.append(Spacer(1, 8))

        # Main entry-level table
        header = [
            Paragraph("#", S["TableHeader"]),
            Paragraph("Date", S["TableHeader"]),
            Paragraph("Risk %", S["TableHeader"]),
            Paragraph("Sentiment", S["TableHeader"]),
            Paragraph("Emotion", S["TableHeader"]),
            Paragraph("Mahal.", S["TableHeader"]),
            Paragraph("Copula", S["TableHeader"]),
            Paragraph("Iso.For.", S["TableHeader"]),
            Paragraph("KNN", S["TableHeader"]),
        ]
        table_rows = [header]

        for i in range(len(timestamps)):
            ts = str(timestamps[i])[:10] if timestamps[i] else "N/A"
            anomaly_pct = (anomaly_scores[i] * 100) if i < len(anomaly_scores) else 0
            sent = f"{sentiments[i]:.3f}" if i < len(sentiments) else "N/A"
            emo = str(emotions[i]) if i < len(emotions) else "N/A"

            det = detector_scores[i] if i < len(detector_scores) else {}
            mah = f"{det.get('mahalanobis', 0):.3f}"
            cop = f"{det.get('copula', 0):.3f}"
            iso = f"{det.get('isolation_forest', 0):.3f}"
            knn_val = f"{det.get('knn', 0):.3f}"

            # Highlight high-risk rows
            row_bg = colors.white
            if anomaly_pct > 60:
                row_bg = colors.HexColor("#fff5f5")
            elif anomaly_pct > 40:
                row_bg = colors.HexColor("#fffbf0")

            risk_color_hex = "#27ae60"
            if anomaly_pct > 75:
                risk_color_hex = "#c0392b"
            elif anomaly_pct > 55:
                risk_color_hex = "#e67e22"
            elif anomaly_pct > 40:
                risk_color_hex = "#f39c12"

            table_rows.append([
                Paragraph(str(i + 1), S["TableCell"]),
                Paragraph(ts, S["TableCell"]),
                Paragraph(f'<font color="{risk_color_hex}"><b>{anomaly_pct:.1f}%</b></font>', S["TableCell"]),
                Paragraph(sent, S["TableCell"]),
                Paragraph(emo, S["TableCell"]),
                Paragraph(mah, S["TableCell"]),
                Paragraph(cop, S["TableCell"]),
                Paragraph(iso, S["TableCell"]),
                Paragraph(knn_val, S["TableCell"]),
            ])

        col_w = [0.35*inch, 0.85*inch, 0.65*inch, 0.7*inch, 0.85*inch,
                 0.7*inch, 0.7*inch, 0.7*inch, 0.65*inch]
        entry_table = Table(table_rows, colWidths=col_w, repeatRows=1)

        style_cmds = [
            ("BACKGROUND", (0, 0), (-1, 0), C_DARK_BG),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.4, C_BORDER),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("FONTSIZE", (0, 0), (-1, -1), 7),
        ]
        # Alternate row colors + highlight high-risk
        for row_idx in range(1, len(table_rows)):
            if row_idx < len(anomaly_scores) + 1:
                a_idx = row_idx - 1
                if a_idx < len(anomaly_scores):
                    a_val = anomaly_scores[a_idx]
                    if a_val > 0.6:
                        style_cmds.append(("BACKGROUND", (0, row_idx), (-1, row_idx),
                                           colors.HexColor("#fff0f0")))
                    elif row_idx % 2 == 0:
                        style_cmds.append(("BACKGROUND", (0, row_idx), (-1, row_idx), C_LIGHT_BG))
                    elif row_idx % 2 == 1:
                        style_cmds.append(("BACKGROUND", (0, row_idx), (-1, row_idx), colors.white))

        entry_table.setStyle(TableStyle(style_cmds))
        story.append(entry_table)

        # Legend
        story.append(Spacer(1, 10))
        story.append(Paragraph(
            "<b>Column Legend:</b>  Mahal. = Mahalanobis Distance (pattern deviation)  |  "
            "Copula = Behavioral Shift  |  Iso.For. = Isolation Forest (outlier detection)  |  "
            "KNN = K-Nearest Neighbors (cluster drift)",
            S["SmallMuted"],
        ))
        story.append(Spacer(1, 6))
        story.append(Paragraph(
            "<b>Row Highlighting:</b>  <font color=\"#c0392b\">Red background</font> = High risk (>60%)  |  "
            "<font color=\"#f39c12\">Amber background</font> = Moderate risk (>40%)  |  "
            "White/Grey = Normal range",
            S["SmallMuted"],
        ))
    else:
        story.append(Paragraph(
            "No temporal entry data available for risk analysis. "
            "Run a pipeline analysis with journal entries to generate the entry-level breakdown.",
            S["BodyText2"],
        ))

    # ── FOOTER ──────────────────────────────────────────────────────────────
    story.append(Spacer(1, 20))
    story.append(_section_divider())
    story.append(Paragraph(
        f"Mental Health Digital Twin AI &mdash; Automated Report &mdash; Generated {date_str} at {time_str}",
        S["SmallMuted"],
    ))
    story.append(Paragraph(
        "This report is generated by an AI system and is intended for informational purposes only. "
        "It does not constitute a medical diagnosis. Please consult a qualified healthcare professional "
        "for clinical decisions.",
        S["SmallMuted"],
    ))

    # ── BUILD ───────────────────────────────────────────────────────────────
    doc.build(story)
    buf.seek(0)
    return buf.read()
