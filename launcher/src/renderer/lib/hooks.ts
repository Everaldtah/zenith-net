import { useCallback, useEffect, useRef, useState } from 'react';
import { zenith } from './bridge';
import { sb } from './sb';
import type { Catalog, EditionStatus, JobEvent, Social } from './types';

export function useGames() {
  const [catalog, setCatalog] = useState<(Catalog & { offline?: boolean }) | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<Record<string, EditionStatus>>({});
  const [jobs, setJobs] = useState<Record<string, JobEvent>>({});

  const refreshStatus = useCallback(async () => { setStatus(await zenith.games.status()); }, []);
  const load = useCallback(async () => {
    try {
      setCatalog(await zenith.catalog());
      setError('');
      await refreshStatus();
    } catch (e) {
      setError((e as Error).message);
    }
  }, [refreshStatus]);

  useEffect(() => {
    load();
    const t = setInterval(load, 10 * 60_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const offs = [
      zenith.games.onJob(ev => {
        setJobs(j => ({ ...j, [ev.key]: ev }));
        if (ev.phase === 'done' || ev.phase === 'error' || ev.phase === 'cancelled') refreshStatus();
      }),
      zenith.games.onStarted(refreshStatus),
      zenith.games.onExited(refreshStatus),
    ];
    window.addEventListener('focus', refreshStatus);
    return () => { offs.forEach(o => o()); window.removeEventListener('focus', refreshStatus); };
  }, [refreshStatus]);

  const clearJob = useCallback((key: string) => setJobs(j => { const n = { ...j }; delete n[key]; return n; }), []);
  return { catalog, error, status, jobs, reload: load, refreshStatus, clearJob };
}

/** Friends, requests, party and invites: one RPC, refetched whenever Realtime says something relevant changed. */
export function useSocial(uid: string) {
  const [social, setSocial] = useState<Social | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const fetchNow = useCallback(async () => {
    const { data, error } = await sb.rpc('my_social');
    if (!error && data) setSocial(data as Social);
  }, []);
  const refresh = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = window.setTimeout(fetchNow, 350);
  }, [fetchNow]);

  useEffect(() => {
    fetchNow();
    let ch = sb.channel(`social:${uid}`);
    for (const table of ['presence', 'friend_requests', 'friendships', 'parties', 'party_members', 'party_invites']) {
      ch = ch.on('postgres_changes', { event: '*', schema: 'public', table }, refresh);
    }
    ch.subscribe();
    const poll = setInterval(fetchNow, 60_000);                // deletes aren't always delivered; this catches up
    return () => { sb.removeChannel(ch); clearInterval(poll); clearTimeout(timer.current); };
  }, [uid, fetchNow, refresh]);

  return { social, refresh: fetchNow };
}
