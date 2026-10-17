import { useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { C, GROUP_COLORS, pct } from './theme';
import { waterfall } from './derive';
import { onEvent } from '../guide/bus';
import { AskLink } from '../guide/Guide';
import { useEffect } from 'react';
import { useWidth, useEntrance } from './charts';

type Raw = any;
type Feat = { full_name: string; concept: string; group: string; description: string; shap_value: number; direction: string; feature_value: number; stat?: string };

const SHOW = 8;
const pts = (d: number) => `${d >= 0 ? '+' : '−'}${Math.abs(d * 100).toFixed(1)}`;

function useSteps(raw: Raw) {
  return useMemo(() => waterfall(raw, SHOW), [raw]);
}

function Waterfall({ rows, open, setOpen }: { rows: NonNullable<ReturnType<typeof useSteps>>['rows']; open: string | null; setOpen: (k: string | null) => void }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const t = useEntrance(380 + rows.length * 120, 200);
  const maxP = Math.max(...rows.map(r => Math.max(r.from, r.to)));
  const hi = Math.min(1, Math.ceil((maxP + 0.08) * 10) / 10);
  const LABEL = w < 640 ? 0 : Math.min(330, w * 0.36);
  const VAL = 64;
  const plotW = Math.max(40, w - LABEL - VAL - 12);
  const X = (p: number) => (p / hi) * plotW;
  const ticks = Array.from({ length: Math.round(hi * 10) + 1 }, (_, i) => i / 10).filter((_, i, a) => a.length <= 6 || i % 2 === 0);

  return (
    <div ref={ref} className="relative">
      {w > 0 && (
        <>
          <div className="relative mb-1 text-[11px]" style={{ marginLeft: LABEL, width: plotW, height: 16, color: C.muted }}>
            {ticks.map(v => <span key={v} className="absolute -translate-x-1/2 tabular-nums" style={{ left: X(v) }}>{Math.round(v * 100)}%</span>)}
          </div>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0" style={{ left: LABEL, width: plotW }}>
              {ticks.map(v => <div key={v} className="absolute inset-y-0 w-px" style={{ left: X(v), background: C.grid }} />)}
            </div>
            {rows.map((r, i) => {
              const k = Math.max(0, Math.min(1, t * rows.length * 1.15 - i));
              const a = Math.min(r.from, r.to), b = Math.max(r.from, r.to);
              const isTotal = r.kind === 'base' || r.kind === 'final';
              const color = r.kind === 'up' ? C.raises : r.kind === 'down' ? C.lowers : r.kind === 'final' ? C.text : r.kind === 'base' ? C.neutral : '#4b5468';
              const left = r.kind === 'down' ? X(b) - (X(b) - X(a)) * k : X(a);
              const width = Math.max(isTotal ? 3 : 2, (X(b) - X(a)) * k);
              const expandable = !!r.feat;
              const isOpen = open === r.key;
              return (
                <div key={r.key}>
                  <button disabled={!expandable} onClick={() => setOpen(isOpen ? null : r.key)}
                    className={`relative flex w-full items-center text-left focus-visible:ring-2 focus-visible:ring-blue-500/60 rounded-lg ${expandable ? 'cursor-pointer' : 'cursor-default'}`}
                    style={{ minHeight: r.kind === 'final' ? 56 : 46, borderTop: r.kind === 'final' ? `1px solid ${C.line}` : undefined }}
                    aria-expanded={expandable ? isOpen : undefined}>
                    {LABEL > 0 && (
                      <span className="shrink-0 pr-5" style={{ width: LABEL }}>
                        <span className={`block leading-snug ${r.kind === 'final' ? 'font-serif text-[19px]' : 'text-[13px]'}`} style={{ color: r.kind === 'base' || r.kind === 'rest' || r.kind === 'cal' ? C.text2 : C.text }}>
                          {r.label}
                        </span>
                        {r.sub && <span className="block text-[11px]" style={{ color: C.muted }}>{r.sub}</span>}
                      </span>
                    )}
                    <span className="relative block" style={{ width: plotW, height: r.kind === 'final' ? 18 : 14 }}>
                      {LABEL === 0 && <span className="absolute -top-5 left-0 text-[12px] whitespace-nowrap" style={{ color: C.text2 }}>{r.label}</span>}
                      <span className="absolute top-0 h-full rounded-[4px]" style={{ left, width, background: color, opacity: k > 0 ? 1 : 0 }} />
                      {!isTotal && i > 0 && k >= 1 && (
                        <span className="absolute w-px" style={{ left: X(r.to), top: -16, height: 16 + (r.kind === 'final' ? 18 : 14), background: C.text2, opacity: 0.25 }} />
                      )}
                    </span>
                    <span className="flex shrink-0 items-center justify-end gap-1 tabular-nums" style={{ width: VAL, color: isTotal ? C.text : r.kind === 'up' ? C.raises : r.kind === 'down' ? C.lowers : C.text2, opacity: k >= 1 ? 1 : 0, transition: 'opacity 200ms' }}>
                      <span className={r.kind === 'final' ? 'text-[19px] font-medium' : 'text-[13px]'}>{isTotal ? pct(r.to, r.kind === 'final' ? 0 : 1) : pts(r.to - r.from)}</span>
                      {expandable && <ChevronDown className="h-3.5 w-3.5 transition-transform" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', color: C.muted }} />}
                    </span>
                  </button>
                  {isOpen && r.feat && (
                    <div className="mb-3 rounded-xl p-4 text-[13px] leading-relaxed" style={{ marginLeft: LABEL, background: C.raised, color: C.text2 }}>
                      <p>
                        <span style={{ color: C.text }}>{r.feat.concept}</span> is part of <span style={{ color: C.text }}>{r.feat.group.toLowerCase()}</span>.
                        {' '}It moved your estimate by <span style={{ color: r.kind === 'up' ? C.raises : C.lowers }}>{pts(r.to - r.from)} points</span>
                        {r.kind === 'up' ? ', raising it.' : ', lowering it.'}
                      </p>
                      <p className="mt-1.5" style={{ color: C.muted }}>
                        Your value for this signal: {Number(r.feat.feature_value).toFixed(3)} (model units, after normalising against your baseline). Effect on the model’s log-odds: {r.feat.shap_value >= 0 ? '+' : ''}{r.feat.shap_value.toFixed(3)}.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function ExplainPage({ raw, onBack, onForecast }: { raw: Raw; onBack: () => void; onForecast: () => void }) {
  const s = useSteps(raw);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => onEvent<string>('mhdt:open-row', k => setOpen(k)), []);
  const tg = useEntrance(900, 700);
  if (!s) {
    return (
      <div className="insights mx-auto max-w-[760px] py-24 text-center" style={{ color: C.text }}>
        <h1 className="font-serif text-[34px]">No explanation for this run</h1>
        <p className="mt-3 text-[14px]" style={{ color: C.text2 }}>The risk model needs at least 14 analysed days before it can explain itself. Run the analysis again once you have more check-ins.</p>
        <button onClick={onBack} className="mt-8 rounded-xl px-5 py-2.5 text-[13px] cursor-pointer" style={{ background: C.raised, color: C.text }}>Back to results</button>
      </div>
    );
  }
  const { rows, up, down, pFinal, p0, above, mainDriver: top } = s;
  const counter = (above ? down : up)[0];
  const where = above ? 'above' : 'below';
  const headline = !top ? 'No single signal dominates your estimate.'
    : top.kind === 'rest'
      ? `Many small signals together put your estimate ${where} the typical starting point${counter ? `, even though ${counter.concept.toLowerCase()} pushed the other way` : ''}.`
      : top.kind === 'cal'
        ? `Calibration moved your estimate ${where} the typical starting point more than any single signal.`
        : `${top.feat!.concept} is the main reason your estimate is ${where} the typical starting point.`;
  const groups: { group: string; total_impact: number }[] = s.groups;
  const gTotal = groups.reduce((a, g) => a + g.total_impact, 0) || 1;

  return (
    <div className="insights mx-auto max-w-[1180px] px-1 pb-16" style={{ color: C.text }}>
      <button onClick={onBack} className="mb-6 inline-flex items-center gap-1 text-[13px] cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500/60 rounded" style={{ color: C.text2 }}>
        <ChevronLeft className="h-4 w-4" />Results
      </button>
      <section className="max-w-[900px]">
        <p className="text-[14px] mb-4" style={{ color: C.text2 }}>Why this score</p>
        <h1 className="font-serif text-[clamp(30px,3.6vw,46px)] leading-[1.12] tracking-[-0.01em]" style={{ fontVariationSettings: '"opsz" 72, "SOFT" 50' }}>{headline}</h1>
        <p className="mt-5 text-[15px] leading-relaxed max-w-[68ch]" style={{ color: C.text2 }}>
          The model starts from where it would place a typical person, {pct(p0, 0)}, then each signal from your last 30 days pushes the estimate
          {' '}<span style={{ color: C.raises }}>up</span> or <span style={{ color: C.lowers }}>down</span>. Tap a signal to see what it measured.
        </p>
        <div className="mt-4 flex flex-wrap gap-2"><AskLink q="Explain my score simply" label="Explain this simply" /><AskLink q="Is this a diagnosis?" label="Is this a diagnosis?" /></div>
      </section>

      <section data-guide="waterfall" className="mt-10 rounded-2xl p-5 sm:p-8" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
        <Waterfall rows={rows} open={open} setOpen={setOpen} />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl p-5 sm:p-7" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
          <h2 className="font-serif text-[22px]">What kind of signals mattered</h2>
          <p className="mt-1 mb-5 text-[13px]" style={{ color: C.text2 }}>Share of the total push, in either direction, by family of signal.</p>
          <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full">
            {groups.map((g, i) => (
              <div key={g.group} title={`${g.group}: ${Math.round(g.total_impact / gTotal * 100)}%`} className="h-full first:rounded-l-full last:rounded-r-full"
                style={{ width: `${(g.total_impact / gTotal) * 100 * tg}%`, background: GROUP_COLORS[i % GROUP_COLORS.length] }} />
            ))}
          </div>
          <ul className="mt-5 space-y-2.5">
            {groups.map((g, i) => (
              <li key={g.group} className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: GROUP_COLORS[i % GROUP_COLORS.length] }} />{g.group}</span>
                <span className="tabular-nums" style={{ color: C.text2 }}>{Math.round((g.total_impact / gTotal) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl p-5 sm:p-7" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
          <h2 className="font-serif text-[22px]">In plain words</h2>
          <ul className="mt-4 space-y-3.5">
            {up.slice(0, 3).map((f: any) => (
              <li key={f.full_name} className="flex gap-3 text-[14px] leading-relaxed">
                <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: C.raises }} />
                <span><span style={{ color: C.text }}>{f.description}</span> <span style={{ color: C.text2 }}>raised your estimate.</span></span>
              </li>
            ))}
            {down.slice(0, 2).map((f: any) => (
              <li key={f.full_name} className="flex gap-3 text-[14px] leading-relaxed">
                <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: C.lowers }} />
                <span><span style={{ color: C.text }}>{f.description}</span> <span style={{ color: C.text2 }}>lowered it.</span></span>
              </li>
            ))}
          </ul>
          <button onClick={onForecast} className="group mt-7 inline-flex items-center gap-1.5 text-[13px] cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500/60 rounded" style={{ color: C.text }}>
            See the next 7 days<ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </section>

      <p className="mt-8 flex items-start gap-2 text-[12px] leading-relaxed max-w-[90ch]" style={{ color: C.muted }}>
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        Contributions are TreeSHAP values from the XGBoost risk model. They add up in log-odds, so each bar shows how far that signal moved the probability given the signals before it.
        Correlation, not cause: a signal raising the estimate means it resembles patterns seen in people who screened positive.
      </p>
    </div>
  );
}
