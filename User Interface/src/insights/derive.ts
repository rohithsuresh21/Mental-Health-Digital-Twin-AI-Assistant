// Single source of truth for every number shown on the result pages AND said by the Guide,
// so the two can never disagree. All inputs are the raw /diagnose response.
import { RISK, riskLevelFor, mean, std, sigmoid, logit, addDays, valenceOf } from './theme';

export type Raw = any;

export function overview(raw: Raw) {
  const dates: string[] = raw?.timestamps || [];
  const n = dates.length;
  const p: number = raw?.prediction?.probability ?? 0;
  const level = riskLevelFor(p, raw?.prediction?.risk_level);
  const flags: boolean[] = raw?.is_anomaly_flags || [];
  const anom: number[] = raw?.anomaly_scores || [];
  const sent: number[] = raw?.sentiment_series || [];
  const wk = Math.min(7, Math.floor(n / 2));
  const k = Math.min(10, Math.floor(anom.length / 3));
  const earlyA = mean(anom.slice(0, k)) ?? 0, lateA = mean(anom.slice(-k)) ?? 0;
  const trend: 'rising' | 'settling' | 'steady' = lateA - earlyA > 0.12 ? 'rising' : earlyA - lateA > 0.12 ? 'settling' : 'steady';
  const cs = raw?.cusum_status || {};
  const st: number[] = cs.states || [];
  let driftSince: string | null = null;
  if (st.length && st[st.length - 1] !== 1) { let i = st.length - 1; while (i > 0 && st[i - 1] !== 1) i--; driftSince = dates[i]; }
  return {
    dates, n, p, level, levelWord: RISK[level].word, flags, anom, sent,
    unusualDays: flags.filter(Boolean).length,
    moodEarly: mean(sent.slice(0, wk)), moodLate: mean(sent.slice(-wk)), wk,
    trend, trendDays: k,
    driftTitle: (cs.current_title as string) || 'Within your normal range',
    driftMessage: (cs.current_message as string) || '',
    driftSince,
    intervention: !!raw?.prediction?.intervention_recommended,
    calibratedAfter: Math.min(14, n),
  };
}

export function dayInfo(raw: Raw, i: number) {
  const d = raw?.timestamps?.[i];
  const pick = (pairs: [string, number][] | undefined) => (pairs || []).find(([x]) => x === d)?.[1] ?? null;
  return {
    date: d as string,
    mood: raw?.sentiment_series?.[i] ?? null,
    unusual: raw?.anomaly_scores?.[i] ?? null,
    flagged: !!raw?.is_anomaly_flags?.[i],
    emotion: raw?.emotions_series?.[i] as string | undefined,
    valence: valenceOf(raw?.emotions_series?.[i]),
    drift: raw?.cusum_status?.states?.[i] as number | undefined,
    sleep: pick(raw?.sleep_series), activity: pick(raw?.activity_series), selfMood: pick(raw?.music_series),
  };
}

export function extremes(raw: Raw) {
  const sent: number[] = raw?.sentiment_series || [];
  const anom: number[] = raw?.anomaly_scores || [];
  const argmax = (xs: number[]) => xs.reduce((b, v, i) => (v > xs[b] ? i : b), 0);
  const argmin = (xs: number[]) => xs.reduce((b, v, i) => (v < xs[b] ? i : b), 0);
  return { bestMood: argmax(sent), worstMood: argmin(sent), mostUnusual: argmax(anom), leastUnusual: argmin(anom) };
}

export type Step = { key: string; label: string; sub?: string; from: number; to: number; kind: 'base' | 'up' | 'down' | 'rest' | 'cal' | 'final'; feat?: any };

export function waterfall(raw: Raw, show = 8) {
  const sx = raw?.shap_explanation;
  if (!sx || !Array.isArray(sx.top_features)) return null;
  const pRaw: number = raw?.prediction?.probability_raw ?? raw?.prediction?.probability ?? 0.5;
  const pFinal: number = raw?.prediction?.probability ?? pRaw;
  const feats = sx.top_features.filter((f: any) => Math.abs(f.shap_value) > 1e-4).slice(0, show);
  let m = sx.base_value as number;
  const rows: Step[] = [{ key: 'base', label: 'Typical starting point', sub: 'What the model assumes before reading your data', from: 0, to: sigmoid(m), kind: 'base' }];
  for (const f of feats) {
    const a = sigmoid(m); m += f.shap_value; const b = sigmoid(m);
    rows.push({ key: f.full_name, label: f.description, sub: f.group, from: a, to: b, kind: b >= a ? 'up' : 'down', feat: f });
  }
  if (Math.abs(sigmoid(m) - pRaw) > 0.0005)
    rows.push({ key: 'rest', label: `All other signals (${Math.max(0, sx.top_features.length - feats.length)}+ smaller ones)`, sub: 'Combined effect of everything not listed above', from: sigmoid(m), to: pRaw, kind: 'rest' });
  if (Math.abs(pFinal - pRaw) > 0.0005)
    rows.push({ key: 'cal', label: 'Calibration', sub: 'Adjusts raw model output so percentages match observed rates', from: pRaw, to: pFinal, kind: 'cal' });
  rows.push({ key: 'final', label: 'Your estimate', from: 0, to: pFinal, kind: 'final' });
  const p0 = sigmoid(sx.base_value);
  const up = feats.filter((f: any) => f.shap_value > 0).sort((a: any, b: any) => b.shap_value - a.shap_value);
  const down = feats.filter((f: any) => f.shap_value < 0).sort((a: any, b: any) => a.shap_value - b.shap_value);
  const above = pFinal >= p0;
  const moves = rows.filter(r => ['up', 'down', 'rest', 'cal'].includes(r.kind)).map(r => ({ r, d: r.to - r.from }))
    .filter(x => (above ? x.d > 0 : x.d < 0)).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  const mainDriver = moves[0]?.r || null;
  return { rows, feats, up, down, p0, pRaw, pFinal, above, mainDriver, groups: (sx.group_impacts || []).filter((g: any) => g.total_impact > 0) };
}

export function forecast(raw: Raw) {
  const dates: string[] = raw?.timestamps || [];
  const comp: number[] = raw?.composite_series || [];
  const fc: number[] = raw?.tft_forecast_14day || [];
  const n = dates.length;
  if (!n || !comp.length || !fc.length) return null;
  const last = dates[n - 1];
  const fcDates = fc.map((_, i) => addDays(last, i + 1));
  const resid = comp.map((v, i) => v - (mean(comp.slice(Math.max(0, i - 1), i + 2)) ?? v));
  const sd = Math.max(0.01, std(resid));
  const band = fc.map((_, i) => sd * Math.sqrt(i + 1));
  const recent = mean(comp.slice(-7)) ?? comp[n - 1];
  const ahead = mean(fc) ?? recent;
  const diff = ahead - recent;
  const dir: 'rise' | 'ease' | 'hold steady' = diff > 0.025 ? 'rise' : diff < -0.025 ? 'ease' : 'hold steady';
  return { comp, fc, fcDates, band, recent, ahead, dir, today: comp[n - 1], last };
}

export { logit };
