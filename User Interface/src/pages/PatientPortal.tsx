import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, Upload, FileText, Settings, MessageSquare, Hash, AtSign } from 'lucide-react';
import NeuralBackground from '../NeuralBackground';

interface DailyStatus {
  entry_count: number;
  entries_needed: number;
  calibrated: boolean;
  calibration_progress: string;
  progress_pct: number;
  history: HistoryEntry[];
}

interface HistoryEntry {
  id: number;
  entry_date: string;
  has_text: boolean;
  has_audio: boolean;
  sleep_hours: number | null;
  sleep_quality: number | null;
  activity_level: number | null;
  music_mood_score: number | null;
  features_extracted: boolean;
}

const BASE = '/api';
const MIN_ENTRIES = 14;

export default function PatientPortal() {
  const userId = localStorage.getItem('userId') || 'rohith_ms';
  const nav = useNavigate();
  const [status, setStatus] = useState<DailyStatus | null>(null);
  const [tab, setTab] = useState<'submit' | 'history'>('submit');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
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

  useEffect(() => { refresh(); }, []);

  async function refresh() {
    try {
      const r = await fetch(`${BASE}/daily/status?user_id=${encodeURIComponent(userId)}`);
      const d = await r.json();
      setStatus(d);
    } catch { /* ignore */ }
  }

  async function handleSubmit() {
    if (!journalFile && !audioFile) { setMsg('Upload a journal file or audio recording.'); return; }
    setLoading(true);
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
      const r = await fetch(`${BASE}/daily/submit`, { method: 'POST', body: fd });
      const d = await r.json();
      if (d.error) { setMsg(d.error); } else {
        setMsg(`Saved for ${d.entry_date}`);
        setJournalFile(null);
        setAudioFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        refresh();
      }
    } catch (e: any) { setMsg('Error: ' + e.message); } finally { setLoading(false); }
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
      const r = await fetch(`${BASE}/daily/import-chat`, { method: 'POST', body: fd });
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

  const count = status?.entry_count || 0;
  const calibrated = status?.calibrated || false;
  const pct = calibrated ? 100 : Math.min(100, Math.round((count / MIN_ENTRIES) * 100));

  return (
    <div className="min-h-screen bg-[#06080C] relative">
      <NeuralBackground />

      <div className="relative z-10">
        <header className="h-14 border-b border-[#1A202C]/60 flex items-center justify-between px-6 bg-[#0B0E14]/80">
          <div className="flex items-center gap-3">
            <Activity className="h-4 w-4 text-blue-400" />
            <h1 className="text-sm font-bold tracking-widest text-gray-200 uppercase">Daily Alignment Portal</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-gray-500">{userId}</span>
            <button
              onClick={() => nav('/')}
              className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-300 cursor-pointer bg-[#1A202C]/50 hover:bg-[#232B3B]/50 rounded-lg px-3 py-1.5 transition-all"
            >
              <Settings className="h-3 w-3" />
              Patient Profile Settings
            </button>
          </div>
        </header>

        <div className="max-w-2xl mx-auto p-6">
          {/* Calibration progress */}
          <div className="bg-[#11131C]/80 backdrop-blur-sm border border-[#1A202C] rounded-2xl p-6 mb-5">
            <div className="text-[10px] tracking-widest text-gray-500 font-bold uppercase mb-3">Calibration Progress</div>
            <div className="flex items-center gap-4 mb-2">
              <div className="flex-1 h-2 bg-[#1A202C] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${calibrated ? 'bg-emerald-500' : 'bg-blue-500'}`}
                  style={{ width: pct + '%' }}
                />
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {calibrated ? 'Baseline active' : count > 0 ? `${count} entries recorded` : ''}
              </span>
            </div>
            <p className="text-[11px] text-gray-500">
              {calibrated
                ? `Your baseline is calibrated with ${count} entries. Keep submitting to improve accuracy.`
                : count >= MIN_ENTRIES
                  ? `Minimum baseline entries reached (${count}). Ready for calibration! Additional entries improve accuracy.`
                  : `Building your baseline — ${count} of at least ${MIN_ENTRIES} entries submitted.`}
            </p>
          </div>

          {calibrated && (
            <div className="bg-[#11131C]/80 backdrop-blur-sm border border-emerald-900/40 rounded-2xl p-5 mb-5 flex items-center gap-4">
              <span className="flex-1 text-sm text-gray-200">
                <strong className="text-emerald-400">Baseline Calibrated</strong> &mdash; your personal model is active. Keep submitting to strengthen it.
              </span>
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
              <div className="text-[10px] tracking-widest text-gray-500 font-bold uppercase mb-5">Today's Check-In</div>

              {/* File upload for journal */}
              <div className="mb-5">
                <label className="block text-[11px] text-gray-500 mb-2">Journal Entry (upload a file)</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-[#0B0E14] border border-dashed border-[#1A202C] rounded-xl px-4 py-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-gray-600 transition-colors"
                >
                  <Upload className="h-5 w-5 text-gray-500" />
                  <span className="text-xs text-gray-500">
                    {journalFile ? journalFile.name : 'Drop your journal file here or click to browse'}
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.doc,.docx,.pdf"
                  onChange={e => setJournalFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </div>

              {/* Audio upload */}
              <div className="mb-5">
                <label className="block text-[11px] text-gray-500 mb-2">Audio Recording (.wav)</label>
                <input type="file" accept=".wav" onChange={e => setAudioFile(e.target.files?.[0] || null)}
                  className="text-[12px] text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[11px] file:font-bold file:bg-[#1A202C] file:text-gray-300 hover:file:bg-[#232B3B] cursor-pointer" />
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

                {/* Platform tabs */}
                <div className="flex gap-2 mb-3">
                  {(['whatsapp', 'telegram', 'reddit'] as const).map(p => (
                    <button key={p} onClick={() => { setChatPlatform(p); setChatFile(null); setChatPreview([]); if (chatFileRef.current) chatFileRef.current.value = ''; }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                        chatPlatform === p ? 'bg-[#1A202C] text-gray-200 border border-blue-600/40' : 'text-gray-500 hover:text-gray-400 border border-transparent'
                      }`}>
                      {p === 'whatsapp' && <MessageSquare className="h-3 w-3" />}
                      {p === 'telegram' && <AtSign className="h-3 w-3" />}
                      {p === 'reddit' && <Hash className="h-3 w-3" />}
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Reddit sub-type selector */}
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

                {/* File upload */}
                <div className="flex items-center gap-3 mb-3">
                  <input ref={chatFileRef} type="file"
                    accept={chatPlatform === 'whatsapp' ? '.txt' : chatPlatform === 'telegram' ? '.json' : chatSubType === 'posts' || chatSubType === 'comments' ? '.csv,.json' : '.txt'}
                    onChange={e => setChatFile(e.target.files?.[0] || null)}
                    className="text-[12px] text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-[#1A202C] file:text-gray-300 hover:file:bg-[#232B3B] cursor-pointer" />
                  {chatFile && <span className="text-[11px] text-gray-400 truncate max-w-[200px]">{chatFile.name}</span>}
                </div>

                <button onClick={handleChatParse} disabled={chatParsing || !chatFile || !chatName.trim()}
                  className="bg-[#1A202C] hover:bg-[#232B3B] text-gray-300 text-[11px] font-bold px-4 py-2 rounded-lg transition-all disabled:opacity-30 cursor-pointer mb-3">
                  {chatParsing ? 'Parsing...' : 'Parse & Preview'}
                </button>

                {/* Preview table */}
                {chatPreview.length > 0 && (
                  <div className="bg-[#0B0E14] border border-[#1A202C] rounded-xl overflow-hidden">
                    <div className="px-3 py-2 border-b border-[#1A202C] flex items-center justify-between">
                      <span className="text-[11px] text-gray-400">Preview ({chatPreview.filter(e => e.selected).length} selected)</span>
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
                              <td className="py-1.5 pr-3"><span className="px-1.5 py-0.5 rounded text-[9px] bg-[#1A202C] text-gray-400">{e.platform}</span></td>
                              <td className="py-1.5 text-gray-400 truncate max-w-[250px]">{e.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="px-3 py-2 border-t border-[#1A202C] flex justify-end">
                      <button onClick={handleChatImport} disabled={chatParsing}
                        className="bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold px-4 py-1.5 rounded-lg transition-all disabled:opacity-40 cursor-pointer">
                        Import Selected
                      </button>
                    </div>
                  </div>
                )}

                {chatMsg && <p className="mt-2 text-[11px] text-gray-500">{chatMsg}</p>}
              </div>

              {/* Natural language prompts */}
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="text-[11px] text-gray-400 mb-2 flex justify-between">
                    <span>How many hours did you sleep yesterday?</span>
                    <span className="text-gray-300 font-mono">{sliders.sleep_hours}h</span>
                  </label>
                  <input type="range" min={0} max={12} step={0.5}
                    value={sliders.sleep_hours}
                    onChange={e => setSliders({ ...sliders, sleep_hours: parseFloat(e.target.value) })}
                    className="w-full accent-blue-500" />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 mb-2 flex justify-between">
                    <span>How well did you sleep last night?</span>
                    <span className="text-gray-300 font-mono">{Math.round(sliders.sleep_quality * 100)}%</span>
                  </label>
                  <input type="range" min={0} max={1} step={0.05}
                    value={sliders.sleep_quality}
                    onChange={e => setSliders({ ...sliders, sleep_quality: parseFloat(e.target.value) })}
                    className="w-full accent-blue-500" />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 mb-2 flex justify-between">
                    <span>How active were you today?</span>
                    <span className="text-gray-300 font-mono">{Math.round(sliders.activity_level * 100)}%</span>
                  </label>
                  <input type="range" min={0} max={1} step={0.05}
                    value={sliders.activity_level}
                    onChange={e => setSliders({ ...sliders, activity_level: parseFloat(e.target.value) })}
                    className="w-full accent-blue-500" />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 mb-2 flex justify-between">
                    <span>How would you describe your mood today?</span>
                    <span className="text-gray-300 font-mono">{Math.round(sliders.music_mood_score * 100)}%</span>
                  </label>
                  <input type="range" min={0} max={1} step={0.05}
                    value={sliders.music_mood_score}
                    onChange={e => setSliders({ ...sliders, music_mood_score: parseFloat(e.target.value) })}
                    className="w-full accent-blue-500" />
                </div>
              </div>

              <button onClick={handleSubmit} disabled={loading}
                className="bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold uppercase tracking-wider px-6 py-3 rounded-xl transition-all disabled:opacity-40 cursor-pointer">
                {loading ? 'Submitting...' : "Submit Today's Entry"}
              </button>
              {msg && <p className="mt-3 text-[11px] text-gray-400">{msg}</p>}
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
                      <th className="text-left py-2 pr-3 font-medium">Quality</th>
                      <th className="text-left py-2 font-medium">Extracted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.history.map((e: HistoryEntry) => (
                      <tr key={e.id} className="border-b border-[#1A202C]/60 hover:bg-[#0B0E14]/50">
                        <td className="py-2.5 pr-3 text-gray-300">{e.entry_date}</td>
                        <td className="py-2.5 pr-3"><span className={`px-1.5 py-0.5 rounded text-[10px] ${e.has_text ? 'text-emerald-400 bg-emerald-900/20' : 'text-gray-600 bg-gray-800/20'}`}>{e.has_text ? 'yes' : 'no'}</span></td>
                        <td className="py-2.5 pr-3"><span className={`px-1.5 py-0.5 rounded text-[10px] ${e.has_audio ? 'text-emerald-400 bg-emerald-900/20' : 'text-gray-600 bg-gray-800/20'}`}>{e.has_audio ? 'yes' : 'no'}</span></td>
                        <td className="py-2.5 pr-3 text-gray-400">{e.sleep_hours ?? '—'}</td>
                        <td className="py-2.5 pr-3 text-gray-400">{e.sleep_quality?.toFixed(2) ?? '—'}</td>
                        <td className="py-2.5"><span className={`px-1.5 py-0.5 rounded text-[10px] ${e.features_extracted ? 'text-emerald-400 bg-emerald-900/20' : 'text-gray-600 bg-gray-800/20'}`}>{e.features_extracted ? 'yes' : 'no'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-10 text-gray-600 text-[12px]">No entries yet. Start submitting daily!</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
