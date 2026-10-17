// The Guide's brain: offline intent matching + answers computed from the user's own results.
// Nothing leaves the computer. Every number comes from insights/derive.ts (the same code the pages use).
import { overview, dayInfo, extremes, waterfall, forecast } from '../insights/derive';
import { RISK, pct, fmtDay, fmtDayLong, parseDay, cap } from '../insights/theme';
import type { NavAction } from './bus';

export type Ctx = { raw: any | null; isPatient: boolean; status: any | null };
export type Reply = { text: string; nav?: NavAction; chips?: string[]; kind?: 'crisis' | 'normal' };

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9%'\-/ ]+/g, ' ').replace(/\s+/g, ' ').trim();

const CRISIS = /(suicid|kill myself|killing myself|end my life|ending my life|want to die|wanna die|self ?harm|hurt myself|harm myself|cut myself|no reason to live|better off dead|can't go on|cant go on)/;

type Intent = { id: string; terms: (string | [string, number])[]; needsRaw?: boolean };
const INTENTS: Intent[] = [
  { id: 'greet', terms: ['hi', 'hello', 'hey', 'namaste', 'good morning', 'good evening'] },
  { id: 'thanks', terms: ['thanks', 'thank you', 'thx', 'great', 'nice', 'awesome'] },
  { id: 'glossary', terms: [['a-z', 3], ['a to z', 3], ['glossary', 3], ['explain everything', 3], ['all terms', 3], ['what can you', 2], ['help', 1], ['what do you do', 2], ['how to use', 2], ['guide me', 2], ['tour', 2]] },
  { id: 'risk', terms: [['risk', 2], ['score', 2], ['percent', 1], ['%', 1], ['estimate', 1], ['probability', 2], ['how am i', 2], ['am i ok', 2], ['how bad', 2], ['result', 1], ['what does it mean', 1]], needsRaw: true },
  { id: 'levels', terms: [['low moderate high', 3], ['risk levels', 3], ['moderate mean', 3], ['high mean', 2], ['what is moderate', 3], ['levels', 2]] },
  { id: 'diagnosis', terms: [['diagnosis', 3], ['diagnose', 3], ['depressed', 2], ['depression', 2], ['accurate', 3], ['accuracy', 3], ['trust', 2], ['reliable', 3], ['am i sick', 3], ['doctor', 1], ['real', 1]] },
  { id: 'calibration', terms: [['what is calibration', 5], ['calibration step', 5], ['calibration mean', 5], ['calibrated probability', 5]], needsRaw: true },
  { id: 'det_forecast', terms: [['37', 4], ['detector forecast', 6], ['detectors forecast', 6], ['each detector', 4]], needsRaw: true },
  { id: 'read_timeline', terms: [['day by day', 5], ['read the chart', 4], ['how to read', 4], ['read this chart', 5], ['timeline', 3]] },
  { id: 'why', terms: [['explain my score', 6], ['simply', 2], ['why', 4], ['explain', 2], ['reason', 2], ['cause', 2], ['because', 1], ['waterfall', 3], ['shap', 3]], needsRaw: true },
  { id: 'raised', terms: [['raised', 3], ['increase', 2], ['increased', 3], ['pushed up', 3], ['made it higher', 3], ['worse', 1], ['biggest', 2], ['main factor', 3], ['top factor', 3], ['driver', 2]], needsRaw: true },
  { id: 'lowered', terms: [['lowered', 3], ['reduced', 3], ['decrease', 2], ['pushed down', 3], ['protective', 3], ['helped', 2], ['good signs', 3], ['positive signs', 3]], needsRaw: true },
  { id: 'forecast', terms: [['forecast', 3], ['next week', 3], ['next 7', 3], ['future', 2], ['tomorrow', 3], ['predict', 2], ['coming days', 3], ['outlook', 3], ['will i', 2], ['going to be', 2]], needsRaw: true },
  { id: 'index', terms: [['twin index', 4], ['index', 2], ['twin', 2], ['tft', 3], ['transformer', 2]] },
  { id: 'band', terms: [['shaded', 3], ['band', 2], ['range', 2], ['uncertain', 2], ['uncertainty', 3], ['grey area', 2], ['gray area', 2]] },
  { id: 'unusual', terms: [['unusual', 3], ['unusualness', 4], ['anomal', 3], ['different', 2], ['orange bars', 3], ['flagged', 3], ['out of character', 3], ['abnormal', 2]], needsRaw: true },
  { id: 'drift', terms: [['drift', 4], ['drifting', 4], ['cusum', 4], ['shift', 2], ['above baseline', 3], ['yellow', 2], ['long term', 2], ['alert', 2]], needsRaw: true },
  { id: 'baseline', terms: [['baseline', 3], ['calibrat', 3], ['14 days', 3], ['fourteen', 2], ['usual range', 3], ['normal range', 3], ['personal', 1], ['locked', 2], ['unlock', 2]] },
  { id: 'mood', terms: [['mood tone', 4], ['sentiment', 3], ['blue line', 3], ['tone', 2], ['positive negative', 2], ['how i wrote', 2]], needsRaw: true },
  { id: 'emotions', terms: [['emotion', 3], ['emotions', 3], ['dots', 2], ['feelings', 2], ['nervousness', 2], ['anger', 2], ['sadness', 2], ['joy', 2]], needsRaw: true },
  { id: 'detectors', terms: [['detector', 4], ['detectors', 4], ['mahalanobis', 4], ['copula', 4], ['isolation', 3], ['knn', 3], ['nearest', 2], ['outlier', 2], ['four', 1]], needsRaw: true },
  { id: 'checkins', terms: [['sleep', 3], ['activity', 3], ['slider', 3], ['sliders', 3], ['exercise', 2], ['self-rated', 2], ['self rated', 2]], needsRaw: true },
  { id: 'best', terms: [['best day', 5], ['happiest', 5], ['good day', 3], ['best', 2], ['brightest', 3]], needsRaw: true },
  { id: 'worst', terms: [['worst day', 5], ['saddest', 5], ['bad day', 3], ['lowest', 3], ['worst', 3], ['hardest', 3]], needsRaw: true },
  { id: 'oddest', terms: [['most unusual', 6], ['most different', 6], ['strangest', 5], ['oddest', 5], ['biggest spike', 5]], needsRaw: true },
  { id: 'checkin_how', terms: [['check in', 3], ['check-in', 3], ['checkin', 3], ['submit', 2], ['journal', 2], ['write', 1], ['log', 2], ['add entry', 3], ['daily', 1], ['voice note', 3], ['record', 2], ['wav', 2]] },
  { id: 'missed', terms: [['missed', 4], ['forgot', 4], ['backfill', 4], ['past day', 3], ['yesterday entry', 3], ['earlier date', 3]] },
  { id: 'import', terms: [['import', 3], ['chat', 2], ['chats', 2], ['upload', 2], ['export', 2]] },
  { id: 'whatsapp', terms: [['whatsapp', 5]] },
  { id: 'telegram', terms: [['telegram', 5]] },
  { id: 'reddit', terms: [['reddit', 5]] },
  { id: 'progress', terms: [['streak', 4], ['progress', 3], ['how many days', 3], ['days left', 3], ['calendar', 3], ['my data tab', 3], ['logged', 2], ['readiness', 3]] },
  { id: 'privacy', terms: [['data private', 6], ['is my data', 4], ['privacy', 4], ['private', 4], ['where is my data', 5], ['stored', 3], ['cloud', 3], ['internet', 2], ['safe', 2], ['secure', 3], ['share', 2], ['who can see', 4]] },
  { id: 'delete', terms: [['delete', 4], ['erase', 4], ['remove my data', 5], ['clear', 2], ['reset', 3]] },
  { id: 'pdf', terms: [['pdf', 5], ['report', 3], ['download', 3], ['print', 3], ['send to doctor', 4], ['share with doctor', 4]] },
  { id: 'how', terms: [['how does it work', 5], ['how it works', 5], ['model', 2], ['models', 2], ['algorithm', 3], ['ai', 1], ['pipeline', 3], ['stages', 3], ['xgboost', 3], ['whisper', 3]] },
  { id: 'tips', terms: [['what should i do', 5], ['what can i do', 5], ['advice', 4], ['tips', 4], ['improve', 3], ['feel better', 4], ['help me', 2], ['cope', 3], ['next steps', 3]] },
];

function parseDate(q: string, dates: string[]): number | null {
  if (!dates.length) return null;
  if (/\b(today|latest|last day|most recent|recent day)\b/.test(q)) return dates.length - 1;
  if (/\byesterday\b/.test(q)) return Math.max(0, dates.length - 2);
  if (/\bfirst day\b/.test(q)) return 0;
  let m = q.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  let target: Date | null = null;
  if (m) target = new Date(+m[1], +m[2] - 1, +m[3]);
  if (!target) {
    m = q.match(/\b([a-z]{3,9})\s+(\d{1,2})(st|nd|rd|th)?\b/) || null;
    let mon = -1, day = -1;
    if (m && MONTHS.indexOf(m[1].slice(0, 3)) >= 0) { mon = MONTHS.indexOf(m[1].slice(0, 3)); day = +m[2]; }
    else {
      const m2 = q.match(/\b(\d{1,2})(st|nd|rd|th)?\s+(of\s+)?([a-z]{3,9})\b/);
      if (m2 && MONTHS.indexOf(m2[4].slice(0, 3)) >= 0) { mon = MONTHS.indexOf(m2[4].slice(0, 3)); day = +m2[1]; }
    }
    if (mon >= 0) {
      const y = parseDay(dates[dates.length - 1]).getFullYear();
      target = new Date(y, mon, day);
      if (target > parseDay(dates[dates.length - 1])) target = new Date(y - 1, mon, day);
    }
  }
  if (!target) return null;
  const iso = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
  const i = dates.indexOf(iso);
  return i >= 0 ? i : -1;
}

export function score(q: string) {
  const s = ' ' + norm(q) + ' ';
  return INTENTS.map(it => {
    let sc = 0;
    for (const t of it.terms) {
      const [w, wt] = typeof t === 'string' ? [t, 1] : t;
      if (/^[a-z0-9]+$/.test(w) && w.length <= 3 ? new RegExp(`\\b${w}\\b`).test(s) : s.includes(w)) sc += wt + (w.includes(' ') ? 1 : 0);
    }
    return { id: it.id, sc, needsRaw: !!it.needsRaw };
  }).sort((a, b) => b.sc - a.sc);
}

const CRISIS_TEXT = `I'm really glad you said something. You don't have to handle this alone.\n\n**If you are in immediate danger, call 112.**\n\n**Tele-MANAS: 14416** (or 1-800-891-4416) is free, confidential and open 24×7 in many Indian languages. They are trained to help with exactly this.\n\nIf you can, tell someone you trust right now and stay with them. This app can't respond to emergencies, but people at those numbers can.`;

export const STARTERS = {
  results: ['What does my score mean?', 'Why is my score this high?', 'What happens next week?', 'Explain everything A–Z'],
  explain: ['What raised my score?', 'What lowered it?', 'Is this a diagnosis?', 'What is calibration?'],
  forecast: ['What is the twin index?', 'What is the shaded range?', 'Will tomorrow be better?', 'Why need 37 days?'],
  intake: ['How do I check in?', 'How do I export WhatsApp?', 'I missed a day', 'How many days until analysis?'],
  other: ['Explain everything A–Z', 'How does it work?', 'Is my data private?', 'Where are my results?'],
};

export function answer(question: string, ctx: Ctx): Reply {
  const q = norm(question);
  const you = ctx.isPatient ? 'you' : 'this person', your = ctx.isPatient ? 'your' : 'their';
  if (CRISIS.test(q)) return { text: CRISIS_TEXT, kind: 'crisis' };
  const raw = ctx.raw;
  const O = raw ? overview(raw) : null;
  const resultsTab = 'analytics' as const;

  // a specific day ("how was oct 10", "yesterday")
  if (raw && O) {
    const di = parseDate(q, O.dates);
    if (di === -1) return { text: `I don't have an entry for that day. ${cap(your)} analysed days run from ${fmtDay(O.dates[0])} to ${fmtDay(O.dates[O.n - 1])}.`, nav: { tab: resultsTab, target: 'timeline', label: 'Open the timeline' } };
    if (di != null) return dayReply(raw, di, ctx);
  }

  const ranked = score(q);
  const top = ranked[0];
  if (!top || top.sc === 0) {
    return {
      text: `I can explain anything on these pages and take you there. Try asking about ${your} score, why it is what it is, the next 7 days, a specific day like "how was ${O ? fmtDay(O.dates[O.n - 1]) : 'Oct 10'}", or how to check in and import chats.`,
      chips: ['Explain everything A–Z', 'What does my score mean?', 'How do I check in?'],
    };
  }
  if (top.needsRaw && !raw) {
    return {
      text: ctx.isPatient
        ? `That part comes from ${your} analysis, which hasn't been run yet. After 14 days of check-ins, open **Analysis** and press **Run my analysis**.`
        : 'Run an analysis first: paste journal entries on the upload page and press start.',
      nav: ctx.isPatient ? { tab: 'analytics', label: 'Go to Analysis' } : { tab: 'clinical', label: 'Go to upload' },
      chips: ['How do I check in?', 'How many days until analysis?'],
    };
  }

  switch (top.id) {
    case 'greet':
      return { text: `Hi! I'm the Guide. I can explain any chart or word in this app, answer questions about ${your} own results, and take you to the right place. What would you like to know?`, chips: ['Explain everything A–Z', 'What does my score mean?', 'How do I check in?'] };
    case 'thanks':
      return { text: 'Anytime. Ask me about any chart, any day, or any word you see.', chips: ['What happens next week?', 'Explain everything A–Z'] };
    case 'glossary':
      return {
        text: `Here's everything in this app, A to Z. Tap any term and I'll explain it and show you where it is.\n\n**Baseline** · **Calibration** · **Check-in** · **Detectors** · **Drift** · **Emotion dots** · **Forecast** · **Imports (WhatsApp, Telegram, Reddit)** · **Mood tone** · **PDF report** · **Privacy** · **Risk score** · **Risk levels** · **Shaded range** · **Twin index** · **Unusual days** · **Why this score**`,
        chips: ['What is a baseline?', 'What is drift?', 'What are the detectors?', 'What is mood tone?', 'What is the twin index?', 'What are unusual days?', 'What does my score mean?', 'Is my data private?'],
      };
    case 'risk': {
      const o = O!;
      return {
        text: `${cap(your)} estimated risk is **${pct(o.p)}**, which is **${o.levelWord}**. It's the model's estimate of how closely the last ${o.n} days resemble a depression-like pattern. It is a screening signal, not a diagnosis.${o.intervention ? '\n\nAt this level the app suggests a check-in with someone you trust or a professional.' : ''}`,
        nav: { tab: resultsTab, target: 'risk', label: 'Show the score' },
        chips: ['Why is my score this high?', 'What do the levels mean?', 'Is this a diagnosis?'],
      };
    }
    case 'levels':
      return {
        text: `The score is split into three bands: **Low** under 33%, **Moderate** 33–67%, **High** 67% and above.${O ? ` ${cap(your)} score of ${pct(O.p)} is ${O.levelWord}.` : ''} The band is a guide for how much attention the pattern deserves, not a label for a person.`,
        nav: raw ? { tab: resultsTab, target: 'risk', label: 'Show the scale' } : undefined,
      };
    case 'diagnosis':
      return {
        text: `No, this is not a diagnosis. The risk model was trained on recorded clinical interviews (the DAIC-WOZ research dataset) to spot language patterns linked with depression screening results. It can't see the full picture of ${your} life, and it can be wrong in both directions. Treat it as a prompt to pay attention, and talk to a doctor or counsellor for an actual assessment.`,
        chips: ['How does it work?', 'Why is my score this high?'],
      };
    case 'why': case 'raised': case 'lowered': {
      const w = waterfall(raw);
      if (!w) return { text: 'There is no explanation for this run. It needs at least 14 analysed days.' };
      const fmtPts = (d: number) => `${d >= 0 ? '+' : '−'}${Math.abs(d * 100).toFixed(1)} points`;
      const step = (key: string) => w.rows.find(r => r.key === key)!;
      if (top.id === 'lowered') {
        const lows = w.rows.filter(r => r.kind === 'down').slice(0, 3);
        if (!lows.length) return { text: 'None of the main signals lowered the estimate this time.', nav: { tab: 'explainable', target: 'waterfall', label: 'Show the breakdown' } };
        return {
          text: `These lowered ${your} estimate (blue bars):\n\n${lows.map(r => `• ${r.label}: **${fmtPts(r.to - r.from)}**`).join('\n')}`,
          nav: { tab: 'explainable', target: 'waterfall', row: lows[0].key, label: 'Show the breakdown' },
        };
      }
      const ups = w.rows.filter(r => r.kind === 'up').slice(0, 3);
      if (top.id === 'raised') {
        if (!ups.length) return { text: 'None of the main signals raised the estimate this time.', nav: { tab: 'explainable', target: 'waterfall', label: 'Show the breakdown' } };
        return {
          text: `These raised ${your} estimate the most (red bars):\n\n${ups.map(r => `• ${r.label}: **${fmtPts(r.to - r.from)}**`).join('\n')}\n\nThe model compares these to people in its training data; it doesn't mean the feeling itself is "bad".`,
          nav: { tab: 'explainable', target: 'waterfall', row: ups[0].key, label: 'Show the breakdown' },
        };
      }
      const md = w.mainDriver;
      const mainTxt = !md ? 'no single signal dominated'
        : md.kind === 'rest' ? `many small signals together moved it the most (**${fmtPts(md.to - md.from)}**)`
        : md.kind === 'cal' ? `calibration moved it the most (**${fmtPts(md.to - md.from)}**)`
        : `the biggest single move was **${md.label.toLowerCase()}** (**${fmtPts(md.to - md.from)}**)`;
      return {
        text: `The model starts at a typical person's level, **${pct(w.p0, 1)}**, then each signal from ${your} days pushes it up or down until it reaches **${pct(w.pFinal)}**. Here, ${mainTxt}.${ups[0] ? ` The strongest push up was ${ups[0].label.toLowerCase()} (${fmtPts(ups[0].to - ups[0].from)}).` : ''}${step('cal') ? ` A final calibration step adjusts it by ${fmtPts(step('cal').to - step('cal').from)} so percentages match real rates.` : ''}`,
        nav: { tab: 'explainable', target: 'waterfall', label: 'Show the breakdown' },
        chips: ['What raised my score?', 'What lowered it?', 'What is calibration?'],
      };
    }
    case 'read_timeline':
      return {
        text: `The **Day by day** chart reads left to right, one column per day:\n\n• **Blue line**: mood tone of the writing (top is positive, bottom negative). The grey band is ${your} usual range from the first 14 days.\n• **Orange bars**: how different each day was from ${your} usual. Solid bars were flagged.\n• **Yellow shading**: a longer-term shift alert.\n• **Dots**: the strongest emotion that day (green positive, grey neutral, red difficult).\n\nHover any day, or use the arrow keys, to read all its numbers.`,
        nav: raw ? { tab: 'analytics', target: 'timeline', label: 'Show the chart' } : undefined,
        chips: ['What are unusual days?', 'What is drift?', 'How was my worst day?'],
      };
    case 'calibration': {
      const w = waterfall(raw);
      const c = w?.rows.find(r => r.key === 'cal');
      return {
        text: `Raw model scores tend to be over- or under-confident, so a final **calibration** step rescales them so that, for example, "40%" really means about 4 in 10 similar cases screened positive.${c ? ` For ${your} result it moved the estimate from ${pct(c.from, 1)} to **${pct(c.to, 1)}**.` : ''} (This is different from ${your} 14-day baseline.)`,
        nav: { tab: 'explainable', target: 'waterfall', label: 'Show the breakdown' },
      };
    }
    case 'det_forecast': {
      const n = O!.n;
      return {
        text: `Besides the overall forecast, each of the four detectors gets its own 7-day forecast. These learn each detector's rhythm from a 30-day window plus 7 days to check against, so they need **37 analysed days**. ${cap(your)} analysis has **${n}**${n < 37 ? `, so **${37 - n} more check-in${37 - n === 1 ? '' : 's'}** will unlock them` : ', so they are available'}.`,
        nav: { tab: 'forecast', target: 'detector-forecast', label: 'Show detector forecasts' },
      };
    }
    case 'forecast': {
      const F = forecast(raw);
      if (!F) return { text: 'There is no forecast for this run yet.' };
      const t1 = F.fc[0];
      const asksTomorrow = /tomorrow/.test(q);
      return {
        text: asksTomorrow
          ? `For tomorrow (${fmtDayLong(F.fcDates[0])}) the twin index is forecast at **${Math.round(t1 * 100)}**, ${t1 >= F.today ? 'up' : 'down'} from **${Math.round(F.today * 100)}** today. Over the week it's expected to **${F.dir}** (about ${pct(F.ahead)} on average vs ${pct(F.recent)} over the last 7 days).`
          : `Over the next 7 days ${your} twin index is expected to **${F.dir}**: about **${pct(F.ahead)}** on average, compared with **${pct(F.recent)}** over the last 7 days. The shaded area shows ${your} normal day-to-day ups and downs, so a single day landing anywhere inside it is ordinary.`,
        nav: { tab: 'forecast', target: asksTomorrow ? 'days' : 'fan', label: 'Show the forecast' },
        chips: ['What is the twin index?', 'What is the shaded range?'],
      };
    }
    case 'index':
      return {
        text: `The twin index is one number per day that the forecasting model (a Temporal Fusion Transformer) learns and predicts. It blends **how different the day was from ${your} usual (50%)**, **the mood tone of the writing (25%)**, and **sleep and activity (25%)**. Watch its direction rather than the exact value.`,
        nav: raw ? { tab: 'forecast', target: 'composition', label: 'Show what goes in' } : undefined,
      };
    case 'band':
      return {
        text: `The shaded area around the forecast is ${your} own typical day-to-day variation, and it widens further ahead because the future is less certain. If a future day lands inside it, that's ordinary for ${you}; outside it would be unusual. It is not a guarantee.`,
        nav: raw ? { tab: 'forecast', target: 'fan', label: 'Show the range' } : undefined,
      };
    case 'unusual': {
      const o = O!; const e = extremes(raw);
      return {
        text: `Each orange bar shows how different that day was from ${your} usual pattern (0–100). Four detectors look at the day in different ways and their combined score is the bar. Solid bars are days the system **flagged**: **${o.unusualDays} of ${o.n}** days. The most different day was **${fmtDay(o.dates[e.mostUnusual])}** (${pct(o.anom[e.mostUnusual])}).`,
        nav: { tab: resultsTab, target: 'timeline', day: e.mostUnusual, label: 'Show on the timeline' },
        chips: ['What are the detectors?', `How was ${fmtDay(o.dates[e.mostUnusual])}?`],
      };
    }
    case 'drift': {
      const o = O!;
      return {
        text: `Drift looks for a **slow, steady shift** rather than one odd day. It adds up small daily differences from ${your} baseline and raises an alert when they keep building in one direction (shown as yellow bands). Right now: **${o.driftTitle}**${o.driftSince ? `, since ${fmtDay(o.driftSince)}` : ''}. ${o.driftMessage}`,
        nav: { tab: resultsTab, target: 'facts', label: 'Show drift' },
      };
    }
    case 'baseline': {
      const ds = ctx.status?.dataset;
      const have = ds?.days_with_features ?? ctx.status?.entry_count;
      return {
        text: `${cap(your)} baseline is what's normal **for ${you}**, learned from the first 14 days of check-ins. Everything afterwards is compared against it, so the app judges change, not how ${you} compare with other people.${have != null && !ctx.status?.calibrated ? ` So far: **${Math.min(have, 14)} of 14 days**.` : have != null ? ` It's calibrated, using ${have} days.` : ''} On the timeline, the grey band is the usual range.`,
        nav: raw ? { tab: resultsTab, target: 'timeline', label: 'Show the usual range' } : ctx.isPatient ? { tab: 'intake', intakeTab: 'data', target: 'readiness', label: 'Show progress' } : undefined,
      };
    }
    case 'mood': {
      const o = O!;
      return {
        text: `Mood tone is how positive or negative the **words** in each entry were, from 0% (very negative) to 100% (very positive), with 50% neutral. It's the blue line on the timeline. ${cap(your)} average went from **${pct(o.moodEarly)}** in the first week to **${pct(o.moodLate)}** in the last week.`,
        nav: { tab: resultsTab, target: 'timeline', label: 'Show the mood line' },
      };
    }
    case 'emotions': {
      const counts: Record<string, number> = {};
      (raw.emotions_series || []).forEach((e: string) => { counts[e] = (counts[e] || 0) + 1; });
      const topE = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([e, c]) => `${e} (${c} days)`).join(', ');
      return {
        text: `Each dot under the timeline is the strongest emotion detected in that day's writing: **green** for positive ones like joy or gratitude, **grey** for neutral, **red** for difficult ones like sadness or nervousness. Most common: ${topE}.`,
        nav: { tab: resultsTab, target: 'timeline', label: 'Show the emotion dots' },
      };
    }
    case 'detectors':
      return {
        text: `Four detectors each judge "how unusual was this day?" differently:\n\n• **Pattern distance**: how far the whole day sits from ${your} usual\n• **Unusual combinations**: signals that rarely appear together\n• **Outlier check**: how easily the day stands apart\n• **Nearest days**: distance to ${your} most similar past days\n\nTheir combined score is the orange bar for each day.`,
        nav: { tab: resultsTab, target: 'detectors', label: 'Show the detectors' },
      };
    case 'checkins': {
      const pairs = (k: string) => (raw[k] || []).map((x: any) => x[1]).filter((v: any) => v != null);
      const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
      const sl = avg(pairs('sleep_series')), ac = avg(pairs('activity_series')), md = avg(pairs('music_series'));
      return {
        text: `These come from the sliders in each daily check-in. Averages: sleep **${sl == null ? '—' : sl.toFixed(1) + 'h'}**, activity **${pct(ac)}**, self-rated mood **${pct(md)}**. Hover the timeline and these move to the same day.`,
        nav: { tab: resultsTab, target: 'checkins', label: 'Show check-ins' },
      };
    }
    case 'best': case 'worst': case 'oddest': {
      const e = extremes(raw);
      const i = top.id === 'best' ? e.bestMood : top.id === 'worst' ? e.worstMood : e.mostUnusual;
      const r = dayReply(raw, i, ctx);
      return { ...r, text: `${top.id === 'best' ? 'The most positive day' : top.id === 'worst' ? 'The most difficult day by mood tone' : 'The most unusual day'} was **${fmtDayLong(raw.timestamps[i])}**.\n\n${r.text}` };
    }
    case 'checkin_how':
      return {
        text: `Once a day, open the **Check-in** tab: write a few sentences about how the day went, optionally attach a voice note (.wav, transcribed on this computer), set the four sliders, and press **Submit check-in**. Missed a day? Pick its date with the calendar at the top of the form.`,
        nav: ctx.isPatient ? { tab: 'intake', intakeTab: 'submit', target: 'checkin-form', label: 'Open check-in' } : { tab: 'clinical', label: 'Open upload' },
      };
    case 'missed':
      return {
        text: `No problem. In **Check-in**, use the date picker at the top-right of the form to choose the missed day, then fill it in as usual. Each date can be checked in once.`,
        nav: ctx.isPatient ? { tab: 'intake', intakeTab: 'submit', target: 'checkin-form', label: 'Open check-in' } : undefined,
      };
    case 'import': case 'whatsapp': case 'telegram': case 'reddit': {
      const how: Record<string, string> = {
        whatsapp: 'In WhatsApp open the chat, tap ⋮ → More → **Export chat** → **Without media**, and save the .txt file.',
        telegram: 'In Telegram Desktop go to Settings → Advanced → **Export Telegram data**, choose **JSON**, and pick result.json.',
        reddit: 'Request your data at reddit.com/settings/data-request, then upload **comments.csv** or **posts.csv** from the download.',
        import: 'You can import WhatsApp (.txt export), Telegram (result.json) or Reddit (comments.csv / posts.csv).',
      };
      return {
        text: `${how[top.id]}\n\nThen go to **Import chats**, choose the app, type ${your} name as it appears in the chat, upload, and press **Preview my messages**. Only ${your} own messages are kept, and each is added to the day it was sent.`,
        nav: ctx.isPatient ? { tab: 'intake', intakeTab: 'import', target: 'chat-import', label: 'Open import' } : undefined,
      };
    }
    case 'progress': {
      const ds = ctx.status?.dataset;
      if (!ds) return { text: 'Check-in progress lives on the My data tab of the intake portal.', nav: ctx.isPatient ? { tab: 'intake', intakeTab: 'data', label: 'Open My data' } : undefined };
      const left = Math.max(0, 14 - (ds.days_with_features || 0));
      return {
        text: `You've logged **${ds.days_logged} days** (current streak **${ds.current_streak}**, longest **${ds.longest_streak}**). ${left ? `**${left} more day${left === 1 ? '' : 's'}** until ${your} baseline is ready and analysis unlocks.` : 'Your baseline is ready, so you can run the analysis anytime.'} Detector forecasts unlock at 37 days.`,
        nav: { tab: 'intake', intakeTab: 'data', target: 'readiness', label: 'Show my progress' },
      };
    }
    case 'privacy':
      return {
        text: `Everything stays on this computer. Check-ins, imported chats, voice notes and results are stored in the app's own folder (a local database), and all AI models run locally, on ${your} GPU when available. Nothing is uploaded, and this Guide works offline too.`,
      };
    case 'delete':
      return {
        text: `Open **My data** in the intake portal and press **Clear all data**. It deletes ${your} entries and baseline from this computer. This can't be undone.`,
        nav: ctx.isPatient ? { tab: 'intake', intakeTab: 'data', target: 'my-data', label: 'Open My data' } : undefined,
      };
    case 'pdf':
      return {
        text: `Use **Download PDF Report** at the top right of the results pages. It saves a summary you can print or bring to a doctor or counsellor.`,
        nav: raw ? { tab: resultsTab, target: 'pdf', label: 'Show the button' } : undefined,
      };
    case 'how':
      return {
        text: `Five steps, all on this computer:\n\n1. **Reading each day**: the writing becomes 466 numbers (emotions, tone, style), plus voice and sliders.\n2. **Baseline**: 14 days teach it what's normal for ${you}.\n3. **Unusual days**: four detectors and a drift check compare each day to that baseline.\n4. **Risk**: a model trained on clinical interviews estimates the risk, and TreeSHAP explains why.\n5. **Forecast**: a Temporal Fusion Transformer predicts the next 7 days.`,
        chips: ['What is a baseline?', 'What are the detectors?', 'Is this a diagnosis?'],
      };
    case 'tips':
      return {
        text: `The app can show patterns but can't give medical advice. Things that commonly help: keep sleep regular, get some daylight and movement, and stay in touch with people you trust. If ${your} score is Moderate or higher, or the drift alert stays on for a while, it's worth talking to a counsellor or doctor and showing them the PDF report.\n\nIf things ever feel unsafe, **Tele-MANAS 14416** is free and open 24×7.`,
        chips: ['How do I download the PDF?', 'What does my score mean?'],
      };
  }
  return { text: 'Ask me about any chart, a specific day, or how to use the app.', chips: ['Explain everything A–Z'] };
}

const DRIFT_TXT: Record<number, string> = { 1: 'within the usual range', 2: 'drifting above baseline', 3: 'drifting below baseline', 4: 'swinging both ways' };

function dayReply(raw: any, i: number, ctx: Ctx): Reply {
  const d = dayInfo(raw, i);
  const lines = [
    `**${fmtDayLong(d.date)}**`,
    `• Mood tone of the writing: **${pct(d.mood)}**`,
    `• How different from ${ctx.isPatient ? 'your' : 'their'} usual: **${pct(d.unusual)}**${d.flagged ? ' (flagged)' : ''}`,
    `• Strongest emotion: **${d.emotion || '—'}**`,
  ];
  if (d.drift != null) lines.push(`• Drift check: ${DRIFT_TXT[d.drift] || '—'}`);
  if (d.sleep != null) lines.push(`• Sleep **${d.sleep}h**${d.activity != null ? `, activity **${pct(d.activity)}**` : ''}${d.selfMood != null ? `, self-rated mood **${pct(d.selfMood)}**` : ''}`);
  return { text: lines.join('\n'), nav: { tab: 'analytics', target: 'timeline', day: i, label: 'Show this day' } };
}

export const RISK_BANDS = RISK;
