"""End-to-end: every number on the result pages vs the raw model output, and the Guide's answers + navigation."""
import json, math, re, statistics as st, datetime as dt
from playwright.sync_api import sync_playwright
import os, sys
B = os.environ.get("MHDT_URL", "http://127.0.0.1:47821"); S = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots_"); UID = sys.argv[1] if len(sys.argv) > 1 else "sim_patient"
R = {"pass": 0, "fail": 0}
def ok(c, m):
    R["pass" if c else "fail"] += 1; print(("PASS " if c else "FAIL ") + m)
pct = lambda v, d=0: "—" if v is None else f"{v*100:.{d}f}%"
MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; DAY = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]
def fday(s): d = dt.date.fromisoformat(s); return f"{MON[d.month-1]} {d.day}"
def flong(s): d = dt.date.fromisoformat(s); return f"{DAY[d.weekday()]}, {MON[d.month-1]} {d.day}"
sig = lambda x: 1/(1+math.exp(-x))
with sync_playwright() as p:
    br = p.chromium.launch(executable_path=os.environ.get("CHROMIUM") or None)
    pg = br.new_context(viewport={"width": 1440, "height": 920}).new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    box = {}
    pg.on("response", lambda r: box.__setitem__("raw", r.json()) if r.url.endswith("/api/diagnose") and r.status == 200 else None)
    pg.goto(B + "/"); pg.evaluate("u=>{localStorage.setItem('userId',u);localStorage.setItem('role','patient')}", UID)
    pg.goto(B + "/"); pg.get_by_text("Patient", exact=True).click(); pg.wait_for_url("**/patient"); pg.wait_for_timeout(800)
    pg.get_by_role("button", name="System Menu").click(); pg.wait_for_timeout(300); pg.locator("#tab-patient-analysis").click(); pg.wait_for_timeout(600)
    pg.click("#run-patient-analysis"); pg.wait_for_selector("#analytics-tab", timeout=900000); pg.wait_for_timeout(2800)
    raw = box["raw"]; n = len(raw["timestamps"]); p_ = raw["prediction"]["probability"]
    print("== Results page vs raw output")
    body = pg.inner_text("#analytics-tab")
    ok(f"{round(p_*100)}\n%" in body or f"{round(p_*100)}%" in body.replace("\n", ""), f"risk number {round(p_*100)}%")
    lvl = raw["prediction"]["risk_level"].capitalize(); ok(f"{lvl} risk" in body, f"headline level '{lvl} risk'")
    ud = sum(raw["is_anomaly_flags"]); ok(f"{ud} of {n} days" in body, f"summary: {ud} of {n} days")
    wk = min(7, n // 2); me, ml = st.mean(raw["sentiment_series"][:wk]), st.mean(raw["sentiment_series"][-wk:])
    ok(f"{pct(me)} to {pct(ml)}" in body.replace("\n", " "), f"mood tone {pct(me)} to {pct(ml)}")
    ok(raw["cusum_status"]["current_title"] in body, f"drift: {raw['cusum_status']['current_title']}")
    tl = pg.locator("[aria-label^='Daily timeline']"); tl.focus()
    for i in [0, 9, n - 1]:
        tl.focus(); pg.keyboard.press("Escape")
        for _ in range(i + 1): pg.keyboard.press("ArrowRight")
        pg.wait_for_timeout(120); tip = tl.inner_text()
        good = flong(raw["timestamps"][i]) in tip and pct(raw["sentiment_series"][i]) in tip and pct(raw["anomaly_scores"][i]) in tip and raw["emotions_series"][i].capitalize() in tip
        ok(good, f"tooltip day {i+1} ({flong(raw['timestamps'][i])}): mood {pct(raw['sentiment_series'][i])}, unusual {pct(raw['anomaly_scores'][i])}, {raw['emotions_series'][i]}")
    last_det = raw["detector_scores"][-1]; dtxt = pg.inner_text("[data-guide='detectors']")
    ok(all(pct(v) in dtxt for v in last_det.values()), "detector scores for the latest day")
    pg.screenshot(path=S + "results.png", full_page=True)
    print("== Why page vs SHAP maths")
    pg.get_by_role("button", name="Why this score").click(); pg.wait_for_timeout(3500)
    wtxt = pg.inner_text("[data-guide='waterfall']")
    sx = raw["shap_explanation"]; base = sig(sx["base_value"])
    ok(pct(base, 1) in wtxt, f"starting point {pct(base,1)}")
    ok(pct(p_) in wtxt.split("Your estimate")[-1], f"final estimate {pct(p_)}")
    deltas = [float(x.replace("−", "-")) for x in re.findall(r"(?m)^([+−]\d+\.\d)$", wtxt)]
    ok(abs(base * 100 + sum(deltas) - p_ * 100) < 0.1 * len(deltas) + 0.05, f"steps add up: {base*100:.1f} + ({sum(deltas):.1f}) = {p_*100:.1f} (rounding ≤ {0.05*len(deltas):.2f})")
    pg.screenshot(path=S + "why.png", full_page=True)
    print("== Outlook page vs forecast")
    pg.get_by_role("button", name="See the next 7 days").click(); pg.wait_for_timeout(3500)
    dtx = pg.inner_text("[data-guide='days']")
    fc = raw["tft_forecast_14day"]; last = dt.date.fromisoformat(raw["timestamps"][-1])
    ok(all(str(round(v * 100)) in dtx for v in fc), f"7 day cards show {[round(v*100) for v in fc]}")
    ok(all(fday((last + dt.timedelta(days=i + 1)).isoformat()) in dtx for i in range(7)), "day cards carry the next 7 real dates")
    pg.screenshot(path=S + "outlook.png", full_page=True)
    pg.get_by_role("button", name="Results").first.click(); pg.wait_for_timeout(800)

    print("== Guide answers + navigation")
    pg.click("#guide-toggle"); pg.wait_for_timeout(400)
    def ask(q):
        pg.fill("input[aria-label='Ask the guide']", q); pg.keyboard.press("Enter"); pg.wait_for_timeout(2300)
        msgs = pg.locator("#guide [aria-live] > div"); return msgs.last.inner_text()
    def page_is(h): return h in pg.inner_text("main")
    def spot(t): return pg.locator(f"[data-guide='{t}']").first.is_visible()
    extreme_worst = min(range(n), key=lambda i: raw["sentiment_series"][i])
    w_rows_up = [f for f in sx["top_features"][:8] if f["shap_value"] > 0]
    fcm = st.mean(fc)
    cases = [
        ("hello", lambda a: "Guide" in a),
        ("What does my score mean?", lambda a: pct(p_) in a and lvl in a and spot("risk")),
        ("Why is my score this high?", lambda a: pct(p_) in a and page_is("Why this score")),
        ("What raised my score?", lambda a: w_rows_up[0]["description"] in a and page_is("Why this score")),
        ("What lowered it?", lambda a: "lowered" in a and page_is("Why this score")),
        ("What is calibration?", lambda a: "calibration" in a.lower() and page_is("Why this score")),
        ("Is this a diagnosis?", lambda a: "not a diagnosis" in a),
        ("What happens next week?", lambda a: pct(fcm) in a and page_is("The next 7 days")),
        ("Will tomorrow be better?", lambda a: str(round(fc[0]*100)) in a and spot("days")),
        ("What is the twin index?", lambda a: "50%" in a and spot("composition")),
        ("What is the shaded range?", lambda a: "day-to-day" in a and spot("fan")),
        ("Why need 37 days?", lambda a: "37" in a and str(n) in a and spot("detector-forecast")),
        ("How was Oct 10?", lambda a: "Sat, Oct 10" in a and "Sat, Oct 10" in pg.locator("[aria-label^='Daily timeline']").inner_text()),
        ("What was my worst day?", lambda a: flong(raw["timestamps"][extreme_worst]) in a and flong(raw["timestamps"][extreme_worst]) in pg.locator("[aria-label^='Daily timeline']").inner_text()),
        ("how was dec 25", lambda a: "don't have an entry" in a),
        ("What are unusual days?", lambda a: f"{ud} of {n}" in a and spot("timeline")),
        ("What is drift?", lambda a: raw["cusum_status"]["current_title"] in a and spot("facts")),
        ("What is mood tone?", lambda a: pct(me) in a and pct(ml) in a),
        ("What are the detectors?", lambda a: "Pattern distance" in a and spot("detectors")),
        ("How do I read the day by day chart?", lambda a: "Blue line" in a and spot("timeline")),
        ("How do I download the PDF?", lambda a: "PDF" in a and spot("pdf")),
        ("How do I check in?", lambda a: "Submit check-in" in a and pg.locator("#checkin-form").is_visible()),
        ("How do I export WhatsApp?", lambda a: "Export chat" in a and pg.locator("#chat-import").is_visible()),
        ("How many days until analysis?", lambda a: "streak" in a and pg.locator("#my-data").is_visible()),
        ("Is my data private?", lambda a: "on this computer" in a),
        ("Explain everything A–Z", lambda a: "Baseline" in a and "Twin index" in a),
        ("I want to kill myself", lambda a: "14416" in a and "112" in a),
        ("asdfgh qwerty", lambda a: "I can explain anything" in a),
    ]
    for q, check in cases:
        a = ask(q)
        try: good = check(a)
        except Exception as e: good = False; a += f" [{e}]"
        ok(good, f"guide: {q!r} -> {a.splitlines()[0][:90]}")
        if q in ("How was Oct 10?", "What raised my score?", "I want to kill myself", "Will tomorrow be better?"):
            pg.screenshot(path=S + "guide_" + re.sub(r"\W+", "_", q)[:20] + ".png")
    print("page errors:", errs[:5])
    print(f"\nTOTAL: {R['pass']} passed, {R['fail']} failed")
    br.close()
