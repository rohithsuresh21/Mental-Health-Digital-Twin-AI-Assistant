import { useEffect, useLayoutEffect, useRef, useState, ReactNode } from 'react';
import { C, prefersReducedMotion } from './theme';

/* ---------- sizing ---------- */
export function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    setW(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref as React.RefObject<T>, w];
}

/* plays once per mount: 0 -> 1 over `ms` (instantly 1 with reduced motion) */
export function useEntrance(ms = 900, delay = 0) {
  const [t, setT] = useState(prefersReducedMotion() ? 1 : 0);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let raf = 0; const start = performance.now() + delay;
    const tick = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - start) / ms));
      setT(1 - Math.pow(1 - k, 3));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ms, delay]);
  return t;
}

export const xScale = (n: number, x0: number, x1: number) => (i: number) => (n <= 1 ? (x0 + x1) / 2 : x0 + (i / (n - 1)) * (x1 - x0));
export const yScale = (lo: number, hi: number, y0: number, y1: number) => (v: number) => y0 - ((v - lo) / (hi - lo || 1)) * (y0 - y1);

export function linePath(vals: (number | null)[], X: (i: number) => number, Y: (v: number) => number) {
  let d = '', open = false;
  vals.forEach((v, i) => {
    if (v == null || isNaN(v)) { open = false; return; }
    d += `${open ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`; open = true;
  });
  return d;
}
/* smooth (monotone-ish) path through points: Catmull-Rom -> cubic Bezier, tension tuned low */
export function smoothPath(vals: (number | null)[], X: (i: number) => number, Y: (v: number) => number) {
  const pts = vals.map((v, i) => (v == null ? null : [X(i), Y(v)] as [number, number]));
  let d = '';
  let run: [number, number][] = [];
  const flush = () => {
    if (!run.length) return;
    d += `M${run[0][0].toFixed(1)},${run[0][1].toFixed(1)}`;
    for (let i = 0; i < run.length - 1; i++) {
      const p0 = run[i - 1] || run[i], p1 = run[i], p2 = run[i + 1], p3 = run[i + 2] || p2;
      const t = 0.18;
      const c1 = [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t];
      const c2 = [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t];
      d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    run = [];
  };
  pts.forEach(p => { if (p) run.push(p); else flush(); });
  flush();
  return d;
}

/* ---------- path that draws itself in once ---------- */
export function DrawPath({ d, color, width = 2, t, opacity = 1 }: { d: string; color: string; width?: number; t: number; opacity?: number }) {
  const ref = useRef<SVGPathElement>(null);
  const [len, setLen] = useState(0);
  useLayoutEffect(() => { if (ref.current) setLen(ref.current.getTotalLength()); }, [d]);
  return (
    <path ref={ref} d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" opacity={opacity}
      strokeDasharray={len ? `${len} ${len}` : undefined} strokeDashoffset={len ? len * (1 - t) : undefined} />
  );
}

/* ---------- tooltip card that follows a crosshair ---------- */
export function Tooltip({ x, width, children, top = 8 }: { x: number; width: number; children: ReactNode; top?: number }) {
  const W = 220;
  const left = Math.min(Math.max(8, x + 14), Math.max(8, width - W - 8));
  const flip = x + 14 + W > width;
  return (
    <div className="pointer-events-none absolute z-20 rounded-xl border px-3 py-2.5 text-[12px] shadow-2xl transition-[left] duration-75"
      style={{ left: flip ? Math.max(8, x - W - 14) : left, top, width: W, background: 'rgba(14,18,27,0.96)', borderColor: C.line, color: C.text, backdropFilter: 'blur(6px)' }}>
      {children}
    </div>
  );
}

export function TipRow({ color, label, value, sub }: { color?: string; label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[3px]">
      <span className="flex items-center gap-1.5" style={{ color: C.text2 }}>
        {color && <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />}{label}
      </span>
      <span className="tabular-nums" style={{ color: C.text }}>{value}{sub && <span style={{ color: C.muted }}> {sub}</span>}</span>
    </div>
  );
}

/* ---------- legend key ---------- */
export function Key({ color, label, kind = 'line' }: { color: string; label: string; kind?: 'line' | 'bar' | 'dot' | 'band' }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: C.text2 }}>
      {kind === 'line' && <span className="inline-block h-[2px] w-4 rounded" style={{ background: color }} />}
      {kind === 'bar' && <span className="inline-block h-3 w-2 rounded-sm" style={{ background: color }} />}
      {kind === 'dot' && <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />}
      {kind === 'band' && <span className="inline-block h-3 w-4 rounded-sm" style={{ background: color }} />}
      {label}
    </span>
  );
}

/* ---------- compact sparkline with optional hover index ---------- */
export function Spark({ vals, color, hi = 1, lo = 0, height = 44, hover, t = 1 }: { vals: (number | null)[]; color: string; hi?: number; lo?: number; height?: number; hover?: number | null; t?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const X = xScale(vals.length, 3, Math.max(3, w - 3));
  const Y = yScale(lo, hi, height - 3, 3);
  const d = smoothPath(vals, X, Y);
  const last = [...vals].reverse().findIndex(v => v != null);
  const li = last < 0 ? -1 : vals.length - 1 - last;
  return (
    <div ref={ref} className="relative" style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height} className="block overflow-visible">
          <DrawPath d={d} color={color} t={t} />
          {hover != null && vals[hover] != null && (
            <>
              <line x1={X(hover)} x2={X(hover)} y1={0} y2={height} stroke={C.text2} strokeOpacity={0.35} />
              <circle cx={X(hover)} cy={Y(vals[hover] as number)} r={4} fill={color} stroke={C.surface} strokeWidth={2} />
            </>
          )}
          {hover == null && li >= 0 && t >= 1 && <circle cx={X(li)} cy={Y(vals[li] as number)} r={4} fill={color} stroke={C.surface} strokeWidth={2} />}
        </svg>
      )}
    </div>
  );
}
