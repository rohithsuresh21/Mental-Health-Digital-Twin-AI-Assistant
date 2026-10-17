import { useMemo, useState, useRef, KeyboardEvent } from 'react';
import { ChevronRight, Table2, LineChart as LineIcon, Info } from 'lucide-react';
import { C, RISK, riskLevelFor, valenceOf, VALENCE_COLOR, pct, fmtDay, fmtDayLong, mean, std, cap } from './theme';
import { useWidth, useEntrance, xScale, yScale, smoothPath, DrawPath, Tooltip, TipRow, Key, Spark } from './charts';

type Raw = any;

const DETECTORS: { key: string; name: string; what: string }[] = [
  { key: 'mahalanobis', name: 'Pattern distance', what: 'How far the whole day sits from your usual pattern' },
  { key: 'copula', name: 'Unusual combinations', what: 'Signals that rarely appear together for you' },
  { key: 'isolation_forest', name: 'Outlier check', what: 'How easily the day separates from the rest' },
  { key: 'knn', name: 'Nearest days', what: 'Distance to your most similar past days' },
];

const DRIFT_TEXT: Record<number, string> = { 1: 'Within range', 2: 'Above baseline', 3: 'Below baseline', 4: 'Oscillating' };

function seriesByDate(pairs: [string, number][] | undefined, dates: string[]) {
  const m = new Map((pairs || []).map(([d, v]) => [d, v]));
  return dates.map(d => (m.has(d) ? (m.get(d) as number) : null));
}

export function headlineFor(raw: Raw, isPatient = true) {
  const their = isPatient ? 'your' : 'their';
  const p = raw?.prediction?.probability ?? 0;
  const level = riskLevelFor(p, raw?.prediction?.risk_level);
  const a: number[] = raw?.anomaly_scores || [];
  const k = Math.min(10, Math.floor(a.length / 3));
  const early = mean(a.slice(0, k)) ?? 0, late = mean(a.slice(-k)) ?? 0;
  const clause = late - early > 0.12 ? `${their} patterns have been moving away from ${their} usual over the last ${k} days`
    : early - late > 0.12 ? `and ${their} patterns have been settling back toward ${their} usual`
    : `and ${their} patterns have held fairly steady`;
  const joiner = late - early > 0.12 ? ', and ' : ' ';
  return { level, text: `${RISK[level].word} risk${joiner}${clause}.` };
}

/* ---------------- risk scale ---------------- */
function RiskScale({ p, level }: { p: number; level: keyof typeof RISK }) {
  const t = useEntrance(1100, 150);
  return (
    <div className="w-full">
      <div className="flex items-end justify-between mb-2">
        <span className="text-[13px]" style={{ color: C.text2 }}>Model-estimated risk</span>
        <span className="font-serif text-[40px] leading-none tabular-nums" style={{ color: C.text }}>
          {Math.round(p * 100 * t)}<span className="text-[20px]" style={{ color: C.text2 }}>%</span>
        </span>
      </div>
      <div className="relative h-3">
        <div className="absolute inset-0 flex gap-[2px] overflow-hidden rounded-full">
          {(Object.keys(RISK) as (keyof typeof RISK)[]).map(k => (
            <div key={k} className="h-full" style={{ width: `${(RISK[k].to - RISK[k].from) * 100}%`, background: RISK[k].color, opacity: k === level ? 0.95 : 0.22 }} />
          ))}
        </div>
        <div className="absolute -top-[5px] h-[22px] w-[3px] rounded-full" style={{ left: `calc(${p * 100 * t}% - 1.5px)`, background: C.text, boxShadow: `0 0 0 3px ${C.surface}` }} />
      </div>
      <div className="mt-2 flex justify-between text-[11px]" style={{ color: C.muted }}>
        {(Object.keys(RISK) as (keyof typeof RISK)[]).map(k => (
          <span key={k} style={{ color: k === level ? C.text : C.muted, fontWeight: k === level ? 600 : 400 }}>{RISK[k].word}</span>
        ))}
      </div>
    </div>
  );
}

/* ---------------- the synchronized timeline ---------------- */
function Timeline({ raw, hover, setHover }: { raw: Raw; hover: number | null; setHover: (i: number | null) => void }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const t = useEntrance(1400, 250);
  const dates: string[] = raw.timestamps || [];
  const n = dates.length;
  const sent: number[] = raw.sentiment_series || [];
  const anom: number[] = raw.anomaly_scores || [];
  const flags: boolean[] = raw.is_anomaly_flags || anom.map(() => false);
  const emo: string[] = raw.emotions_series || [];
  const states: number[] = raw.cusum_status?.states || [];
  const calib = Math.min(14, n);
  const baseMean = mean(sent.slice(0, calib)) ?? 0.5;
  const baseSd = std(sent.slice(0, calib));

  const PAD_L = 44, PAD_R = 16;
  const H1 = 170, GAP = 46, H2 = 110, H3 = 22, AX = 26;
  const top1 = 8, top2 = top1 + H1 + GAP, top3 = top2 + H2 + 34, total = top3 + H3 + AX;
  const X = xScale(n, PAD_L + 6, Math.max(PAD_L + 7, w - PAD_R - 6));
  const step = n > 1 ? (X(1) - X(0)) : 20;
  const Y1 = yScale(0, 1, top1 + H1, top1);
  const Y2 = yScale(0, 1, top2 + H2, top2);
  const barW = Math.max(2, Math.min(14, step * 0.62));
  const moodD = smoothPath(sent, X, Y1);
  const areaD = moodD ? `${moodD}L${X(n - 1)},${Y1(0)}L${X(0)},${Y1(0)}Z` : '';
  const tickEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((w - 80) / 90))));

  // contiguous drift-alert ranges
  const ranges: [number, number][] = [];
  states.forEach((s, i) => {
    if (s !== 1 && s != null) { const last = ranges[ranges.length - 1]; if (last && last[1] === i - 1) last[1] = i; else ranges.push([i, i]); }
  });

  const pick = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect(); if (!r || n === 0) return;
    const mx = clientX - r.left;
    const i = Math.round(((mx - X(0)) / (X(n - 1) - X(0) || 1)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') { setHover(Math.min(n - 1, (hover ?? -1) + 1)); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { setHover(Math.max(0, (hover ?? n) - 1)); e.preventDefault(); }
    if (e.key === 'Escape') setHover(null);
  };

  const sleep = seriesByDate(raw.sleep_series, dates);
  const act = seriesByDate(raw.activity_series, dates);
  const mood = seriesByDate(raw.music_series, dates);

  return (
    <div ref={ref} className="relative select-none outline-none rounded-xl focus-visible:ring-2 focus-visible:ring-blue-500/60" tabIndex={0} onKeyDown={onKey}
      onMouseMove={e => pick(e.clientX)} onMouseLeave={() => setHover(null)} onTouchMove={e => pick(e.touches[0].clientX)}
      aria-label="Daily timeline. Use left and right arrow keys to move between days.">
      {w > 0 && (
        <svg width={w} height={total} className="block overflow-visible">
          <defs>
            <linearGradient id="moodWash" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={C.mood} stopOpacity={0.22} />
              <stop offset="100%" stopColor={C.mood} stopOpacity={0} />
            </linearGradient>
          </defs>
          {/* drift alert bands across both panels */}
          {ranges.map(([a, b]) => (
            <rect key={a} x={X(a) - step / 2} width={Math.max(step, X(b) - X(a) + step)} y={top1 - 4} height={top2 + H2 - top1 + 8}
              fill={C.warning} opacity={0.07 * t} rx={4} />
          ))}
          {/* panel 1 — mood tone */}
          {[0, 0.5, 1].map(v => (
            <g key={v}>
              <line x1={PAD_L} x2={w - PAD_R} y1={Y1(v)} y2={Y1(v)} stroke={C.grid} />
              <text x={PAD_L - 10} y={Y1(v) + 4} textAnchor="end" fontSize={11} fill={C.muted}>{v === 0.5 ? 'neutral' : v === 1 ? 'positive' : 'negative'}</text>
            </g>
          ))}
          <rect x={PAD_L} width={Math.max(0, w - PAD_L - PAD_R)} y={Y1(Math.min(1, baseMean + baseSd))} height={Math.max(1, Y1(Math.max(0, baseMean - baseSd)) - Y1(Math.min(1, baseMean + baseSd)))}
            fill={C.text2} opacity={0.06} />
          <line x1={PAD_L} x2={w - PAD_R} y1={Y1(baseMean)} y2={Y1(baseMean)} stroke={C.text2} strokeOpacity={0.28} />
          <path d={areaD} fill="url(#moodWash)" opacity={t} />
          <DrawPath d={moodD} color={C.mood} width={2.25} t={t} />
          {/* panel 2 — unusualness columns */}
          {[0, 0.5, 1].map(v => (
            <g key={v}>
              <line x1={PAD_L} x2={w - PAD_R} y1={Y2(v)} y2={Y2(v)} stroke={C.grid} />
              <text x={PAD_L - 10} y={Y2(v) + 4} textAnchor="end" fontSize={11} fill={C.muted}>{Math.round(v * 100)}</text>
            </g>
          ))}
          {anom.map((v, i) => {
            const k = Math.max(0, Math.min(1, t * 1.6 - (i / Math.max(1, n)) * 0.6));
            const h = (Y2(0) - Y2(v)) * k;
            const r = Math.min(4, barW / 2, h);
            const x = X(i) - barW / 2, y = Y2(0) - h;
            return (
              <path key={i} d={`M${x},${Y2(0)}V${y + r}Q${x},${y} ${x + r},${y}H${x + barW - r}Q${x + barW},${y} ${x + barW},${y + r}V${Y2(0)}Z`}
                fill={C.unusual} opacity={hover === i ? 1 : flags[i] ? 0.95 : 0.42} />
            );
          })}
          {/* panel 3 — dominant emotion per day */}
          {emo.map((e, i) => (
            <circle key={i} cx={X(i)} cy={top3 + H3 / 2} r={hover === i ? 5.5 : 4} fill={VALENCE_COLOR[valenceOf(e)]} opacity={t} stroke={C.surface} strokeWidth={2} />
          ))}
          {/* x axis */}
          {dates.map((d, i) => (i % tickEvery === 0 || i === n - 1) && (i === n - 1 || n - 1 - i >= tickEvery * 0.6) ? (
            <text key={d} x={X(i)} y={total - 6} textAnchor="middle" fontSize={11} fill={C.muted}>{fmtDay(d)}</text>
          ) : null)}
          {/* crosshair */}
          {hover != null && (
            <g>
              <line x1={X(hover)} x2={X(hover)} y1={top1 - 4} y2={top3 + H3} stroke={C.text} strokeOpacity={0.35} />
              {sent[hover] != null && <circle cx={X(hover)} cy={Y1(sent[hover])} r={5} fill={C.mood} stroke={C.surface} strokeWidth={2.5} />}
            </g>
          )}
          {/* panel captions */}
          <text x={PAD_L} y={top2 - 14} fontSize={12} fill={C.text2}>How unusual each day was against the personal baseline</text>
          <text x={PAD_L} y={top3 - 10} fontSize={12} fill={C.text2}>Strongest emotion in what you wrote</text>
        </svg>
      )}
      {hover != null && w > 0 && (
        <Tooltip x={X(hover)} width={w} top={Math.max(0, Y1(sent[hover] ?? 0.5) - 120)}>
          <div className="mb-1.5 font-medium">{fmtDayLong(dates[hover])}</div>
          <TipRow color={C.mood} label="Mood tone" value={pct(sent[hover])} />
          <TipRow color={C.unusual} label="Unusualness" value={pct(anom[hover])} sub={flags[hover] ? 'flagged' : undefined} />
          <TipRow color={VALENCE_COLOR[valenceOf(emo[hover])]} label="Emotion" value={cap(emo[hover] || '—')} />
          {states[hover] != null && <TipRow label="Drift check" value={DRIFT_TEXT[states[hover]] || '—'} />}
          {(sleep[hover] != null || act[hover] != null || mood[hover] != null) && <div className="my-1.5 h-px" style={{ background: C.line }} />}
          {sleep[hover] != null && <TipRow label="Sleep" value={`${sleep[hover]}h`} />}
          {act[hover] != null && <TipRow label="Activity" value={pct(act[hover])} />}
          {mood[hover] != null && <TipRow label="Self-rated mood" value={pct(mood[hover])} />}
        </Tooltip>
      )}
    </div>
  );
}

/* ---------------- page ---------------- */
export default function ResultsPage({ raw, isPatient, onExplain, onForecast }: { raw: Raw; isPatient: boolean; onExplain: () => void; onForecast: () => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const t = useEntrance(900, 500);
  const dates: string[] = raw.timestamps || [];
  const n = dates.length;
  const p = raw.prediction?.probability ?? 0;
  const { level, text } = headlineFor(raw, isPatient);
  const flags: boolean[] = raw.is_anomaly_flags || [];
  const sent: number[] = raw.sentiment_series || [];
  const wk = Math.min(7, Math.floor(n / 2));
  const moodEarly = mean(sent.slice(0, wk)), moodLate = mean(sent.slice(-wk));
  const cs = raw.cusum_status || {};
  const detScores: Record<string, number>[] = raw.detector_scores || [];
  const latestDet = detScores[detScores.length - 1] || {};
  const health = useMemo(() => [
    { key: 'sleep', label: 'Sleep', vals: seriesByDate(raw.sleep_series, dates), lo: 0, hi: 12, fmt: (v: number) => `${v.toFixed(1)}h`, color: C.health },
    { key: 'sq', label: 'Sleep quality', vals: seriesByDate(raw.sleep_quality_series, dates), lo: 0, hi: 1, fmt: (v: number) => pct(v), color: C.health },
    { key: 'act', label: 'Activity', vals: seriesByDate(raw.activity_series, dates), lo: 0, hi: 1, fmt: (v: number) => pct(v), color: C.health },
    { key: 'mood', label: 'Self-rated mood', vals: seriesByDate(raw.music_series, dates), lo: 0, hi: 1, fmt: (v: number) => pct(v), color: C.health },
  ].filter(h => h.vals.some(v => v != null)), [raw]);
  const driftSince = (() => {
    const st: number[] = cs.states || []; let i = st.length - 1;
    if (i < 0 || st[i] === 1) return null;
    while (i > 0 && st[i - 1] !== 1) i--;
    return dates[i];
  })();
  const range = n ? `${fmtDay(dates[0])} – ${fmtDay(dates[n - 1])}` : '';

  return (
    <div className="insights mx-auto max-w-[1180px] px-1 pb-16" style={{ color: C.text }}>
      {/* reading */}
      <section className="grid gap-10 pt-4 lg:grid-cols-[1.35fr_1fr] lg:items-end">
        <div>
          <p className="text-[14px] mb-4" style={{ color: C.text2 }}>
            {isPatient ? 'Your reading' : 'Patient reading'} for {n} days, {range}
          </p>
          <h1 className="font-serif text-[clamp(30px,3.6vw,46px)] leading-[1.12] tracking-[-0.01em]" style={{ color: C.text, fontVariationSettings: '"opsz" 72, "SOFT" 50' }}>
            {text}
          </h1>
        </div>
        <div className="rounded-2xl p-6" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
          <RiskScale p={p} level={level} />
          <p className="mt-4 text-[12px] leading-relaxed" style={{ color: C.muted }}>
            Probability of a depression-like pattern from a model trained on clinical interviews (DAIC-WOZ), calibrated. A screening signal, not a diagnosis.
            {raw.prediction?.intervention_recommended ? ' A check-in with someone you trust or a professional is suggested.' : ''}
          </p>
        </div>
      </section>

      {/* three facts */}
      <dl className="mt-10 grid grid-cols-1 sm:grid-cols-3" style={{ borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
        <div className="py-5 sm:pr-6">
          <dt className="text-[13px]" style={{ color: C.text2 }}>Unusual days</dt>
          <dd className="mt-1 text-[22px] tabular-nums">{flags.filter(Boolean).length} <span className="text-[15px]" style={{ color: C.text2 }}>of {n}</span></dd>
        </div>
        <div className="py-5 sm:px-6" style={{ borderLeft: `1px solid ${C.line}` }}>
          <dt className="text-[13px]" style={{ color: C.text2 }}>{isPatient ? 'Drift from your baseline' : 'Drift from baseline'}</dt>
          <dd className="mt-1 text-[22px]">{cs.current_title || '—'}</dd>
          {driftSince && <dd className="text-[12px] mt-0.5" style={{ color: C.muted }}>since {fmtDay(driftSince)}</dd>}
        </div>
        <div className="py-5 sm:pl-6" style={{ borderLeft: `1px solid ${C.line}` }}>
          <dt className="text-[13px]" style={{ color: C.text2 }}>Mood tone, first week to last week</dt>
          <dd className="mt-1 text-[22px] tabular-nums">{pct(moodEarly)} <span style={{ color: C.muted }}>to</span> {pct(moodLate)}</dd>
        </div>
      </dl>

      {/* timeline */}
      <section className="mt-10 rounded-2xl p-5 sm:p-7" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-[24px] leading-tight">Day by day</h2>
            <p className="mt-1 text-[13px] max-w-[60ch]" style={{ color: C.text2 }}>
              Hover or use the arrow keys to read any day. The first {Math.min(14, n)} days set the personal baseline everything else is compared to.
            </p>
          </div>
          <button onClick={() => setTable(v => !v)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500/60"
            style={{ color: C.text2, border: `1px solid ${C.line}` }}>
            {table ? <LineIcon className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}{table ? 'Show chart' : 'Show as table'}
          </button>
        </div>
        <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2">
          <Key color={C.mood} label="Mood tone of the writing" />
          <Key color="rgba(166,174,192,0.25)" kind="band" label={isPatient ? 'Your usual range' : 'Usual range'} />
          <Key color={C.unusual} kind="bar" label="Unusualness (solid = flagged)" />
          <Key color="rgba(250,178,25,0.35)" kind="band" label="Drift alert" />
          <Key color={VALENCE_COLOR.positive} kind="dot" label="Positive" />
          <Key color={VALENCE_COLOR.neutral} kind="dot" label="Neutral" />
          <Key color={VALENCE_COLOR.negative} kind="dot" label="Negative" />
        </div>
        {table ? (
          <div className="max-h-[420px] overflow-auto text-[13px]">
            <table className="w-full tabular-nums">
              <thead className="sticky top-0" style={{ background: C.surface, color: C.text2 }}>
                <tr className="text-left"><th className="py-2 font-normal">Day</th><th className="font-normal">Mood tone</th><th className="font-normal">Unusualness</th><th className="font-normal">Emotion</th><th className="font-normal">Drift</th></tr>
              </thead>
              <tbody>
                {dates.map((d, i) => (
                  <tr key={d} style={{ borderTop: `1px solid ${C.line}` }}>
                    <td className="py-1.5">{fmtDayLong(d)}</td><td>{pct(sent[i])}</td>
                    <td>{pct(raw.anomaly_scores?.[i])}{flags[i] ? ' · flagged' : ''}</td>
                    <td>{cap(raw.emotions_series?.[i] || '—')}</td><td>{DRIFT_TEXT[cs.states?.[i]] || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Timeline raw={raw} hover={hover} setHover={setHover} />}
      </section>

      {/* health + detectors */}
      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        {health.length > 0 && (
          <div className="rounded-2xl p-5 sm:p-7" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
            <h2 className="font-serif text-[22px] leading-tight">Your daily check-ins</h2>
            <p className="mt-1 mb-5 text-[13px]" style={{ color: C.text2 }}>The sliders you set each day. They move with the timeline above.</p>
            <div className="space-y-4">
              {health.map(h => {
                const avg = mean(h.vals), v = hover != null ? h.vals[hover] : [...h.vals].reverse().find(x => x != null);
                return (
                  <div key={h.key} className="grid grid-cols-[110px_1fr_70px] items-center gap-4">
                    <div>
                      <div className="text-[13px]">{h.label}</div>
                      <div className="text-[11px]" style={{ color: C.muted }}>avg {avg == null ? '—' : h.fmt(avg)}</div>
                    </div>
                    <Spark vals={h.vals} color={h.color} lo={h.lo} hi={h.hi} hover={hover} t={t} height={38} />
                    <div className="text-right text-[15px] tabular-nums">{v == null ? '—' : h.fmt(v as number)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="rounded-2xl p-5 sm:p-7" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
          <h2 className="font-serif text-[22px] leading-tight">Four detectors, one verdict</h2>
          <p className="mt-1 mb-5 text-[13px]" style={{ color: C.text2 }}>
            {hover != null ? `Scores for ${fmtDayLong(dates[hover])}.` : 'Scores for your most recent day.'} Each looks for “unusual” in a different way; the bars above combine them.
          </p>
          <div className="space-y-4">
            {DETECTORS.map(d => {
              const series = detScores.map(s => s?.[d.key] ?? null);
              const v = hover != null ? series[hover] : latestDet[d.key];
              return (
                <div key={d.key} className="grid grid-cols-[1fr_90px_44px] items-center gap-4">
                  <div>
                    <div className="text-[13px]">{d.name}</div>
                    <div className="text-[11px] leading-snug" style={{ color: C.muted }}>{d.what}</div>
                    <div className="mt-1.5 h-[6px] rounded-full" style={{ background: C.raised }}>
                      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.max(2, (v ?? 0) * 100 * t)}%`, background: C.unusual }} />
                    </div>
                  </div>
                  <Spark vals={series} color={C.unusual} hover={hover} t={t} height={30} />
                  <div className="text-right text-[14px] tabular-nums">{pct(v)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* next */}
      <nav className="mt-10 grid gap-4 sm:grid-cols-2" aria-label="More about this result">
        {[
          { title: 'Why this score', body: (raw.shap_explanation?.sentences?.[0]) || 'See which signals raised or lowered your estimate.', on: onExplain },
          { title: 'The next 7 days', body: 'A forecast of your twin index, built from your last 30 days.', on: onForecast },
        ].map(c => (
          <button key={c.title} onClick={c.on} className="group flex items-center justify-between gap-6 rounded-2xl p-6 text-left cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/60"
            style={{ background: C.surface, border: `1px solid ${C.line}` }}>
            <span>
              <span className="block font-serif text-[22px]">{c.title}</span>
              <span className="mt-1 block text-[13px] leading-relaxed" style={{ color: C.text2 }}>{c.body}</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" style={{ color: C.text2 }} />
          </button>
        ))}
      </nav>
      <p className="mt-8 flex items-start gap-2 text-[12px] leading-relaxed max-w-[80ch]" style={{ color: C.muted }}>
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        Everything on this page was computed on this computer from your check-ins and imported messages. Nothing was sent anywhere.
      </p>
    </div>
  );
}
