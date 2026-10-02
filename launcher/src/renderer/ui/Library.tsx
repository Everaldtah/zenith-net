import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { zenith } from '../lib/bridge';
import { bytes, eta, newer, speed } from '../lib/format';
import type { EditionStatus, Game, JobEvent, Party } from '../lib/types';
import { Notice } from './bits';

export const keyOf = (g: Game, edition: string) => `${g.slug}/${edition}`;
const ACTIVE = new Set(['download', 'verify', 'install', 'uninstall']);

export function GameRail({ games, selected, onSelect, status }: {
  games: Game[]; selected: string; onSelect: (slug: string) => void; status: Record<string, EditionStatus>;
}) {
  return (
    <nav className="flex w-60 shrink-0 flex-col gap-1 overflow-y-auto border-r border-line bg-[#090c13] p-3">
      <div className="px-2 pb-2 pt-1 font-display text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Games</div>
      {games.map(g => {
        const installed = g.editions.some(e => status[keyOf(g, e.edition)]?.installed);
        const running = g.editions.some(e => status[keyOf(g, e.edition)]?.running);
        const update = g.editions.some(e => {
          const s = status[keyOf(g, e.edition)];
          return s?.installed && s.version && e.latest && newer(e.latest.version, s.version);
        });
        const on = g.slug === selected;
        return (
          <button key={g.slug} onClick={() => onSelect(g.slug)}
            className={`flex items-center gap-3 rounded-lg p-2 text-left transition ${on ? 'bg-panel-2 ring-1 ring-line' : 'hover:bg-panel'}`}>
            <img src={g.art.icon} alt="" className="h-10 w-10 rounded-lg" draggable={false} />
            <div className="min-w-0">
              <div className={`truncate text-sm font-semibold ${on ? 'text-ink' : 'text-[#c3c9d8]'}`}>{g.name}</div>
              <div className={`text-[11px] ${running ? 'text-ok' : update ? 'text-accent' : 'text-muted'}`}>
                {running ? 'Playing' : update ? 'Update available' : installed ? 'Installed' : 'Not installed'}
              </div>
            </div>
          </button>
        );
      })}
    </nav>
  );
}

function Progress({ job, onCancel }: { job: JobEvent; onCancel: () => void }) {
  const pct = job.total ? Math.min(100, ((job.received ?? 0) / job.total) * 100) : 0;
  const label = job.phase === 'download' ? `Downloading ${pct.toFixed(0)}%`
    : job.phase === 'verify' ? 'Checking the download…'
    : job.phase === 'install' ? 'Installing…'
    : job.phase === 'uninstall' ? 'Uninstalling…' : '';
  return (
    <div className="w-full max-w-md">
      <div className="mb-2 flex items-baseline justify-between text-sm">
        <span className="font-semibold">{label}</span>
        {job.phase === 'download' && job.total ? (
          <span className="text-xs text-muted">{bytes(job.received ?? 0)} of {bytes(job.total)} · {speed(job.speed ?? 0)} · {eta(job.total - (job.received ?? 0), job.speed ?? 0)}</span>
        ) : null}
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#0a0e16] ring-1 ring-line">
        {job.phase === 'download'
          ? <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-[width] duration-300" style={{ width: `${pct}%` }} />
          : <div className="progress-stripes h-full w-full bg-accent/70" />}
      </div>
      {job.phase === 'download' && <button onClick={onCancel} className="mt-2 text-xs text-muted hover:text-ink">Pause (the download picks up where it stopped)</button>}
    </div>
  );
}

function GearMenu({ items }: { items: [string, () => void, boolean?][] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)} className="btn h-12 w-12 p-0" aria-label="Game options">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
      </button>
      {open && (
        <div className="absolute bottom-14 left-0 z-20 w-56 rounded-lg border border-line bg-panel p-1.5 shadow-2xl">
          {items.filter(i => i[2] !== false).map(([label, fn]) => (
            <button key={label} onClick={() => { setOpen(false); fn(); }} className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-panel-2">{label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export function GameView(props: {
  game: Game; status: Record<string, EditionStatus>; jobs: Record<string, JobEvent>; offline: boolean;
  party: Party | null; isLeader: boolean;
  onPlay: (key: string) => void; onPlayTogether: (key: string) => void; onClearJob: (key: string) => void;
  onOpenWeb: (path: string) => void;
}) {
  const { game: g, status, jobs } = props;
  const [edition, setEdition] = useState(() => localStorage.getItem(`edition:${g.slug}`) ?? g.editions[0]?.edition);
  const [confirmUninstall, setConfirmUninstall] = useState(false);
  const ed = g.editions.find(e => e.edition === edition) ?? g.editions[0];
  useEffect(() => { setEdition(localStorage.getItem(`edition:${g.slug}`) ?? g.editions[0]?.edition); setConfirmUninstall(false); }, [g.slug, g.editions]);
  if (!ed) return null;

  const key = keyOf(g, ed.edition);
  const st = status[key];
  const job = jobs[key];
  const busy = (job && ACTIVE.has(job.phase)) || (st?.busy && ACTIVE.has(st.busy));
  const latest = ed.latest;
  const needsUpdate = !!(st?.installed && st.version && latest && newer(latest.version, st.version));
  const pickEdition = (v: string) => { setEdition(v); localStorage.setItem(`edition:${g.slug}`, v); };
  const install = () => { props.onClearJob(key); zenith.games.install(key); };

  let main: React.ReactNode;
  if (busy && job) main = <Progress job={job} onCancel={() => zenith.games.cancel(key)} />;
  else if (busy) main = <Progress job={{ key, phase: st!.busy! }} onCancel={() => zenith.games.cancel(key)} />;
  else if (!st?.installed) {
    main = latest
      ? <button onClick={install} disabled={props.offline} className="btn btn-primary h-12 min-w-56 text-base">Install <span className="font-normal opacity-80">{bytes(latest.size)}</span></button>
      : <button disabled className="btn h-12 min-w-56 text-base">Coming soon</button>;
  } else if (st.running) {
    main = <button disabled className="btn h-12 min-w-56 border-ok/50 text-base text-ok !opacity-100">● Playing</button>;
  } else if (needsUpdate) {
    main = <button onClick={install} disabled={props.offline} className="btn btn-primary h-12 min-w-56 text-base">Update to {latest!.version}</button>;
  } else {
    main = <button onClick={() => props.onPlay(key)} className="btn btn-primary h-12 min-w-56 font-display text-lg tracking-[0.15em]">PLAY</button>;
  }

  const inParty = !!props.party && props.party.members.length > 1;
  return (
    <section className="relative flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="relative min-h-[380px] flex-1">
        <img src={g.art.banner} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/50 to-bg/0" />
        <div className="absolute inset-0 bg-gradient-to-r from-bg/80 via-bg/20 to-transparent" />
        <div className="absolute bottom-8 left-10 right-10">
          <div className="text-xs font-semibold uppercase tracking-[0.25em]" style={{ color: g.accent }}>{g.genre}</div>
          <h1 className="h-display mt-1 text-5xl drop-shadow-lg">{g.name}</h1>
          <p className="mt-2 max-w-xl text-[#c3c9d8]">{g.tagline}</p>
        </div>
      </div>

      <div className="border-t border-line bg-panel/80 px-10 py-6 backdrop-blur">
        {g.editions.length > 1 && (
          <div className="mb-4">
            <label className="label" htmlFor="edition">Game version</label>
            <select id="edition" value={ed.edition} onChange={e => pickEdition(e.target.value)} className="input w-80">
              {g.editions.map(e => <option key={e.edition} value={e.edition}>{e.name}</option>)}
            </select>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <GearMenu items={[
            ['Show in Explorer', () => zenith.openFolder(key), !!st?.installed],
            [`Reinstall / update to ${latest?.version ?? ''}`, install, !!(st?.installed && latest && !props.offline)],
            ['Locate an existing install', async () => { if (await zenith.games.locate(key)) props.onClearJob(key); }, !st?.installed],
            ['Uninstall', () => setConfirmUninstall(true), !!st?.installed && !st.running],
            ['Game forums', () => props.onOpenWeb(`/forums/${g.slug}-general`)],
            ['Report a bug', () => props.onOpenWeb(`/forums/${g.slug}-bugs/new`)],
            ['Play in browser', () => g.site_url && zenith.openExternal(g.site_url), !!g.site_url],
          ]} />
          {main}
          {inParty && ed.online && st?.installed && !st.running && !busy && (
            props.isLeader
              ? <button onClick={() => props.onPlayTogether(key)} className="btn h-12 border-accent-2/60 text-base text-[#cbb8ff] hover:border-accent-2">Play together ({props.party!.members.length})</button>
              : <span className="text-sm text-muted">In a party: the game starts for you when your party leader presses Play together.</span>
          )}
          {inParty && !ed.online && <span className="text-sm text-muted">This edition is single-player.</span>}
        </div>

        {confirmUninstall && (
          <div className="mt-4 flex items-center gap-3 text-sm">
            <span>Uninstall {ed.name}? Saves stored by the game are kept.</span>
            <button onClick={() => { setConfirmUninstall(false); zenith.games.uninstall(key); }} className="btn text-xs hover:border-bad hover:text-bad">Uninstall</button>
            <button onClick={() => setConfirmUninstall(false)} className="btn btn-ghost text-xs">Keep it</button>
          </div>
        )}
        {job?.phase === 'error' && (
          <div className="mt-4 max-w-xl"><Notice tone="error">{job.error} <button onClick={install} className="ml-2 underline">Try again</button></Notice></div>
        )}
        {props.offline && !st?.installed && <p className="mt-3 text-sm text-warn">You&apos;re offline. Installing needs an internet connection.</p>}

        <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-xs text-muted">
          {st?.installed && <span>Installed: {st.version ? `v${st.version}` : 'version unknown (installed outside the launcher)'}</span>}
          {latest && <span>Latest: v{latest.version}</span>}
          {st?.external && latest && !needsUpdate && <button onClick={install} className="text-accent hover:underline">Update to the launcher&apos;s v{latest.version}</button>}
        </div>
        {latest?.notes && (
          <div className="mt-5 max-w-3xl">
            <div className="label">What&apos;s new in {latest.version}</div>
            <div className="notes selectable text-sm text-[#c3c9d8]">
              <ReactMarkdown components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a> }}>{latest.notes}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
