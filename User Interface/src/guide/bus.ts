// Tiny event bus so the Guide can drive the app (switch pages, scroll, highlight, focus a day)
export type Tab = 'analytics' | 'explainable' | 'forecast' | 'intake' | 'clinical' | 'profile' | 'dashboard';
export type NavAction = {
  tab: Tab;
  target?: string;            // data-guide="..." element to scroll to and highlight
  intakeTab?: 'submit' | 'import' | 'data';
  day?: number;               // index into timestamps to focus on the Results timeline
  row?: string;               // waterfall row key to expand on the Why page
  label?: string;             // human label for the "Show me" button
};

export const navigate = (a: NavAction) => window.dispatchEvent(new CustomEvent<NavAction>('mhdt:navigate', { detail: a }));
export const ask = (q: string) => window.dispatchEvent(new CustomEvent<string>('mhdt:ask', { detail: q }));

export function onEvent<T>(name: string, fn: (d: T) => void) {
  const h = (e: Event) => fn((e as CustomEvent<T>).detail);
  window.addEventListener(name, h);
  return () => window.removeEventListener(name, h);
}

/* scroll to + pulse-highlight a [data-guide] element once it exists */
export function spotlight(target: string, tries = 20) {
  const el = document.querySelector<HTMLElement>(`[data-guide="${target}"]`);
  if (!el) { if (tries > 0) setTimeout(() => spotlight(target, tries - 1), 120); return; }
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.remove('guide-spot'); void el.offsetWidth; el.classList.add('guide-spot');
  setTimeout(() => el.classList.remove('guide-spot'), 2600);
}
