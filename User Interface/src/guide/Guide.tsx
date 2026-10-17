import { useEffect, useRef, useState, Fragment } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MessageCircleQuestion, X, ArrowUp, MapPin, LifeBuoy } from 'lucide-react';
import { answer, STARTERS, type Ctx, type Reply } from './brain';
import { navigate, onEvent, type NavAction } from './bus';
import { C } from '../insights/theme';

type Msg = { id: number; role: 'user' | 'guide'; text: string; nav?: NavAction; chips?: string[]; kind?: Reply['kind'] };

/* **bold**, line breaks, and "• " bullets — nothing else, so text is always safe */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => {
        const parts = line.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
          p.startsWith('**') && p.endsWith('**') ? <strong key={j} className="font-semibold" style={{ color: C.text }}>{p.slice(2, -2)}</strong> : <Fragment key={j}>{p}</Fragment>);
        if (!line.trim()) return <div key={i} className="h-2" />;
        return <div key={i} className={line.startsWith('• ') || /^\d\. /.test(line) ? 'pl-3 -indent-3' : ''}>{parts}</div>;
      })}
    </>
  );
}

export default function Guide({ ctx, page }: { ctx: Ctx; page: string }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState('');
  const idRef = useRef(1);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ctxRef = useRef(ctx); ctxRef.current = ctx;

  const starters = page === 'explainable' ? STARTERS.explain : page === 'forecast' ? STARTERS.forecast
    : page === 'intake' ? STARTERS.intake : page === 'analytics' && ctx.raw ? STARTERS.results : STARTERS.other;

  const send = (text: string) => {
    const t = text.trim(); if (!t) return;
    const r = answer(t, ctxRef.current);
    setMsgs(m => [...m, { id: idRef.current++, role: 'user', text: t }, { id: idRef.current++, role: 'guide', ...r }]);
    setQ('');
    if (r.nav) setTimeout(() => navigate(r.nav!), 250);   // take the user there automatically
  };

  useEffect(() => onEvent<string>('mhdt:ask', question => { setOpen(true); setTimeout(() => send(question), 60); }), []);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }); }, [msgs, open]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 150); }, [open]);
  // on wide screens the open Guide docks beside the page (content reflows) so it never hides what it points at
  useEffect(() => {
    const apply = () => document.documentElement.classList.toggle('guide-docked', open && window.innerWidth >= 1100);
    apply(); window.addEventListener('resize', apply);
    return () => { window.removeEventListener('resize', apply); document.documentElement.classList.remove('guide-docked'); };
  }, [open]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);

  return (
    <div className="insights fixed bottom-5 right-5 z-[60]" id="guide">
      <AnimatePresence>
        {open && (
          <motion.section key="panel" role="dialog" aria-label="Guide"
            initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
            className="mb-3 flex w-[min(400px,calc(100vw-40px))] flex-col overflow-hidden rounded-2xl shadow-2xl"
            style={{ height: 'min(600px, calc(100vh - 120px))', background: C.surface, border: `1px solid ${C.line}` }}>
            <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${C.line}` }}>
              <div>
                <h2 className="font-serif text-[20px] leading-tight" style={{ color: C.text }}>Guide</h2>
                <p className="text-[12px]" style={{ color: C.muted }}>Answers from {ctx.isPatient ? 'your' : 'these'} results, worked out on this computer.</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close guide" className="rounded-lg p-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500/60" style={{ color: C.text2 }}>
                <X className="h-4 w-4" />
              </button>
            </header>

            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
              {msgs.length === 0 && (
                <div className="px-1 text-[14px] leading-relaxed" style={{ color: C.text2 }}>
                  Ask me what anything means, about a specific day, or how to do something. I'll explain in plain words and take you there.
                </div>
              )}
              {msgs.map(m => m.role === 'user' ? (
                <div key={m.id} className="ml-10 rounded-2xl rounded-br-md px-3.5 py-2 text-[14px]" style={{ background: '#1d2a44', color: C.text }}>{m.text}</div>
              ) : (
                <div key={m.id} className="mr-6">
                  <div className="rounded-2xl rounded-bl-md px-3.5 py-2.5 text-[14px] leading-relaxed"
                    style={{ background: m.kind === 'crisis' ? 'rgba(208,59,59,0.12)' : C.raised, color: C.text2, border: m.kind === 'crisis' ? '1px solid rgba(208,59,59,0.4)' : undefined }}>
                    {m.kind === 'crisis' && <LifeBuoy className="mb-1.5 h-4 w-4" style={{ color: C.critical }} />}
                    <Rich text={m.text} />
                  </div>
                  {(m.nav || m.chips) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.nav && (
                        <button onClick={() => navigate(m.nav!)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500/60"
                          style={{ background: 'rgba(57,135,229,0.14)', color: '#8fbaf3' }}>
                          <MapPin className="h-3 w-3" />{m.nav.label || 'Show me'}
                        </button>
                      )}
                      {m.chips?.map(c => (
                        <button key={c} onClick={() => send(c)} className="rounded-full px-2.5 py-1 text-[12px] cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500/60"
                          style={{ border: `1px solid ${C.line}`, color: C.text2 }}>{c}</button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {msgs.length === 0 && (
              <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                {starters.map(s => (
                  <button key={s} onClick={() => send(s)} className="rounded-full px-3 py-1.5 text-[12px] cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500/60"
                    style={{ border: `1px solid ${C.line}`, color: C.text }}>{s}</button>
                ))}
              </div>
            )}
            <form onSubmit={e => { e.preventDefault(); send(q); }} className="flex items-center gap-2 px-3 pb-3 pt-2" style={{ borderTop: `1px solid ${C.line}` }}>
              <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder='Ask, e.g. "how was Oct 10?"' aria-label="Ask the guide"
                className="h-10 flex-1 rounded-xl px-3 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                style={{ background: C.bg, color: C.text, border: `1px solid ${C.line}` }} />
              <button type="submit" aria-label="Send" disabled={!q.trim()} className="grid h-10 w-10 place-items-center rounded-xl cursor-pointer disabled:opacity-40"
                style={{ background: '#2a6fd0', color: 'white' }}>
                <ArrowUp className="h-4 w-4" />
              </button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
      <div className="flex justify-end">
        <button onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls="guide" id="guide-toggle"
          className="inline-flex h-12 items-center gap-2 rounded-full pl-4 pr-5 text-[14px] font-medium shadow-xl cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-400"
          style={{ background: open ? C.raised : '#2a6fd0', color: 'white', border: `1px solid ${open ? C.line : '#3b82f6'}` }}>
          {open ? <X className="h-5 w-5" /> : <MessageCircleQuestion className="h-5 w-5" />}
          {open ? 'Close' : 'Ask the guide'}
        </button>
      </div>
    </div>
  );
}

/* small "What's this?" link that opens the Guide with a question */
export function AskLink({ q, label = "What's this?" }: { q: string; label?: string }) {
  return (
    <button onClick={() => window.dispatchEvent(new CustomEvent('mhdt:ask', { detail: q }))}
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] cursor-pointer align-middle focus-visible:ring-2 focus-visible:ring-blue-500/60"
      style={{ color: '#8fbaf3', background: 'rgba(57,135,229,0.10)' }}>
      <MessageCircleQuestion className="h-3.5 w-3.5" />{label}
    </button>
  );
}
