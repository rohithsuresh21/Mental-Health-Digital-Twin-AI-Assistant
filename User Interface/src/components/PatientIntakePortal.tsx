import { useState, useRef, useEffect } from 'react';
import { Upload, Activity, Trash2, MessageSquare, Send, Globe, Check, Loader2, FileText, PenLine, BarChart3, Mic, CalendarDays, UserRound } from 'lucide-react';
import { usePatientData } from '../hooks/usePatientData';
import PatientTelemetry from './PatientTelemetry';

const BASE = '/api';

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function moodEmoji(v: number): string {
  if (v < 0.15) return '\u{1F62B}';
  if (v < 0.30) return '\u{1F622}';
  if (v < 0.45) return '\u{1F61E}';
  if (v < 0.55) return '\u{1F610}';
  if (v < 0.70) return '\u{1F642}';
  if (v < 0.85) return '\u{1F60A}';
  return '\u{1F604}';
}

function interpolateColor(v: number): string {
  const hue = v * 142;
  const sat = 70 + v * 20;
  const lit = 45 + v * 15;
  return `hsl(${hue}, ${sat}%, ${lit}%)`;
}

function FunSlider({ value, onChange, label, max = 1, step = 0.05, showPct = true }: {
  value: number; onChange: (v: number) => void; label: string;
  max?: number; step?: number; showPct?: boolean;
}) {
  const pct = max === 1 ? value : value / max;
  const emoji = moodEmoji(pct);
  const color = interpolateColor(pct);
  return (
    <div className="mb-4">
      <label className="flex items-center justify-between text-[11px] mb-2">
        <span className="text-gray-400">{label}</span>
        <span className="flex items-center gap-2">
          <span className="text-lg">{emoji}</span>
          <span className="text-gray-300 font-mono text-xs" style={{ color }}>
            {showPct ? `${Math.round(pct * 100)}%` : `${value.toFixed(1)}h`}
          </span>
        </span>
      </label>
      <input type="range" min={0} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-blue-500"
        style={{ accentColor: color }}
      />
    </div>
  );
}

type ChatRow = { date: string; platform: string; message: string; sender?: string; selected: boolean; matched: boolean };
type Tab = 'submit' | 'import' | 'data';

export default function PatientIntakePortal({ userId, onCalibrated, onNavigateToAnalysis }: { userId: string; onCalibrated?: () => void; onNavigateToAnalysis?: () => void }) {
  const { status, loading, refresh, deleteData } = usePatientData(userId);
  const [tab, setTab] = useState<Tab>('submit');
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [journal, setJournal] = useState('');
  const [entryDate, setEntryDate] = useState(todayIso());
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const [sliders, setSliders] = useState({ sleep_hours: 7, sleep_quality: 0.7, activity_level: 0.6, music_mood_score: 0.5 });

  // Chat import state
  const [chatName, setChatName] = useState(() => { try { return localStorage.getItem('chatName') || ''; } catch { return ''; } });
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [chatPlatform, setChatPlatform] = useState<'whatsapp' | 'telegram' | 'reddit'>('whatsapp');
  const [chatSubType, setChatSubType] = useState<'posts' | 'comments' | 'text'>('comments');
  const [chatPreview, setChatPreview] = useState<ChatRow[]>([]);
  const [chatSenders, setChatSenders] = useState<{ name: string; count: number }[]>([]);
  const [chatParsing, setChatParsing] = useState(false);
  const [chatMsg, setChatMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const chatFileRef = useRef<HTMLInputElement>(null);

  const count = status?.entry_count || 0;
  const calibrated = status?.calibrated || false;
  const [showCalibrationChoice, setShowCalibrationChoice] = useState(false);
  const checkedInDates = new Set((status?.history || []).filter(h => h.sources?.includes('checkin')).map(h => h.entry_date));
  const alreadyCheckedIn = checkedInDates.has(entryDate);

  useEffect(() => {
    if (calibrated) {
      onCalibrated?.();
      setShowCalibrationChoice(true);
    }
  }, [calibrated]);

  async function handleSubmit() {
    if (!journal.trim() && !audioFile) { setMsg({ text: 'Write a few words about your day or attach a voice note.', ok: false }); return; }
    setSubmitting(true);
    setMsg(null);
    const fd = new FormData();
    fd.append('user_id', userId);
    fd.append('entry_date', entryDate);
    fd.append('text', journal.trim());
    fd.append('sleep_hours', String(sliders.sleep_hours));
    fd.append('sleep_quality', String(sliders.sleep_quality));
    fd.append('activity_level', String(sliders.activity_level));
    fd.append('music_mood_score', String(sliders.music_mood_score));
    if (audioFile) fd.append('audio', audioFile);
    try {
      const r = await fetch(`${BASE}/daily/submit`, { method: 'POST', body: fd, credentials: 'include' });
      const d = await r.json();
      if (d.error) { setMsg({ text: d.error, ok: false }); } else {
        const left = Math.max(0, 14 - (d.entry_count || 0));
        setMsg({
          text: `Saved for ${d.entry_date}.` + (d.transcript ? ` Voice note transcribed: "${String(d.transcript).trim().slice(0, 120)}"` : '')
            + (d.calibrated ? ' Your baseline is up to date.' : ` ${left} more day${left === 1 ? '' : 's'} to calibrate.`),
          ok: true,
        });
        setJournal('');
        setAudioFile(null);
        if (audioRef.current) audioRef.current.value = '';
        refresh();
        onCalibrated?.();
      }
    } catch (e: any) { setMsg({ text: 'Error: ' + e.message, ok: false }); } finally { setSubmitting(false); }
  }

  async function handleDelete() {
    const ok = await deleteData();
    if (ok) setMsg({ text: 'All data cleared.', ok: true });
    setShowDeleteConfirm(false);
    onCalibrated?.();
  }

  async function handleChatParse(nameOverride?: string) {
    const name = (nameOverride ?? chatName).trim();
    if (!chatFile || !name) { setChatMsg({ text: 'Enter your name as it appears in the chat and select a file.', ok: false }); return; }
    if (chatPlatform !== 'reddit') { try { localStorage.setItem('chatName', name); } catch {} }
    setChatParsing(true);
    setChatMsg(null);
    setChatPreview([]);
    setChatSenders([]);
    const fd = new FormData();
    fd.append('user_id', userId);
    fd.append('name', name);
    fd.append('platform', chatPlatform);
    fd.append('sub_type', chatSubType);
    fd.append('file', chatFile);
    try {
      const r = await fetch(`${BASE}/daily/import-chat`, { method: 'POST', body: fd, credentials: 'include' });
      const d = await r.json();
      setChatSenders(d.senders || []);
      if (d.error) { setChatMsg({ text: d.error, ok: false }); return; }
      if (!d.entries.length) {
        setChatMsg({ text: `No messages from "${name}" in this file. Pick your name below.`, ok: false });
        return;
      }
      setChatPreview(d.entries.map((e: any) => ({ ...e, selected: true })));
      const days = new Set(d.entries.map((e: any) => e.date)).size;
      setChatMsg({ text: `${d.entries.length} of your messages across ${days} days — ${d.matched_count} land on days you already checked in, ${d.new_days} add new days.`, ok: true });
    } catch (e: any) { setChatMsg({ text: 'Error: ' + e.message, ok: false }); } finally { setChatParsing(false); }
  }

  async function handleChatImport() {
    const selected = chatPreview.filter(e => e.selected);
    if (selected.length === 0) { setChatMsg({ text: 'No messages selected.', ok: false }); return; }
    setChatParsing(true);
    try {
      const r = await fetch(`${BASE}/daily/confirm-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user_id: userId, entries: selected }),
      });
      const d = await r.json();
      if (d.error) { setChatMsg({ text: d.error, ok: false }); } else {
        setChatMsg({
          text: `Imported ${d.imported} message${d.imported === 1 ? '' : 's'} into ${d.days_updated} day${d.days_updated === 1 ? '' : 's'}` +
            (d.new_days ? ` (${d.new_days} new)` : '') + (d.duplicates_skipped ? `, skipped ${d.duplicates_skipped} already imported` : '') +
            `. ${d.entry_count} days now count toward your baseline.`,
          ok: true,
        });
        setChatPreview([]);
        setChatFile(null);
        if (chatFileRef.current) chatFileRef.current.value = '';
        refresh();
        onCalibrated?.();
      }
    } catch (e: any) { setChatMsg({ text: 'Error: ' + e.message, ok: false }); } finally { setChatParsing(false); }
  }

  if (loading && !status) {
    return <div className="text-center py-16 text-gray-500 text-sm">Loading patient data...</div>;
  }

  const Msg = ({ m }: { m: { text: string; ok: boolean } | null }) => m ? (
    <p className={`mt-3 text-[11px] leading-relaxed ${m.ok ? 'text-emerald-400' : 'text-amber-400'}`}>{m.text}</p>
  ) : null;

  return (
    <div className="max-w-2xl mx-auto">
      {tab !== 'data' && (
        <div className="mb-5">
          <PatientTelemetry status={status} compact />
        </div>
      )}

      {showCalibrationChoice && (
        <div className="bg-[#0F1729] border border-blue-500/30 rounded-2xl p-5 mb-5">
          <p className="text-sm text-gray-300 mb-4 text-center">
            Your baseline is ready with <strong>{count} days</strong>. What would you like to do?
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => setShowCalibrationChoice(false)}
              className="bg-[#1A202C] hover:bg-[#232B3B] text-gray-300 text-[11px] font-bold uppercase tracking-wider px-5 py-3 rounded-xl transition-all cursor-pointer">
              Keep logging
            </button>
            <button onClick={() => onNavigateToAnalysis?.()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold uppercase tracking-wider px-5 py-3 rounded-xl transition-all cursor-pointer">
              Analyze Now
            </button>
          </div>
          <p className="text-[10px] text-gray-500 text-center mt-3">
            Every extra day makes your baseline and forecasts more accurate.
          </p>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-[#1A202C] mb-5">
        {([
          { id: 'submit' as const, label: 'Check-in', icon: PenLine },
          { id: 'import' as const, label: 'Import chats', icon: MessageSquare },
          { id: 'data' as const, label: 'My data', icon: BarChart3 },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider cursor-pointer border-b-2 transition-all ${
              tab === t.id ? 'text-blue-400 border-blue-500' : 'text-gray-600 border-transparent hover:text-gray-400'
            }`}>
            <t.icon className="h-3.5 w-3.5" />{t.label}
          </button>
        ))}
      </div>

      {tab === 'submit' && (
        <div className="bg-[#11131C]/80 backdrop-blur-sm border border-[#1A202C] rounded-2xl p-6" id="checkin-form">
          <div className="flex items-center justify-between gap-3 mb-5">
            <span className="flex items-center gap-2 text-[10px] tracking-widest text-gray-500 font-bold uppercase">
              <Activity className="h-4 w-4 text-blue-400" />{entryDate === todayIso() ? "Today's check-in" : `Check-in for ${entryDate}`}
            </span>
            <label className="flex items-center gap-1.5 text-[10px] text-gray-500" title="Missed a day? Pick its date.">
              <CalendarDays className="h-3.5 w-3.5" />
              <input type="date" value={entryDate} max={todayIso()} onChange={e => e.target.value && setEntryDate(e.target.value)}
                className="bg-[#0B0E14] border border-[#1A202C] rounded-md px-2 py-1 text-[11px] text-gray-300 focus:border-blue-600 focus:outline-none [color-scheme:dark]" />
            </label>
          </div>

          {alreadyCheckedIn ? (
            <div className="bg-emerald-900/15 border border-emerald-700/30 rounded-xl p-4 text-[12px] text-emerald-200 mb-2">
              You already checked in for {entryDate}. Come back tomorrow, or pick a missed day above.
            </div>
          ) : (<>
            <label className="block text-[11px] text-gray-400 mb-2">How was your day?</label>
            <textarea value={journal} onChange={e => setJournal(e.target.value)} maxLength={5000}
              placeholder="A few sentences about how you felt, what happened, how you slept…"
              className="w-full h-28 resize-none bg-[#0B0E14] border border-[#1A202C] rounded-xl p-3 text-[13px] text-gray-200 placeholder-gray-600 focus:border-blue-600 focus:outline-none mb-1" />
            <div className="text-[10px] text-gray-600 mb-4 text-right">{journal.trim() ? journal.trim().split(/\s+/).length : 0} words</div>

            <div className="mb-5">
              <label className="flex items-center gap-1.5 text-[11px] text-gray-400 mb-2"><Mic className="h-3.5 w-3.5" />Voice note <span className="text-gray-600">(optional, .wav — transcribed on this computer)</span></label>
              <div className="bg-[#0B0E14] border-2 border-dashed border-[#1A202C] hover:border-[#2A3040] rounded-xl p-3 text-center transition-colors cursor-pointer"
                onClick={() => audioRef.current?.click()}>
                <input ref={audioRef} type="file" accept=".wav" className="audio-file-input hidden"
                  onChange={e => setAudioFile(e.target.files?.[0] || null)} />
                {audioFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="h-4 w-4 text-blue-400" />
                    <span className="text-[11px] text-gray-300 truncate max-w-[220px]">{audioFile.name}</span>
                    <button onClick={ev => { ev.stopPropagation(); setAudioFile(null); if (audioRef.current) audioRef.current.value = ''; }} className="text-[10px] text-gray-500 hover:text-gray-300 cursor-pointer">remove</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-gray-600">
                    <Upload className="h-4 w-4" />
                    <span className="text-[11px]">Drop a .wav file or click to browse</span>
                  </div>
                )}
              </div>
            </div>

            <FunSlider label="How many hours did you sleep?" value={sliders.sleep_hours} max={12} step={0.5} showPct={false}
              onChange={v => setSliders({ ...sliders, sleep_hours: v })} />
            <FunSlider label="How well did you sleep?" value={sliders.sleep_quality}
              onChange={v => setSliders({ ...sliders, sleep_quality: v })} />
            <FunSlider label="How active were you today?" value={sliders.activity_level}
              onChange={v => setSliders({ ...sliders, activity_level: v })} />
            <FunSlider label="How would you describe your mood?" value={sliders.music_mood_score}
              onChange={v => setSliders({ ...sliders, music_mood_score: v })} />

            <button onClick={handleSubmit} disabled={submitting}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold uppercase tracking-wider px-6 py-3 rounded-xl transition-all disabled:opacity-40 cursor-pointer">
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {submitting ? (audioFile ? 'Transcribing & analysing…' : 'Analysing…') : 'Submit check-in'}
            </button>
          </>)}
          <Msg m={msg} />
        </div>
      )}

      {tab === 'import' && (
        <div className="bg-[#11131C]/80 backdrop-blur-sm border border-[#1A202C] rounded-2xl p-6" id="chat-import">
          <p className="text-[11px] text-gray-500 mb-4 leading-relaxed">
            Add your own messages from a chat export. Each message is merged into the day it was sent — on days you
            checked in it enriches that entry, other days become new entries. Files are read on this computer only.
          </p>
          <div className="flex gap-2 mb-3">
            {([
              { id: 'whatsapp' as const, label: 'WhatsApp', icon: MessageSquare, color: 'text-emerald-400', activeBg: 'bg-emerald-900/20 border-emerald-600/40' },
              { id: 'telegram' as const, label: 'Telegram', icon: Send, color: 'text-sky-400', activeBg: 'bg-sky-900/20 border-sky-600/40' },
              { id: 'reddit' as const, label: 'Reddit', icon: Globe, color: 'text-orange-400', activeBg: 'bg-orange-900/20 border-orange-600/40' },
            ]).map(({ id, label, icon: Icon, color, activeBg }) => (
              <button key={id} onClick={() => { setChatPlatform(id); setChatFile(null); setChatPreview([]); setChatSenders([]); setChatMsg(null); if (chatFileRef.current) chatFileRef.current.value = ''; }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                  chatPlatform === id ? `${activeBg} text-gray-200 border` : 'text-gray-500 hover:text-gray-400 border border-transparent hover:border-[#1A202C]'
                }`}>
                <Icon className={`h-3.5 w-3.5 ${chatPlatform === id ? color : ''}`} />
                {label}
              </button>
            ))}
          </div>

          <div className="text-[10px] text-gray-600 mb-3 leading-relaxed">
            {chatPlatform === 'whatsapp' && 'WhatsApp → open the chat → ⋮ → More → Export chat → Without media. Upload the .txt file.'}
            {chatPlatform === 'telegram' && 'Telegram Desktop → Settings → Advanced → Export Telegram data → format JSON. Upload result.json.'}
            {chatPlatform === 'reddit' && 'reddit.com/settings/data-request → download your data. Upload comments.csv or posts.csv (JSON also works).'}
          </div>

          {chatPlatform === 'reddit' && (
            <div className="flex gap-2 mb-3 ml-1">
              {(['comments', 'posts', 'text'] as const).map(s => (
                <button key={s} onClick={() => { setChatSubType(s); setChatFile(null); setChatPreview([]); }}
                  className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all cursor-pointer ${
                    chatSubType === s ? 'bg-[#1A202C] text-gray-300 border border-blue-600/30' : 'text-gray-600 hover:text-gray-400 border border-transparent'
                  }`}>
                  {s === 'text' ? 'Plain text' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          )}

          {chatPlatform !== 'reddit' && (
            <div className="mb-3">
              <label className="flex items-center gap-1.5 text-[11px] text-gray-500 mb-1.5"><UserRound className="h-3.5 w-3.5" />Your name as it appears in the chat</label>
              <input type="text" value={chatName} onChange={e => setChatName(e.target.value)}
                placeholder="e.g. Rohith"
                className="w-full bg-[#0B0E14] border border-[#1A202C] rounded-lg px-3 py-2 text-[12px] text-gray-300 placeholder-gray-600 focus:border-blue-600 focus:outline-none transition-colors" />
            </div>
          )}

          <div className="bg-[#0B0E14] border-2 border-dashed border-[#1A202C] hover:border-[#2A3040] rounded-xl p-4 text-center transition-colors mb-3 cursor-pointer"
            onClick={() => chatFileRef.current?.click()}>
            <input ref={chatFileRef} type="file" className="hidden chat-file-input"
              accept={chatPlatform === 'whatsapp' ? '.txt' : chatPlatform === 'telegram' ? '.json' : chatSubType === 'text' ? '.txt' : '.csv,.json'}
              onChange={e => { setChatFile(e.target.files?.[0] || null); setChatPreview([]); setChatMsg(null); }} />
            {chatFile ? (
              <div className="flex items-center justify-center gap-2">
                <FileText className="h-4 w-4 text-blue-400" />
                <span className="text-[11px] text-gray-300 truncate max-w-[220px]">{chatFile.name}</span>
                <span className="text-[10px] text-gray-600">({(chatFile.size / 1024).toFixed(1)} KB)</span>
              </div>
            ) : (
              <>
                <Upload className="h-5 w-5 text-gray-600 mx-auto mb-1" />
                <span className="text-[11px] text-gray-500">Drop file or click to browse</span>
              </>
            )}
          </div>

          <button onClick={() => handleChatParse(chatPlatform === 'reddit' ? 'me' : undefined)}
            disabled={chatParsing || !chatFile || (chatPlatform !== 'reddit' && !chatName.trim())}
            className="flex items-center gap-2 bg-[#1A202C] hover:bg-[#232B3B] text-gray-300 text-[11px] font-bold px-4 py-2 rounded-lg transition-all disabled:opacity-30 cursor-pointer mb-1">
            {chatParsing ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
            {chatParsing ? 'Reading…' : 'Preview my messages'}
          </button>

          {chatSenders.length > 0 && chatPreview.length === 0 && chatPlatform !== 'reddit' && (
            <div className="mt-3">
              <div className="text-[10px] text-gray-500 mb-1.5">People in this chat — which one is you?</div>
              <div className="flex flex-wrap gap-1.5">
                {chatSenders.slice(0, 12).map(s => (
                  <button key={s.name} onClick={() => { setChatName(s.name); handleChatParse(s.name); }}
                    className="px-2.5 py-1 rounded-md text-[11px] bg-[#0B0E14] border border-[#1A202C] text-gray-300 hover:border-blue-600 cursor-pointer">
                    {s.name} <span className="text-gray-600">· {s.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <Msg m={chatMsg} />

          {chatPreview.length > 0 && (
            <div className="bg-[#0B0E14] border border-[#1A202C] rounded-xl overflow-hidden mt-3">
              <div className="px-3 py-2 border-b border-[#1A202C] flex items-center justify-between">
                <span className="text-[11px] text-gray-400">
                  <Check className="inline h-3 w-3 text-emerald-400 mr-1" />
                  {chatPreview.filter(e => e.selected).length} of {chatPreview.length} selected
                </span>
                <button onClick={() => setChatPreview(prev => prev.map(e => ({ ...e, selected: !prev.every(p => p.selected) })))}
                  className="text-[10px] text-blue-400 hover:text-blue-300 cursor-pointer">
                  {chatPreview.every(e => e.selected) ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="max-h-56 overflow-y-auto">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-[#0B0E14]">
                    <tr className="text-gray-600">
                      <th className="text-left py-1.5 px-3 font-medium w-8"></th>
                      <th className="text-left py-1.5 pr-3 font-medium">Date</th>
                      <th className="text-left py-1.5 pr-3 font-medium">Goes into</th>
                      <th className="text-left py-1.5 font-medium">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chatPreview.map((e, i) => (
                      <tr key={i} className="border-t border-[#1A202C]/60 hover:bg-[#11131C]/50">
                        <td className="py-1.5 px-3">
                          <input type="checkbox" checked={e.selected}
                            onChange={() => setChatPreview(prev => prev.map((p, j) => j === i ? { ...p, selected: !p.selected } : p))}
                            className="accent-blue-500" />
                        </td>
                        <td className="py-1.5 pr-3 text-gray-400 whitespace-nowrap">{e.date}</td>
                        <td className="py-1.5 pr-3 whitespace-nowrap">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] ${e.matched ? 'bg-blue-900/30 text-blue-300' : 'bg-violet-900/30 text-violet-300'}`}>
                            {e.matched ? 'that day’s check-in' : 'new day'}
                          </span>
                        </td>
                        <td className="py-1.5 text-gray-400 truncate max-w-[260px]" title={e.message}>{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-3 py-2 border-t border-[#1A202C] flex justify-end">
                <button onClick={handleChatImport} disabled={chatParsing}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold px-4 py-1.5 rounded-lg transition-all disabled:opacity-40 cursor-pointer">
                  {chatParsing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                  {chatParsing ? 'Importing & analysing…' : 'Import selected'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'data' && (
        <div className="space-y-4" id="my-data">
          <PatientTelemetry status={status} narrow />
          <div className="bg-[#11131C]/80 backdrop-blur-sm border border-[#1A202C] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[10px] tracking-widest text-gray-500 font-bold uppercase">Your entries (what the AI analyses)</div>
              <button onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 text-[10px] text-rose-400 hover:text-rose-300 cursor-pointer bg-rose-900/10 hover:bg-rose-900/20 border border-rose-800/30 rounded-lg px-2.5 py-1.5 transition-all">
                <Trash2 className="h-3 w-3" />Clear all data
              </button>
            </div>
            {showDeleteConfirm && (
              <div className="mb-4 bg-rose-900/15 border border-rose-700/30 rounded-xl p-4 flex items-center justify-between">
                <span className="text-xs text-rose-200">Delete all your entries and calibration data from this computer?</span>
                <div className="flex gap-2">
                  <button onClick={() => setShowDeleteConfirm(false)} className="text-[11px] text-gray-400 hover:text-gray-200 px-3 py-1.5 rounded-lg bg-[#1A202C] cursor-pointer">Cancel</button>
                  <button onClick={handleDelete} className="text-[11px] text-white bg-rose-600 hover:bg-rose-500 px-3 py-1.5 rounded-lg cursor-pointer">Delete</button>
                </div>
              </div>
            )}
            {status?.history && status.history.length > 0 ? (
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-[#11131C]">
                    <tr className="text-gray-600 border-b border-[#1A202C]">
                      <th className="text-left py-2 pr-3 font-medium">Date</th>
                      <th className="text-left py-2 pr-3 font-medium">Sources</th>
                      <th className="text-left py-2 pr-3 font-medium">Sleep</th>
                      <th className="text-left py-2 pr-3 font-medium">Mood</th>
                      <th className="text-left py-2 font-medium">Analysed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.history.map(e => (
                      <tr key={e.id} className="border-b border-[#1A202C]/60 hover:bg-[#0B0E14]/50">
                        <td className="py-2 pr-3 text-gray-300 whitespace-nowrap">{e.entry_date}</td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap gap-1">
                            {(e.sources || []).map(s => <span key={s} className="px-1.5 py-0.5 rounded text-[9px] bg-[#0B0E14] border border-[#1A202C] text-gray-400">{s}</span>)}
                            {e.has_audio && !(e.sources || []).includes('voice') && <span className="px-1.5 py-0.5 rounded text-[9px] bg-[#0B0E14] border border-[#1A202C] text-fuchsia-300">voice</span>}
                          </div>
                        </td>
                        <td className="py-2 pr-3 text-gray-400">{e.sleep_hours != null ? `${e.sleep_hours}h` : '—'}</td>
                        <td className="py-2 pr-3 text-gray-400">{e.music_mood_score != null ? `${Math.round(e.music_mood_score * 100)}%` : '—'}</td>
                        <td className="py-2"><span className={`px-1.5 py-0.5 rounded text-[10px] ${e.features_extracted ? 'text-emerald-400 bg-emerald-900/20' : 'text-gray-600 bg-gray-800/20'}`}>{e.features_extracted ? 'yes' : 'pending'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-10 text-gray-600 text-[12px]">No entries yet — start with today's check-in.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
