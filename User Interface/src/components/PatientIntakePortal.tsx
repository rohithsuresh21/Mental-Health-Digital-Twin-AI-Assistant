import { useState, useRef, useEffect } from 'react';
import { Upload, Activity, Trash2, MessageSquare, Send, Globe, Check, Loader2, FileText } from 'lucide-react';
import { usePatientData, PatientStatus } from '../hooks/usePatientData';

const BASE = '/api';
const MIN_ENTRIES = 14;

function calColor(count: number, calibrated: boolean): string {
  if (calibrated) return '#10b981';
  if (count <= 5) return '#ef4444';
  if (count <= 9) return '#eab308';
  if (count <= 13) return '#f97316';
  return '#10b981';
}

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

export default function PatientIntakePortal({ userId, onCalibrated, onNavigateToAnalysis }: { userId: string; onCalibrated?: () => void; onNavigateToAnalysis?: () => void }) {
  const { status, loading, refresh, deleteData } = usePatientData(userId);
  const [tab, setTab] = useState<'submit' | 'history'>('submit');
  const [msg, setMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [journalFile, setJournalFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [sliders, setSliders] = useState({
    sleep_hours: 7,
    sleep_quality: 0.7,
    activity_level: 0.6,
    music_mood_score: 0.5,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chat import state
  const [chatName, setChatName] = useState('');
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [chatPlatform, setChatPlatform] = useState<'whatsapp' | 'telegram' | 'reddit'>('whatsapp');
  const [chatSubType, setChatSubType] = useState<'posts' | 'comments' | 'text'>('text');
  const [chatPreview, setChatPreview] = useState<{ date: string; platform: string; message: string; selected: boolean; matched: boolean }[]>([]);
  const [chatParsing, setChatParsing] = useState(false);
  const [chatMsg, setChatMsg] = useState('');
  const chatFileRef = useRef<HTMLInputElement>(null);

  const count = status?.entry_count || 0;
  const calibrated = status?.calibrated || false;
  const pct = calibrated ? 100 : Math.min(100, Math.round((count / MIN_ENTRIES) * 100));
  const color = calColor(count, calibrated);
  const [showCalibrationChoice, setShowCalibrationChoice] = useState(false);

  useEffect(() => {
    if (calibrated) {
      onCalibrated?.();
      setShowCalibrationChoice(true);
    }
  }, [calibrated]);

  async function handleSubmit() {
    setSubmitting(true);
    setMsg('');
    const fd = new FormData();
    fd.append('user_id', userId);
    fd.append('sleep_hours', String(sliders.sleep_hours));
    fd.append('sleep_quality', String(sliders.sleep_quality));
    fd.append('activity_level', String(sliders.activity_level));
    fd.append('music_mood_score', String(sliders.music_mood_score));
    if (journalFile) fd.append('text', journalFile, journalFile.name);
    if (audioFile) fd.append('audio', audioFile);
    try {
      const r = await fetch(`${BASE}/daily/submit`, { method: 'POST', body: fd, credentials: 'include' });
      const d = await r.json();
      if (d.error) { setMsg(d.error); } else {
        setMsg(`Saved for ${d.entry_date}`);
        setJournalFile(null);
        setAudioFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        refresh();
      }
    } catch (e: any) { setMsg('Error: ' + e.message); } finally { setSubmitting(false); }
  }

  async function handleDelete() {
    const ok = await deleteData();
    if (ok) setMsg('All data cleared.');
    setShowDeleteConfirm(false);
  }

  async function handleChatParse() {
    if (!chatFile || !chatName.trim()) { setChatMsg('Enter your name and select a file.'); return; }
    setChatParsing(true);
    setChatMsg('');
    setChatPreview([]);
    const fd = new FormData();
    fd.append('user_id', userId);
    fd.append('name', chatName.trim());
    fd.append('platform', chatPlatform);
    fd.append('sub_type', chatSubType);
    fd.append('file', chatFile);
    try {
      const r = await fetch(`${BASE}/daily/import-chat`, { method: 'POST', body: fd, credentials: 'include' });
      const d = await r.json();
      if (d.error) { setChatMsg(d.error); } else {
        setChatPreview(d.entries.map((e: any) => ({ ...e, selected: e.matched })));
        setChatMsg(`${d.entries.length} entries parsed, ${d.matched_count} matched your daily entries.`);
      }
    } catch (e: any) { setChatMsg('Error: ' + e.message); } finally { setChatParsing(false); }
  }

  async function handleChatImport() {
    const selected = chatPreview.filter(e => e.selected);
    if (selected.length === 0) { setChatMsg('No entries selected.'); return; }
    setChatParsing(true);
    try {
      const r = await fetch(`${BASE}/daily/confirm-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user_id: userId, entries: selected }),
      });
      const d = await r.json();
      if (d.error) { setChatMsg(d.error); } else {
        setChatMsg(`Imported ${d.imported} entries.`);
        setChatPreview([]);
        setChatFile(null);
        if (chatFileRef.current) chatFileRef.current.value = '';
        refresh();
      }
    } catch (e: any) { setChatMsg('Error: ' + e.message); } finally { setChatParsing(false); }
  }

  if (loading) {
    return <div className="text-center py-16 text-gray-500 text-sm">Loading patient data...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Calibration progress bar */}
      <div className="bg-[#11131C]/80 backdrop-blur-sm border border-[#1A202C] rounded-2xl p-6 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] tracking-widest text-gray-500 font-bold uppercase">Calibration Progress</div>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-1.5 text-[10px] text-rose-400 hover:text-rose-300 cursor-pointer bg-rose-900/10 hover:bg-rose-900/20 border border-rose-800/30 rounded-lg px-2.5 py-1.5 transition-all"
          >
            <Trash2 className="h-3 w-3" />
            Clear All Data
          </button>
        </div>
        {showDeleteConfirm && (
          <div className="mb-4 bg-rose-900/15 border border-rose-700/30 rounded-xl p-4 flex items-center justify-between">
            <span className="text-xs text-rose-200">Delete all your entries and calibration data?</span>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteConfirm(false)} className="text-[11px] text-gray-400 hover:text-gray-200 px-3 py-1.5 rounded-lg bg-[#1A202C] cursor-pointer">Cancel</button>
              <button onClick={handleDelete} className="text-[11px] text-white bg-rose-600 hover:bg-rose-500 px-3 py-1.5 rounded-lg cursor-pointer">Delete</button>
            </div>
          </div>
        )}
        <div className="flex items-center gap-4 mb-2">
          <div className="flex-1 h-2.5 bg-[#1A202C] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: pct + '%', backgroundColor: color, boxShadow: `0 0 10px ${color}40` }}
            />
          </div>
          <span className="text-xs text-gray-400 whitespace-nowrap font-mono">{count}/{MIN_ENTRIES}</span>
        </div>
        <p className="text-[11px] text-gray-500">
          {calibrated
            ? `Baseline calibrated with ${count} entries.`
            : `${count} of ${MIN_ENTRIES} minimum entries for baseline calibration.`}
        </p>
      </div>

      {calibrated && (
        <div className="bg-emerald-900/15 backdrop-blur-sm border border-emerald-700/30 rounded-2xl p-4 mb-5 flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981] shrink-0" />
          <span className="text-sm text-emerald-200">
            <strong>Baseline Calibrated</strong> — your personal model is active.
          </span>
        </div>
      )}

      {showCalibrationChoice && (
        <div className="bg-[#0F1729] border border-blue-500/30 rounded-2xl p-5 mb-5">
          <p className="text-sm text-gray-300 mb-4 text-center">
            Your baseline is ready with <strong>{count} entries</strong>. What would you like to do?
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => setShowCalibrationChoice(false)}
              className="bg-[#1A202C] hover:bg-[#232B3B] text-gray-300 text-[11px] font-bold uppercase tracking-wider px-5 py-3 rounded-xl transition-all cursor-pointer">
              Continue Calibration
            </button>
            <button onClick={() => onNavigateToAnalysis?.()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold uppercase tracking-wider px-5 py-3 rounded-xl transition-all cursor-pointer">
              Analyze Now
            </button>
          </div>
          <p className="text-[10px] text-gray-500 text-center mt-3">
            "Continue Calibration" keeps improving accuracy. "Analyze Now" shows your current insights.
          </p>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-[#1A202C] mb-5">
        {(['submit', 'history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider cursor-pointer border-b-2 transition-all ${
              tab === t ? 'text-blue-400 border-blue-500' : 'text-gray-600 border-transparent hover:text-gray-400'
            }`}>
            {t === 'submit' ? 'Submit Entry' : 'History'}
          </button>
        ))}
      </div>

      {tab === 'submit' && (
        <div className="bg-[#11131C]/80 backdrop-blur-sm border border-[#1A202C] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Activity className="h-4 w-4 text-blue-400" />
            <span className="text-[10px] tracking-widest text-gray-500 font-bold uppercase">Today's Check-In</span>
          </div>

          {/* Import from Chat History */}
          <div className="border-t border-[#1A202C] pt-5 mb-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-px flex-1 bg-[#1A202C]" />
              <span className="text-[10px] tracking-widest text-gray-500 font-bold uppercase">Import from Chat History</span>
              <div className="h-px flex-1 bg-[#1A202C]" />
            </div>

            <div className="mb-4">
              <label className="block text-[11px] text-gray-500 mb-1.5">Your Name (to filter messages)</label>
              <input type="text" value={chatName} onChange={e => setChatName(e.target.value)}
                placeholder="e.g. Rohith"
                className="w-full bg-[#0B0E14] border border-[#1A202C] rounded-lg px-3 py-2 text-[12px] text-gray-300 placeholder-gray-600 focus:border-blue-600 focus:outline-none transition-colors" />
            </div>

            <div className="flex gap-2 mb-3">
              {([
                { id: 'whatsapp' as const, label: 'WhatsApp', icon: MessageSquare, color: 'text-emerald-400', activeBg: 'bg-emerald-900/20 border-emerald-600/40' },
                { id: 'telegram' as const, label: 'Telegram', icon: Send, color: 'text-sky-400', activeBg: 'bg-sky-900/20 border-sky-600/40' },
                { id: 'reddit' as const, label: 'Reddit', icon: Globe, color: 'text-orange-400', activeBg: 'bg-orange-900/20 border-orange-600/40' },
              ]).map(({ id, label, icon: Icon, color, activeBg }) => (
                <button key={id} onClick={() => { setChatPlatform(id); setChatFile(null); setChatPreview([]); if (chatFileRef.current) chatFileRef.current.value = ''; }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                    chatPlatform === id ? `${activeBg} text-gray-200 border` : 'text-gray-500 hover:text-gray-400 border border-transparent hover:border-[#1A202C]'
                  }`}>
                  <Icon className={`h-3.5 w-3.5 ${chatPlatform === id ? color : ''}`} />
                  {label}
                </button>
              ))}
            </div>

            {chatPlatform === 'reddit' && (
              <div className="flex gap-2 mb-3 ml-1">
                {(['posts', 'comments', 'text'] as const).map(s => (
                  <button key={s} onClick={() => { setChatSubType(s); setChatFile(null); setChatPreview([]); }}
                    className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all cursor-pointer ${
                      chatSubType === s ? 'bg-[#1A202C] text-gray-300 border border-blue-600/30' : 'text-gray-600 hover:text-gray-400 border border-transparent'
                    }`}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            )}

            <div className="bg-[#0B0E14] border-2 border-dashed border-[#1A202C] hover:border-[#2A3040] rounded-xl p-4 text-center transition-colors mb-3 cursor-pointer relative"
              onClick={() => chatFileRef.current?.click()}>
              <input ref={chatFileRef} type="file" className="hidden"
                accept={chatPlatform === 'whatsapp' ? '.txt' : chatPlatform === 'telegram' ? '.json' : chatSubType === 'posts' || chatSubType === 'comments' ? '.csv,.json' : '.txt'}
                onChange={e => setChatFile(e.target.files?.[0] || null)} />
              {chatFile ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="h-4 w-4 text-blue-400" />
                  <span className="text-[11px] text-gray-300 truncate max-w-[200px]">{chatFile.name}</span>
                  <span className="text-[10px] text-gray-600">({(chatFile.size / 1024).toFixed(1)} KB)</span>
                </div>
              ) : (
                <>
                  <Upload className="h-5 w-5 text-gray-600 mx-auto mb-1" />
                  <span className="text-[11px] text-gray-500">Drop file or click to browse</span>
                  <span className="block text-[10px] text-gray-600 mt-0.5">
                    {chatPlatform === 'whatsapp' ? '.txt export from WhatsApp' : chatPlatform === 'telegram' ? '.json export from Telegram' : 'posts/comments JSON or CSV'}
                  </span>
                </>
              )}
            </div>

            <button onClick={handleChatParse} disabled={chatParsing || !chatFile || !chatName.trim()}
              className="flex items-center gap-2 bg-[#1A202C] hover:bg-[#232B3B] text-gray-300 text-[11px] font-bold px-4 py-2 rounded-lg transition-all disabled:opacity-30 cursor-pointer mb-3">
              {chatParsing ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
              {chatParsing ? 'Parsing...' : 'Parse & Preview'}
            </button>

            {chatPreview.length > 0 && (
              <div className="bg-[#0B0E14] border border-[#1A202C] rounded-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-[#1A202C] flex items-center justify-between">
                  <span className="text-[11px] text-gray-400">
                    <Check className="inline h-3 w-3 text-emerald-400 mr-1" />
                    {chatPreview.filter(e => e.selected).length} of {chatPreview.length} entries selected
                  </span>
                  <button onClick={() => setChatPreview(prev => prev.map(e => ({ ...e, selected: !prev.some(p => !p.selected) })))}
                    className="text-[10px] text-blue-400 hover:text-blue-300 cursor-pointer">
                    {chatPreview.every(e => e.selected) ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-[11px]">
                    <thead className="sticky top-0 bg-[#0B0E14]">
                      <tr className="text-gray-600">
                        <th className="text-left py-1.5 px-3 font-medium w-8"></th>
                        <th className="text-left py-1.5 pr-3 font-medium">Date</th>
                        <th className="text-left py-1.5 pr-3 font-medium">Platform</th>
                        <th className="text-left py-1.5 font-medium">Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chatPreview.map((e, i) => (
                        <tr key={i} className={`border-t border-[#1A202C]/60 ${e.matched ? 'hover:bg-[#11131C]/50' : 'opacity-50'}`}>
                          <td className="py-1.5 px-3">
                            <input type="checkbox" checked={e.selected} disabled={!e.matched}
                              onChange={() => setChatPreview(prev => prev.map((p, j) => j === i ? { ...p, selected: !p.selected } : p))}
                              className="accent-blue-500" />
                          </td>
                          <td className="py-1.5 pr-3 text-gray-400 whitespace-nowrap">{e.date}</td>
                          <td className="py-1.5 pr-3"><span className={`px-1.5 py-0.5 rounded text-[9px] ${
                            e.platform === 'whatsapp' ? 'bg-emerald-900/30 text-emerald-400' :
                            e.platform === 'telegram' ? 'bg-sky-900/30 text-sky-400' :
                            'bg-orange-900/30 text-orange-400'
                          }`}>{e.platform}</span></td>
                          <td className="py-1.5 text-gray-400 truncate max-w-[250px]">{e.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-3 py-2 border-t border-[#1A202C] flex justify-end">
                  <button onClick={handleChatImport} disabled={chatParsing}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold px-4 py-1.5 rounded-lg transition-all disabled:opacity-40 cursor-pointer">
                    <Upload className="h-3 w-3" />
                    Import Selected
                  </button>
                </div>
              </div>
            )}

            {chatMsg && <p className="mt-2 text-[11px] text-gray-500">{chatMsg}</p>}
          </div>

          <div className="mb-5">
            <label className="block text-[11px] text-gray-500 mb-2">Audio Recording (.wav/.csv)</label>
            <div className="bg-[#0B0E14] border-2 border-dashed border-[#1A202C] hover:border-[#2A3040] rounded-xl p-3 text-center transition-colors cursor-pointer relative"
              onClick={() => document.querySelector<HTMLInputElement>('.audio-file-input')?.click()}>
              <input type="file" accept=".wav,.csv" className="audio-file-input hidden"
                onChange={e => setAudioFile(e.target.files?.[0] || null)} />
              {audioFile ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="h-4 w-4 text-blue-400" />
                  <span className="text-[11px] text-gray-300 truncate max-w-[200px]">{audioFile.name}</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-gray-600">
                  <Upload className="h-4 w-4" />
                  <span className="text-[11px]">Drop audio file or click to browse</span>
                </div>
              )}
            </div>
          </div>

          <FunSlider label="How many hours did you sleep?"
            value={sliders.sleep_hours} max={12} step={0.5} showPct={false}
            onChange={v => setSliders({ ...sliders, sleep_hours: v })} />

          <FunSlider label="How well did you sleep?"
            value={sliders.sleep_quality}
            onChange={v => setSliders({ ...sliders, sleep_quality: v })} />

          <FunSlider label="How active were you today?"
            value={sliders.activity_level}
            onChange={v => setSliders({ ...sliders, activity_level: v })} />

          <FunSlider label="How would you describe your mood?"
            value={sliders.music_mood_score}
            onChange={v => setSliders({ ...sliders, music_mood_score: v })} />

          <button onClick={handleSubmit} disabled={submitting}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold uppercase tracking-wider px-6 py-3 rounded-xl transition-all disabled:opacity-40 cursor-pointer">
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {submitting ? 'Submitting...' : "Submit Today's Entry"}
          </button>
          {msg && <p className={`mt-3 text-[11px] ${msg.includes('Error') || msg.includes('error') ? 'text-red-400' : 'text-emerald-400'}`}>{msg}</p>}
        </div>
      )}

      {tab === 'history' && (
        <div className="bg-[#11131C]/80 backdrop-blur-sm border border-[#1A202C] rounded-2xl p-6">
          <div className="text-[10px] tracking-widest text-gray-500 font-bold uppercase mb-5">Entry History</div>
          {status?.history && status.history.length > 0 ? (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-gray-600 border-b border-[#1A202C]">
                  <th className="text-left py-2 pr-3 font-medium">Date</th>
                  <th className="text-left py-2 pr-3 font-medium">Text</th>
                  <th className="text-left py-2 pr-3 font-medium">Audio</th>
                  <th className="text-left py-2 pr-3 font-medium">Sleep</th>
                  <th className="text-left py-2 font-medium">Extracted</th>
                </tr>
              </thead>
              <tbody>
                {status.history.map((e: any) => (
                  <tr key={e.id} className="border-b border-[#1A202C]/60 hover:bg-[#0B0E14]/50">
                    <td className="py-2.5 pr-3 text-gray-300">{e.entry_date}</td>
                    <td className="py-2.5 pr-3"><span className={`px-1.5 py-0.5 rounded text-[10px] ${e.has_text ? 'text-emerald-400 bg-emerald-900/20' : 'text-gray-600 bg-gray-800/20'}`}>{e.has_text ? 'yes' : 'no'}</span></td>
                    <td className="py-2.5 pr-3"><span className={`px-1.5 py-0.5 rounded text-[10px] ${e.has_audio ? 'text-emerald-400 bg-emerald-900/20' : 'text-gray-600 bg-gray-800/20'}`}>{e.has_audio ? 'yes' : 'no'}</span></td>
                    <td className="py-2.5 pr-3 text-gray-400">{e.sleep_hours ?? '—'}</td>
                    <td className="py-2.5"><span className={`px-1.5 py-0.5 rounded text-[10px] ${e.features_extracted ? 'text-emerald-400 bg-emerald-900/20' : 'text-gray-600 bg-gray-800/20'}`}>{e.features_extracted ? 'yes' : 'no'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-10 text-gray-600 text-[12px]">No entries yet.</div>
          )}
        </div>
      )}
    </div>
  );
}
