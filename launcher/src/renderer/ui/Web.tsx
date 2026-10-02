// The Forums tab: the website's forum and profile pages inside the launcher, signed in through a one-time handoff link.
import { useEffect, useRef, useState } from 'react';
import { zenith } from '../lib/bridge';
import { sb } from '../lib/sb';
import { SITE } from './bits';

interface WebviewEl extends HTMLElement { loadURL(url: string): Promise<void>; canGoBack(): boolean; goBack(): void; reload(): void; getURL(): string }

let handedOff = false;   // once per launcher run; the web view keeps its own session after that

export function WebTab({ path, visible }: { path: string; visible: boolean }) {
  const ref = useRef<WebviewEl | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  // first load: sign the web view in, then open the requested page
  useEffect(() => {
    if (src) return;
    (async () => {
      if (!handedOff) {
        const { data } = await sb.auth.getSession();
        if (data.session) {
          try {
            setSrc(await zenith.auth.handoff(data.session.access_token, path));
            handedOff = true;
            return;
          } catch { /* fall through: open the page signed out */ }
        }
      }
      setSrc(SITE + path);
    })();
  }, [src, path]);

  // later navigation requests (e.g. "Game forums" from the library)
  useEffect(() => {
    const el = ref.current;
    if (el && ready && src && !el.getURL().endsWith(path)) el.loadURL(SITE + path).catch(() => undefined);
  }, [path, ready, src]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const start = () => setLoading(true);
    const stop = () => setLoading(false);
    const domReady = () => setReady(true);
    el.addEventListener('did-start-loading', start);
    el.addEventListener('did-stop-loading', stop);
    el.addEventListener('dom-ready', domReady);
    return () => { el.removeEventListener('did-start-loading', start); el.removeEventListener('did-stop-loading', stop); el.removeEventListener('dom-ready', domReady); };
  }, [src]);

  const nav = (p: string) => ref.current?.loadURL(SITE + p).catch(() => undefined);
  return (
    <div className={`${visible ? 'flex' : 'hidden'} min-w-0 flex-1 flex-col`}>
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-line bg-[#090c13] px-3 text-sm">
        <button onClick={() => ref.current?.canGoBack() && ref.current.goBack()} className="rounded-md px-2 py-1 text-muted hover:bg-panel-2 hover:text-ink" aria-label="Back">←</button>
        <button onClick={() => ref.current?.reload()} className="rounded-md px-2 py-1 text-muted hover:bg-panel-2 hover:text-ink" aria-label="Reload">⟳</button>
        <span className="mx-2 h-4 w-px bg-line" />
        {[['/forums', 'All forums'], ['/forums/zenith-umbra-bugs', 'ZU bugs'], ['/forums/nebula-dominion-bugs', 'Nebula bugs'], ['/forums/zenith-lfg', 'Looking for group'], ['/friends', 'Friends'], ['/settings', 'Profile settings']]
          .map(([p, l]) => <button key={p} onClick={() => nav(p)} className="rounded-md px-2.5 py-1 text-muted hover:bg-panel-2 hover:text-ink">{l}</button>)}
        <button onClick={() => zenith.openExternal(ref.current?.getURL() ?? SITE)} className="ml-auto rounded-md px-2 py-1 text-xs text-muted hover:text-ink">Open in browser ↗</button>
      </div>
      <div className="relative flex-1">
        {loading && <div className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden"><div className="progress-stripes h-full w-full bg-accent" /></div>}
        {src && <webview ref={ref as never} src={src} partition="persist:zenithweb" className="h-full w-full" style={{ display: 'flex' }} />}
      </div>
    </div>
  );
}

export const resetWebHandoff = () => { handedOff = false; };
