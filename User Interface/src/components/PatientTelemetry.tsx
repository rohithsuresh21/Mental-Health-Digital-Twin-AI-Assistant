import { CalendarDays, Flame, Mic, MessageSquare, Send, Globe, PenLine, CheckCircle2, Circle, Moon, Zap, Smile, BedDouble } from 'lucide-react';
import type { PatientStatus, HistoryEntry } from '../hooks/usePatientData';

const SOURCE_META: Record<string, { label: string; color: string; icon: any }> = {
  checkin:  { label: 'Check-ins', color: '#60a5fa', icon: PenLine },
  voice:    { label: 'Voice',     color: '#c084fc', icon: Mic },
  whatsapp: { label: 'WhatsApp',  color: '#34d399', icon: MessageSquare },
  telegram: { label: 'Telegram',  color: '#38bdf8', icon: Send },
  reddit:   { label: 'Reddit',    color: '#fb923c', icon: Globe },
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function CalibrationBar({ count, need, calibrated }: { count: number; need: number; calibrated: boolean }) {
  const pct = calibrated ? 100 : Math.min(100, Math.round((count / need) * 100));
  const color = calibrated || count >= need ? '#10b981' : count >= 10 ? '#f97316' : count >= 6 ? '#eab308' : '#ef4444';
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] tracking-widest text-gray-500 font-bold uppercase">Baseline calibration</span>
        <span className="text-[11px] font-mono text-gray-300">{calibrated ? `${count} days · calibrated` : `${Math.min(count, need)}/${need} days`}</span>
      </div>
      <div className="h-2.5 bg-[#1A202C] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: pct + '%', backgroundColor: color, boxShadow: `0 0 10px ${color}55` }} />
      </div>
      <p className="text-[11px] text-gray-500 mt-1.5">
        {calibrated ? 'Your personal baseline is calibrated and keeps learning from every new day.'
          : `${Math.max(0, need - count)} more day${need - count === 1 ? '' : 's'} until your personal baseline is ready.`}
      </p>
    </div>
  );
}

function Calendar({ history }: { history: HistoryEntry[] }) {
  const byDate = new Map(history.map(h => [h.entry_date, h]));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today); start.setDate(start.getDate() - 34);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // align to Monday
  const days: Date[] = [];
  for (const d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) days.push(new Date(d));
  return (
    <div className="max-w-[340px]">
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => <div key={i} className="text-[9px] text-gray-600 text-center">{l}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map(d => {
          const key = iso(d); const h = byDate.get(key);
          const src = h?.sources || [];
          const checkin = src.includes('checkin') || src.includes('voice');
          const bg = !h ? '#141925' : checkin ? '#2563eb' : '#7c3aed';
          const isToday = key === iso(today);
          return (
            <div key={key} title={`${key}${h ? ' · ' + src.map(s => SOURCE_META[s]?.label || s).join(', ') : ' · no entry'}`}
              className={`relative aspect-square rounded-[5px] flex items-center justify-center text-[9px] ${isToday ? 'ring-1 ring-white/60' : ''}`}
              style={{ backgroundColor: bg, opacity: h ? (h.features_extracted ? 1 : 0.55) : 1 }}>
              <span className={h ? 'text-white/90' : 'text-gray-600'}>{d.getDate()}</span>
              {h?.has_audio && <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-fuchsia-300" />}
              {src.some(s => ['whatsapp', 'telegram', 'reddit'].includes(s)) && checkin && <span className="absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-300" />}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 mt-2 text-[9px] text-gray-500">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-blue-600" />check-in</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-violet-600" />chat only</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-fuchsia-300" />voice note</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />+ chat import</span>
      </div>
    </div>
  );
}

function Trend({ title, icon: Icon, color, points, max, fmt }: { title: string; icon: any; color: string; points: { d: string; v: number }[]; max: number; fmt: (v: number) => string }) {
  const avg = points.length ? points.reduce((a, p) => a + p.v, 0) / points.length : null;
  const recent = points.slice(-7); const earlier = points.slice(-14, -7);
  const delta = recent.length && earlier.length ? recent.reduce((a, p) => a + p.v, 0) / recent.length - earlier.reduce((a, p) => a + p.v, 0) / earlier.length : 0;
  const arrow = Math.abs(delta) < max * 0.04 ? '→' : delta > 0 ? '↑' : '↓';
  return (
    <div className="bg-[#0B0E14] border border-[#1A202C] rounded-xl p-4 min-w-0 overflow-hidden">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap"><Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} />{title}</span>
        <span className="text-xs font-bold whitespace-nowrap" style={{ color }}>{avg == null ? '—' : fmt(avg)} <span className="text-gray-500 font-normal">{points.length >= 14 ? arrow : ''}</span></span>
      </div>
      {points.length === 0 ? <div className="h-10 flex items-center text-[11px] text-gray-600">No data yet</div> : (
        <div className="flex items-end gap-px h-10 overflow-hidden">
          {points.slice(-30).map((p, i) => (
            <div key={i} title={`${p.d}: ${fmt(p.v)}`} className="flex-1 min-w-0 rounded-t-sm"
              style={{ height: `${Math.max(6, (p.v / max) * 100)}%`, backgroundColor: color, opacity: 0.45 + 0.55 * (p.v / max) }} />
          ))}
        </div>
      )}
      <div className="text-[9px] text-gray-600 mt-1">{points.length ? `avg of ${points.length} day${points.length === 1 ? '' : 's'}${points.length >= 14 ? ' · arrow = last 7 vs previous 7 days' : ''}` : ''}</div>
    </div>
  );
}

export default function PatientTelemetry({ status, compact = false, narrow = false }: { status: PatientStatus | null; compact?: boolean; narrow?: boolean }) {
  if (!status) return null;
  const ds = status.dataset;
  const history = [...(status.history || [])].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  const series = (k: keyof HistoryEntry) => history.filter(h => h[k] != null).map(h => ({ d: h.entry_date, v: Number(h[k]) }));
  const pctFmt = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <div className="space-y-4" id="patient-telemetry">
      <div className="bg-[#11131C]/80 backdrop-blur-sm border border-[#1A202C] rounded-2xl p-5">
        <CalibrationBar count={status.entry_count} need={status.entries_needed || 14} calibrated={status.calibrated} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {[
            { label: 'Current streak', value: `${ds?.current_streak ?? 0}d`, icon: Flame, color: 'text-orange-400' },
            { label: 'Longest streak', value: `${ds?.longest_streak ?? 0}d`, icon: CalendarDays, color: 'text-blue-400' },
            { label: 'Days logged', value: String(ds?.days_logged ?? status.entry_count), icon: CheckCircle2, color: 'text-emerald-400' },
            { label: 'Missed days', value: String(ds?.missing_days ?? 0), icon: Circle, color: (ds?.missing_days ?? 0) > 3 ? 'text-amber-400' : 'text-gray-400' },
          ].map(k => (
            <div key={k.label} className="bg-[#0B0E14] border border-[#1A202C] rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[9px] text-gray-500 uppercase tracking-wider"><k.icon className={`h-3 w-3 ${k.color}`} />{k.label}</div>
              <div className="text-lg font-bold text-white mt-0.5">{k.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className={`grid gap-4 ${compact ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 lg:grid-cols-2'}`}>
        <div className="bg-[#11131C]/80 backdrop-blur-sm border border-[#1A202C] rounded-2xl p-5">
          <div className="text-[10px] tracking-widest text-gray-500 font-bold uppercase mb-3">Last 5 weeks</div>
          <Calendar history={history} />
          {ds && Object.keys(ds.sources).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {Object.entries(ds.sources).sort((a, b) => b[1] - a[1]).map(([k, n]) => {
                const m = SOURCE_META[k] || { label: k, color: '#9ca3af', icon: Circle };
                return (
                  <span key={k} className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] border border-[#1A202C] bg-[#0B0E14]" style={{ color: m.color }}>
                    <m.icon className="h-3 w-3" />{m.label} · {n}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-[#11131C]/80 backdrop-blur-sm border border-[#1A202C] rounded-2xl p-5">
          <div className="text-[10px] tracking-widest text-gray-500 font-bold uppercase mb-3">AI pipeline readiness</div>
          <div className="space-y-2.5">
            {(ds?.stages || []).map(st => {
              const pct = Math.min(100, Math.round((st.have / Math.max(1, st.need)) * 100));
              return (
                <div key={st.key}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 text-gray-300">
                      {st.ready ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Circle className="h-3.5 w-3.5 text-gray-600" />}
                      {st.name}
                    </span>
                    <span className="font-mono text-[10px] text-gray-500">{Math.min(st.have, st.need)}/{st.need}</span>
                  </div>
                  <div className="h-1 bg-[#1A202C] rounded-full overflow-hidden mt-1">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: pct + '%', backgroundColor: st.ready ? '#10b981' : '#3b82f6' }} />
                  </div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{st.note}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {!compact && (
        <div className={`grid gap-4 ${narrow ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'}`}>
          <Trend title="Sleep" icon={BedDouble} color="#818cf8" points={series('sleep_hours')} max={12} fmt={v => `${v.toFixed(1)}h`} />
          <Trend title="Sleep quality" icon={Moon} color="#a78bfa" points={series('sleep_quality')} max={1} fmt={pctFmt} />
          <Trend title="Activity" icon={Zap} color="#34d399" points={series('activity_level')} max={1} fmt={pctFmt} />
          <Trend title="Mood" icon={Smile} color="#f472b6" points={series('music_mood_score')} max={1} fmt={pctFmt} />
        </div>
      )}
    </div>
  );
}
