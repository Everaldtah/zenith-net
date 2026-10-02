import { useEffect, useState } from 'react';
import { zenith } from '../lib/bridge';

export const SITE = import.meta.env.VITE_SITE_URL.replace(/\/$/, '');

export function LogoMark({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs><linearGradient id="zg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5fb0ff" /><stop offset="1" stopColor="#8b5cf6" /></linearGradient></defs>
      <circle cx="16" cy="16" r="14.5" fill="none" stroke="url(#zg)" strokeWidth="2" />
      <path d="M16 3.5 19 13l9.5 3-9.5 3-3 9.5-3-9.5L3.5 16 13 13z" fill="url(#zg)" />
    </svg>
  );
}

export function Avatar({ id, size = 36, className = '' }: { id: string; size?: number; className?: string }) {
  return <img src={`${SITE}/avatars/${id}.webp`} alt="" width={size} height={size} draggable={false}
    className={`shrink-0 rounded-md border border-line bg-panel-2 object-cover ${className}`} style={{ width: size, height: size }} />;
}

export const STATUS_DOT: Record<string, string> = { online: 'bg-ok', away: 'bg-warn', busy: 'bg-bad', offline: 'bg-muted/40', ingame: 'bg-accent' };

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'ok'; children: React.ReactNode }) {
  const c = tone === 'error' ? 'border-bad/40 bg-bad/10 text-[#ffb4c1]' : tone === 'ok' ? 'border-ok/40 bg-ok/10 text-[#a7f3d0]' : 'border-accent/40 bg-accent/10 text-[#bcdcff]';
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-md border px-3 py-2 text-sm ${c}`}>{children}</div>;
}

/** Window title bar for the frameless window: drag area + minimise / maximise / close. */
export function TitleBar({ children }: { children?: React.ReactNode }) {
  const [max, setMax] = useState(false);
  useEffect(() => zenith.win.onMaximized(setMax), []);
  const b = 'no-drag grid h-full w-12 place-items-center text-muted hover:bg-panel-2 hover:text-ink';
  return (
    <div className="drag flex h-11 shrink-0 items-stretch border-b border-line bg-[#05070c]">
      <div className="flex items-center gap-2 pl-4 pr-6">
        <LogoMark className="h-5 w-5" />
        <span className="font-display text-sm font-bold tracking-[0.2em]">ZENITH<span className="text-accent">.NET</span></span>
      </div>
      <div className="flex min-w-0 flex-1 items-stretch">{children}</div>
      <button className={b} onClick={() => zenith.win.minimize()} aria-label="Minimise"><svg width="10" height="10"><path d="M0 5h10" stroke="currentColor" /></svg></button>
      <button className={b} onClick={() => zenith.win.maximize()} aria-label={max ? 'Restore' : 'Maximise'}>
        {max ? <svg width="10" height="10"><path d="M2 0h8v8M0 2h8v8H0z" fill="none" stroke="currentColor" /></svg> : <svg width="10" height="10"><rect x=".5" y=".5" width="9" height="9" fill="none" stroke="currentColor" /></svg>}
      </button>
      <button className={`${b} hover:!bg-bad hover:!text-white`} onClick={() => zenith.win.close()} aria-label="Close"><svg width="10" height="10"><path d="M0 0l10 10M10 0 0 10" stroke="currentColor" /></svg></button>
    </div>
  );
}

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
