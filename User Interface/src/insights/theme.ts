// Design tokens for the result pages (Results / Why / Outlook).
// Series hues validated with the dataviz palette checker against the dark surface (#0e121b).
export const C = {
  bg: '#07090E',
  surface: '#0E121B',
  raised: '#131927',
  line: '#1E2534',
  grid: '#182030',
  text: '#ECEEF3',
  text2: '#A6AEC0',
  muted: '#6E778B',
  // series (identity)
  mood: '#3987e5',
  unusual: '#d95926',
  health: '#199e70',
  // diverging for explanations: lowers vs raises the estimate (always paired with +/− labels)
  lowers: '#3987e5',
  raises: '#e66767',
  neutral: '#3a4254',
  // status (reserved for risk level; always shown with a word)
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
};

export const GROUP_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9'];

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH';

// Must match unified_pipeline.predict_classification: < 0.33 LOW, < 0.67 MODERATE, else HIGH
export const RISK = {
  LOW: { word: 'Low', color: C.good, from: 0, to: 0.33 },
  MODERATE: { word: 'Moderate', color: C.warning, from: 0.33, to: 0.67 },
  HIGH: { word: 'High', color: C.serious, from: 0.67, to: 1 },
} as const;

export function riskLevelFor(p: number, backend?: string): RiskLevel {
  const b = (backend || '').toUpperCase();
  if (b in RISK) return b as RiskLevel;
  if (p >= 0.67) return 'HIGH';
  if (p >= 0.33) return 'MODERATE';
  return 'LOW';
}

const POS = new Set(['admiration', 'amusement', 'approval', 'caring', 'desire', 'excitement', 'gratitude', 'joy', 'love', 'optimism', 'pride', 'relief', 'curiosity', 'realization', 'surprise']);
const NEG = new Set(['anger', 'annoyance', 'disappointment', 'disapproval', 'disgust', 'embarrassment', 'fear', 'grief', 'nervousness', 'remorse', 'sadness', 'confusion']);
export type Valence = 'positive' | 'neutral' | 'negative';
export const valenceOf = (e?: string): Valence => (e && POS.has(e) ? 'positive' : e && NEG.has(e) ? 'negative' : 'neutral');
export const VALENCE_COLOR: Record<Valence, string> = { positive: C.health, neutral: '#5b6478', negative: C.raises };

export const pct = (v: number | null | undefined, d = 0) => (v == null || isNaN(v) ? '—' : `${(v * 100).toFixed(d)}%`);
export const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const parseDay = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const fmtDay = (s: string) => { const d = parseDay(s); return `${MONTHS[d.getMonth()]} ${d.getDate()}`; };
export const fmtDayLong = (s: string) => { const d = parseDay(s); return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`; };
export const weekday = (d: Date) => DAYS[d.getDay()];
export const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const addDays = (s: string, n: number) => { const d = parseDay(s); d.setDate(d.getDate() + n); return isoOf(d); };

export const mean = (xs: (number | null | undefined)[]) => {
  const v = xs.filter((x): x is number => typeof x === 'number' && !isNaN(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
export const std = (xs: number[]) => {
  const m = mean(xs); if (m == null || xs.length < 2) return 0;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
export const logit = (p: number) => Math.log(Math.min(0.9999, Math.max(1e-4, p)) / (1 - Math.min(0.9999, Math.max(1e-4, p))));

export function prefersReducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}
