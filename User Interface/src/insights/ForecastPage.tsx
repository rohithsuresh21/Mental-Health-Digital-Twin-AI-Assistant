import { useState, KeyboardEvent } from 'react';
import { ChevronLeft, Info, Loader2 } from 'lucide-react';
import { C, addDays, parseDay, weekday, fmtDay, fmtDayLong, mean, std, pct } from './theme';
import { useWidth, useEntrance, xScale, yScale, smoothPath, DrawPath, Tooltip, TipRow, Key, Spark } from './charts';

type Raw = any;
const INDEX = '#9085e9';
const HISTORY = 21;
const DET_NAMES: Record<string, string> = { mahalanobis: 'Pattern distance', copula: 'Unusual combinations', isolation_forest: 'Outlier check', knn: 'Nearest days' };

function FanChart({ hist, histDates, fc, fcDates, band }: { hist: number[]; histDates: string[]; fc: number[]; fcDates: string[]; band: number[] }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const t = useEntrance(1300, 200);
  const tf = useEntrance(900, 1300);
  const [hover, setHover] = useState<number | null>(null);
  const all = [...hist, ...fc];
  const dates = [...histDates, ...fcDates];
  const n = all.length, h0 = hist.length;
  const lo = Math.max(0, Math.floor((Math.min(...all, ...fc.map((v, i) => v - band[i])) - 0.05) * 10) / 10);
  const hi = Math.min(1, Math.ceil((Math.max(...all, ...fc.map((v, i) => v + band[i])) + 0.05) * 10) / 10);
  const H = 300, PAD_L = 40, PAD_R = 16, TOP = 24, AX = 28;
  const X = xScale(n, PAD_L + 6, Math.max(PAD_L + 7, w - PAD_R - 6));
  const Y = yScale(lo, hi, TOP + H, TOP);
  const histD = smoothPath(hist, X, Y);
  const fcVals = [hist[h0 - 1], ...fc];
  const fcD = smoothPath(fcVals, (i: number) => X(h0 - 1 + i), Y);
  const upper = [hist[h0 - 1], ...fc.map((v, i) => Math.min(1, v + band[i]))];
  const lower = [hist[h0 - 1], ...fc.map((v, i) => Math.max(0, v - band[i]))];
  const Xf = (i: number) => X(h0 - 1 + i);
  const bandD = `M${upper.map((v, i) => `${Xf(i)},${Y(v)}`).join('L')}L${lower.map((v, i) => `${Xf(i)},${Y(v)}`).reverse().join('L')}Z`;
  const ticks = Array.from({ length: Math.round((hi - lo) * 10) + 1 }, (_, i) => +(lo + i / 10).toFixed(1)).filter((_, i, a) => a.length <= 6 || i % 2 === 0);
  const tickEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((w - 80) / 80))));
  const pick = (cx: number) => { const r = ref.current?.getBoundingClientRect(); if (!r) return; const i = Math.round(((cx - r.left - X(0)) / (X(n - 1) - X(0) || 1)) * (n - 1)); setHover(Math.max(0, Math.min(n - 1, i))); };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') { setHover(Math.min(n - 1, (hover ?? -1) + 1)); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { setHover(Math.max(0, (hover ?? n) - 1)); e.preventDefault(); }
  };
  const isFc = hover != null && hover >= h0;
  return (
    <div ref={ref} className="relative select-none outline-none rounded-xl focus-visible:ring-2 focus-visible:ring-blue-500/60" tabIndex={0} onKeyDown={onKey}
      onMouseMove={e => pick(e.clientX)} onMouseLeave={() => setHover(null)} onTouchMove={e => pick(e.touches[0].clientX)} aria-label="Twin index history and 7-day forecast">
      {w > 0 && (
        <svg width={w} height={TOP + H + AX} className="block overflow-visible">
          <rect x={X(h0 - 1)} y={TOP - 18} width={Math.max(0, X(n - 1) - X(h0 - 1) + 6)} height={H + 18} fill={INDEX} opacity={0.045} rx={8} />
          {ticks.map(v => (
            <g key={v}>
              <line x1={PAD_L} x2={w - PAD_R} y1={Y(v)} y2={Y(v)} stroke={C.grid} />
              <text x={PAD_L - 10} y={Y(v) + 4} textAnchor="end" fontSize={11} fill={C.muted}>{Math.round(v * 100)}</text>
            </g>
          ))}
          <path d={bandD} fill={INDEX} opacity={0.16 * tf} />
          <DrawPath d={histD} color={INDEX} width={2.25} t={t} />
          <DrawPath d={fcD} color={INDEX} width={2.25} t={tf} opacity={0.75} />
          {fc.map((v, i) => tf > (i + 1) / fc.length && <circle key={i} cx={X(h0 + i)} cy={Y(v)} r={3.5} fill={C.surface} stroke={INDEX} strokeWidth={2} />)}
          <line x1={X(h0 - 1)} x2={X(h0 - 1)} y1={TOP - 18} y2={TOP + H} stroke={C.text2} strokeOpacity={0.5} />
          <circle cx={X(h0 - 1)} cy={Y(hist[h0 - 1])} r={5} fill={INDEX} stroke={C.surface} strokeWidth={2.5} />
          <text x={X(h0 - 1) - 8} y={TOP - 6} textAnchor="end" fontSize={12} fill={C.text2}>Your last {HISTORY} days</text>
          <text x={X(h0 - 1) + 8} y={TOP - 6} fontSize={12} fill={C.text}>Forecast</text>
          {dates.map((d, i) => (i % tickEvery === 0 || i === n - 1) && (i === n - 1 || n - 1 - i >= tickEvery * 0.6) ? (
            <text key={d} x={X(i)} y={TOP + H + 20} textAnchor="middle" fontSize={11} fill={i >= h0 ? C.text2 : C.muted}>{fmtDay(d)}</text>
          ) : null)}
          {hover != null && (
            <g>
              <line x1={X(hover)} x2={X(hover)} y1={TOP} y2={TOP + H} stroke={C.text} strokeOpacity={0.3} />
              <circle cx={X(hover)} cy={Y(all[hover])} r={5} fill={INDEX} stroke={C.surface} strokeWidth={2.5} />
            </g>
          )}
        </svg>
      )}
      {hover != null && w > 0 && (
        <Tooltip x={X(hover)} width={w} top={Math.max(0, Y(all[hover]) - 90)}>
          <div className="mb-1.5 font-medium">{fmtDayLong(dates[hover])}{isFc ? ' · forecast' : ''}</div>
          <TipRow color={INDEX} label="Twin index" value={pct(all[hover])} />
          {isFc && <TipRow label="Typical range" value={`${pct(Math.max(0, all[hover] - band[hover - h0]))}–${pct(Math.min(1, all[hover] + band[hover - h0]))}`} />}
          {isFc && <TipRow label="vs. today" value={`${all[hover] - hist[h0 - 1] >= 0 ? '+' : '−'}${Math.abs((all[hover] - hist[h0 - 1]) * 100).toFixed(1)} pts`} />}
        </Tooltip>
      )}
    </div>
  );
}

export default function ForecastPage({ raw, onBack }: { raw: Raw; onBack: () => void }) {
  const tDays = useEntrance(800, 1800);
  const [detFc, setDetFc] = useState<Record<string, (number | null)[]> | null>(raw?.detector_forecasts || null);
  const [detMsg, setDetMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dates: string[] = raw?.timestamps || [];
  const comp: number[] = raw?.composite_series || [];
  const fc: number[] = raw?.tft_forecast_14day || [];
  const n = dates.length;
  if (!n || !comp.length || !fc.length) {
    return (
      <div className="insights mx-auto max-w-[760px] py-24 text-center" style={{ color: C.text }}>
        <h1 className="font-serif text-[34px]">No forecast for this run</h1>
        <p className="mt-3 text-[14px]" style={{ color: C.text2 }}>The forecasting model needs your analysed days to look ahead. Run the analysis again to create one.</p>
        <button onClick={onBack} className="mt-8 rounded-xl px-5 py-2.5 text-[13px] cursor-pointer" style={{ background: C.raised, color: C.text }}>Back to results</button>
      </div>
    );
  }
  const hist = comp.slice(-HISTORY), histDates = dates.slice(-HISTORY);
  const last = dates[n - 1];
  const fcDates = fc.map((_, i) => addDays(last, i + 1));
  // day-to-day spread around a 3-day running mean, widening with the horizon
  const resid = comp.map((v, i) => v - (mean(comp.slice(Math.max(0, i - 1), i + 2)) ?? v));
  const sd = Math.max(0.01, std(resid));
  const band = fc.map((_, i) => sd * Math.sqrt(i + 1));
  const recent = mean(comp.slice(-7)) ?? comp[n - 1];
  const ahead = mean(fc) ?? recent;
  const diff = ahead - recent;
  const dir = diff > 0.025 ? 'rise' : diff < -0.025 ? 'ease' : 'hold steady';
  const headline = dir === 'hold steady'
    ? `Your twin index is expected to hold steady over the next week.`
    : `Your twin index is expected to ${dir} over the next week, from ${pct(recent)} to about ${pct(ahead)}.`;
  const comps = [
    { label: 'Unusualness', w: '50%', v: mean((raw.anomaly_scores || []).slice(-7)) },
    { label: 'Mood tone', w: '25%', v: mean((raw.sentiment_series || []).slice(-7)) },
    { label: 'Sleep and activity', w: '25%', v: null as number | null },
  ];
  const detKeys = Object.keys(DET_NAMES);
  const detReady = detFc && detKeys.some(k => (detFc[k] || []).some(v => v != null));
  const tryDetectors = async () => {
    setBusy(true); setDetMsg(null);
    try {
      const r = await fetch('/api/forecast-detectors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: '{}' });
      const d = await r.json();
      if (!r.ok) setDetMsg(d.error || 'Not available yet.'); else setDetFc(d.detector_forecasts);
    } catch (e: any) { setDetMsg(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="insights mx-auto max-w-[1180px] px-1 pb-16" style={{ color: C.text }}>
      <button onClick={onBack} className="mb-6 inline-flex items-center gap-1 text-[13px] cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500/60 rounded" style={{ color: C.text2 }}>
        <ChevronLeft className="h-4 w-4" />Results
      </button>
      <section className="max-w-[900px]">
        <p className="text-[14px] mb-4" style={{ color: C.text2 }}>The next 7 days</p>
        <h1 className="font-serif text-[clamp(30px,3.6vw,46px)] leading-[1.12] tracking-[-0.01em]" style={{ fontVariationSettings: '"opsz" 72, "SOFT" 50' }}>{headline}</h1>
        <p className="mt-5 text-[15px] leading-relaxed max-w-[68ch]" style={{ color: C.text2 }}>
          The twin index is what the forecasting model (a Temporal Fusion Transformer) learns to predict: one number per day that blends how unusual the day was,
          the mood tone of your writing, and your sleep and activity.
        </p>
      </section>

      <section className="mt-10 rounded-2xl p-5 sm:p-7" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
        <div className="mb-5 flex flex-wrap gap-x-5 gap-y-2">
          <Key color={INDEX} label="Twin index" />
          <Key color="rgba(144,133,233,0.3)" kind="band" label="Typical day-to-day range" />
        </div>
        <FanChart hist={hist} histDates={histDates} fc={fc} fcDates={fcDates} band={band} />
        <div className="mt-6 grid grid-cols-7 gap-2">
          {fc.map((v, i) => {
            const d = parseDay(fcDates[i]);
            const delta = v - comp[n - 1];
            const k = Math.max(0, Math.min(1, tDays * 1.6 - i * 0.09));
            return (
              <div key={fcDates[i]} className="rounded-xl px-2 py-3 text-center" style={{ background: C.raised, opacity: k, transform: `translateY(${(1 - k) * 6}px)` }}>
                <div className="text-[12px]" style={{ color: C.text2 }}>{i === 0 ? 'Tomorrow' : weekday(d)}</div>
                <div className="text-[11px]" style={{ color: C.muted }}>{fmtDay(fcDates[i])}</div>
                <div className="mt-1.5 text-[18px] tabular-nums">{Math.round(v * 100)}</div>
                <div className="text-[11px] tabular-nums" style={{ color: C.muted }}>{delta >= 0 ? '+' : '−'}{Math.abs(delta * 100).toFixed(1)}</div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[12px]" style={{ color: C.muted }}>Change shown against your latest day, {fmtDay(last)} ({pct(comp[n - 1])}).</p>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.25fr]">
        <div className="rounded-2xl p-5 sm:p-7" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
          <h2 className="font-serif text-[22px]">What goes into the index</h2>
          <p className="mt-1 mb-5 text-[13px]" style={{ color: C.text2 }}>Weights the model was trained with, and your average over the last 7 days.</p>
          <div className="space-y-4">
            {comps.map(c => (
              <div key={c.label} className="grid grid-cols-[1fr_auto] items-center gap-3">
                <div>
                  <div className="flex justify-between text-[13px]"><span>{c.label}</span><span className="tabular-nums" style={{ color: C.text2 }}>{c.v == null ? 'from your sliders' : pct(c.v)}</span></div>
                  <div className="mt-1.5 h-[6px] rounded-full" style={{ background: C.raised }}>
                    <div className="h-full rounded-full" style={{ width: c.w, background: INDEX, opacity: 0.85 }} />
                  </div>
                </div>
                <span className="w-10 text-right text-[12px] tabular-nums" style={{ color: C.muted }}>{c.w}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl p-5 sm:p-7" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
          <h2 className="font-serif text-[22px]">Each detector, a week ahead</h2>
          {detReady ? (
            <>
              <p className="mt-1 mb-5 text-[13px]" style={{ color: C.text2 }}>Separate forecasts for the four unusualness detectors.</p>
              <div className="grid grid-cols-2 gap-5">
                {detKeys.map(k => {
                  const hist7 = (raw.detector_scores || []).slice(-14).map((s: any) => s?.[k] ?? null);
                  const f = (detFc?.[k] || []) as (number | null)[];
                  return (
                    <div key={k}>
                      <div className="flex justify-between text-[13px]"><span>{DET_NAMES[k]}</span><span className="tabular-nums" style={{ color: C.text2 }}>{pct(f[f.length - 1] ?? null)}</span></div>
                      <Spark vals={[...hist7, ...f]} color={C.unusual} height={40} />
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <p className="mt-1 text-[14px] leading-relaxed" style={{ color: C.text2 }}>
                These forecasts learn each detector’s own rhythm and need 37 analysed days. You have {n}, so {Math.max(0, 37 - n)} more check-in{37 - n === 1 ? '' : 's'} will unlock them.
              </p>
              <div className="mt-4 h-2 rounded-full" style={{ background: C.raised }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (n / 37) * 100)}%`, background: C.unusual }} />
              </div>
              <div className="mt-1.5 text-[12px] tabular-nums" style={{ color: C.muted }}>{n} of 37 days</div>
              {n >= 37 && (
                <button onClick={tryDetectors} disabled={busy} className="mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] cursor-pointer" style={{ background: C.raised, color: C.text }}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}Forecast the detectors
                </button>
              )}
              {detMsg && <p className="mt-3 text-[12px]" style={{ color: C.warning }}>{detMsg}</p>}
            </>
          )}
        </div>
      </section>

      <p className="mt-8 flex items-start gap-2 text-[12px] leading-relaxed max-w-[90ch]" style={{ color: C.muted }}>
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        The shaded range is your own typical day-to-day variation, widening further out. It is not a guarantee: one unusual day can move the index outside it.
      </p>
    </div>
  );
}
