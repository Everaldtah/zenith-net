// Signed-in launcher: title bar tabs, game library, social panel, forums tab, presence, party launches, self-update.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { zenith } from '../lib/bridge';
import { useGames, useSocial } from '../lib/hooks';
import { bytes, newer } from '../lib/format';
import { sb } from '../lib/sb';
import type { Party, Profile } from '../lib/types';
import { Avatar, TitleBar } from './bits';
import { FriendsPanel } from './Friends';
import { GameRail, GameView, keyOf } from './Library';
import { SettingsModal } from './Settings';
import { WebTab, resetWebHandoff } from './Web';

type Status = 'online' | 'away' | 'busy';
interface Toast { id: number; text: string; tone: 'info' | 'error' | 'ok'; action?: [string, () => void] }

export function Shell({ session, profile }: { session: Session; profile: Profile }) {
  const { catalog, error, status, jobs, reload, clearJob } = useGames();
  const { social, refresh } = useSocial(session.user.id);
  const [tab, setTab] = useState<'games' | 'web'>('games');
  const [webPath, setWebPath] = useState('/forums');
  const [webOpened, setWebOpened] = useState(false);
  const [selected, setSelected] = useState(() => localStorage.getItem('selectedGame') ?? '');
  const [myStatus, setMyStatusState] = useState<Status>(() => (localStorage.getItem('status') as Status) ?? 'online');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [version, setVersion] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [updating, setUpdating] = useState<number | null>(null);
  const playing = useRef<{ game: string; edition: string } | null>(null);
  const me = social?.me ?? profile;

  const toast = useCallback((text: string, tone: Toast['tone'] = 'info', action?: Toast['action']) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t.slice(-3), { id, text, tone, action }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), action ? 15000 : 6000);
  }, []);
  const notify = (title: string, body: string) => { if (!document.hasFocus()) new Notification(title, { body, silent: false }).onclick = () => zenith.win.show(); };

  useEffect(() => { zenith.info().then(i => setVersion(i.version)); }, []);

  const games = catalog?.games ?? [];
  const game = games.find(g => g.slug === selected) ?? games[0];
  const select = (slug: string) => { setSelected(slug); localStorage.setItem('selectedGame', slug); setTab('games'); };
  const openWeb = useCallback((p: string) => { setWebPath(p); setWebOpened(true); setTab('web'); }, []);

  // ---- presence: heartbeat every 2 minutes, plus on every change
  const beat = useCallback(() => {
    sb.rpc('set_presence', { p_status: myStatus, p_game: playing.current?.game ?? null, p_edition: playing.current?.edition ?? null }).then(() => undefined);
  }, [myStatus]);
  useEffect(() => { beat(); const t = setInterval(beat, 120_000); return () => clearInterval(t); }, [beat]);
  const setMyStatus = (s: Status) => { setMyStatusState(s); localStorage.setItem('status', s); };

  useEffect(() => zenith.onQuitting(async () => {
    await Promise.race([sb.rpc('set_presence', { p_status: 'offline' }), new Promise(r => setTimeout(r, 1200))]);
    zenith.readyToQuit();
  }), []);

  useEffect(() => {
    const offStart = zenith.games.onStarted(({ key }) => {
      const [g, e] = key.split('/');
      playing.current = { game: g, edition: e };
      beat();
    });
    const offExit = zenith.games.onExited(({ key, seconds }) => {
      const [g] = key.split('/');
      playing.current = null;
      beat();
      sb.rpc('report_playtime', { p_game: g, p_seconds: seconds }).then(() => undefined);
    });
    return () => { offStart(); offExit(); };
  }, [beat]);

  // ---- launching
  const args = useCallback((party?: { id: string; seq: number; role: 'host' | 'member' }) => {
    const a = [`--zenith-user=${me.username}#${me.tag}`, '--zenith-launcher=1'];
    if (party) a.push(`--zenith-party=${party.id}:${party.seq}`, `--zenith-role=${party.role}`);
    return a;
  }, [me.username, me.tag]);

  const play = async (key: string) => {
    try { await zenith.games.launch(key, args()); } catch (e) { toast((e as Error).message, 'error'); }
  };

  const playTogether = async (key: string) => {
    const party = social?.party;
    if (!party) return;
    const [g, e] = key.split('/');
    const { data: seq, error } = await sb.rpc('party_launch', { p_game: g, p_edition: e });
    if (error) return toast(error.message, 'error');
    lastLaunch.current = { party: party.id, seq: seq as number };
    try { await zenith.games.launch(key, args({ id: party.id, seq: seq as number, role: 'host' })); } catch (err) { toast((err as Error).message, 'error'); }
    toast(`Starting ${games.find(x => x.slug === g)?.name} for your party`, 'ok');
  };

  // members: follow the leader when "Play together" bumps launch_seq
  const lastLaunch = useRef<{ party: string; seq: number } | null>(null);
  useEffect(() => {
    const p: Party | null = social?.party ?? null;
    if (!p) { lastLaunch.current = null; return; }
    if (!lastLaunch.current || lastLaunch.current.party !== p.id) { lastLaunch.current = { party: p.id, seq: p.launch_seq }; return; }
    if (p.launch_seq <= lastLaunch.current.seq) return;
    lastLaunch.current = { party: p.id, seq: p.launch_seq };
    if (p.leader_id === me.id || !p.game || !p.edition) return;
    const g = games.find(x => x.slug === p.game);
    const key = `${p.game}/${p.edition}`;
    const name = g?.editions.find(e => e.edition === p.edition)?.name ?? p.game;
    if (status[key]?.installed) {
      zenith.games.launch(key, args({ id: p.id, seq: p.launch_seq, role: 'member' })).catch(err => toast(err.message, 'error'));
      toast(`Your party is starting ${name}. Joining…`, 'ok');
      notify('Joining your party', name);
    } else {
      toast(`Your party is playing ${name}. Install it to join.`, 'info', ['Install', () => { select(p.game!); zenith.games.install(key); }]);
      notify('Your party started a game', `Install ${name} to join`);
    }
  }, [social?.party?.launch_seq, social?.party?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- toasts for new invites and friend requests
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!social) return;
    const ids = new Set([...social.invites.map(i => `inv:${i.party_id}`), ...social.incoming.map(r => `req:${r.id}`)]);
    if (seen.current) {
      for (const i of social.invites) if (!seen.current.has(`inv:${i.party_id}`)) { toast(`${i.username} invited you to a party`, 'info'); notify('Party invite', `${i.username} invited you to their party`); }
      for (const r of social.incoming) if (!seen.current.has(`req:${r.id}`)) { toast(`${r.username}#${r.tag} sent you a friend request`); notify('Friend request', `${r.username}#${r.tag} wants to be friends`); }
    }
    seen.current = ids;
  }, [social]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- zenithnet:// links
  useEffect(() => {
    const handle = (link: string) => {
      const u = new URL(link);
      const parts = (u.host + u.pathname).split('/').filter(Boolean);
      if (parts[0] === 'game' && parts[1]) select(parts[1]);
      else if (parts[0] === 'forums') openWeb('/' + parts.join('/'));
    };
    zenith.info().then(i => i.link && handle(i.link));
    return zenith.onDeepLink(handle);
  }, [openWeb]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- launcher self-update
  const launcherUpdate = catalog?.launcher && version && newer(catalog.launcher.version, version) ? catalog.launcher : null;
  useEffect(() => zenith.launcher.onProgress(p => setUpdating(p.total ? p.received / p.total : 0)), []);
  const runUpdate = async () => {
    setUpdating(0);
    try { await zenith.launcher.update(launcherUpdate!); } catch (e) { setUpdating(null); toast((e as Error).message, 'error'); }
  };

  const signOut = async () => {
    await sb.rpc('set_presence', { p_status: 'offline' });
    await zenith.auth.clearWeb();
    resetWebHandoff();
    await sb.auth.signOut();
  };

  const tabBtn = (t: 'games' | 'web', label: string, onClick?: () => void) => (
    <button onClick={onClick ?? (() => setTab(t))}
      className={`no-drag relative px-4 font-display text-[13px] font-semibold uppercase tracking-[0.15em] transition ${tab === t ? 'text-ink' : 'text-muted hover:text-ink'}`}>
      {label}{tab === t && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent" />}
    </button>
  );

  return (
    <div className="flex h-full flex-col">
      <TitleBar>
        {tabBtn('games', 'Games')}
        {tabBtn('web', 'Forums', () => openWeb(webOpened ? webPath : '/forums'))}
        <div className="flex-1" />
        <button onClick={() => openWeb(`/u/${encodeURIComponent(`${me.username}-${me.tag}`)}`)} className="no-drag flex items-center gap-2 px-3 hover:bg-panel-2">
          <Avatar id={me.avatar} size={24} /><span className="text-sm font-semibold">{me.username}</span>
        </button>
        <button onClick={() => setSettingsOpen(true)} className="no-drag grid w-11 place-items-center text-muted hover:bg-panel-2 hover:text-ink" aria-label="Settings">
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      </TitleBar>

      {launcherUpdate && (
        <div className="flex items-center gap-3 border-b border-accent/30 bg-accent/10 px-4 py-2 text-sm">
          <span>Launcher update {launcherUpdate.version} is ready ({bytes(launcherUpdate.size)}).</span>
          {updating === null
            ? <button onClick={runUpdate} className="btn btn-primary py-1 text-xs">Update and restart</button>
            : <span className="text-muted">Downloading {Math.round(updating * 100)}%… the launcher restarts by itself.</span>}
        </div>
      )}
      {catalog?.offline && <div className="border-b border-warn/30 bg-warn/10 px-4 py-1.5 text-xs text-warn">Offline: showing your installed games. Friends and installs come back when you reconnect.</div>}

      <div className="flex min-h-0 flex-1">
        {tab === 'games' && (
          !catalog ? (
            <div className="grid flex-1 place-items-center text-center text-muted">
              {error ? <div><p>Couldn&apos;t reach Zenith.net: {error}</p><button onClick={reload} className="btn mt-4">Try again</button></div> : <p>Loading your library…</p>}
            </div>
          ) : (
            <>
              <GameRail games={games} selected={game?.slug ?? ''} onSelect={select} status={status} />
              {game && (
                <GameView game={game} status={status} jobs={jobs} offline={!!catalog.offline} party={social?.party ?? null}
                  isLeader={social?.party?.leader_id === me.id} onPlay={play} onPlayTogether={playTogether} onClearJob={clearJob} onOpenWeb={openWeb} />
              )}
            </>
          )
        )}
        {webOpened && <WebTab path={webPath} visible={tab === 'web'} />}
        <FriendsPanel social={social} games={games} myStatus={myStatus} setMyStatus={setMyStatus} refresh={refresh} toast={toast}
          onProfile={p => openWeb(`/u/${encodeURIComponent(`${p.username}-${p.tag}`)}`)} />
      </div>

      <div className="pointer-events-none fixed right-4 top-14 z-40 flex w-80 flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className={`anim-in pointer-events-auto rounded-lg border p-3 text-sm shadow-2xl backdrop-blur ${t.tone === 'error' ? 'border-bad/50 bg-[#2a0f17]/95' : t.tone === 'ok' ? 'border-ok/40 bg-[#0c2119]/95' : 'border-line bg-panel/95'}`}>
            <div className="flex items-start gap-2">
              <span className="flex-1">{t.text}</span>
              <button onClick={() => setToasts(x => x.filter(y => y.id !== t.id))} className="text-muted hover:text-ink" aria-label="Dismiss">✕</button>
            </div>
            {t.action && <button onClick={() => { t.action![1](); setToasts(x => x.filter(y => y.id !== t.id)); }} className="btn btn-primary mt-2 py-1 text-xs">{t.action[0]}</button>}
          </div>
        ))}
      </div>

      {settingsOpen && <SettingsModal email={session.user.email ?? ''} version={version} onClose={() => setSettingsOpen(false)} onSignOut={signOut} />}
    </div>
  );
}

export { keyOf };
