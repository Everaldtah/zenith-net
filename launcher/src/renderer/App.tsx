import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { sb } from './lib/sb';
import type { Profile } from './lib/types';
import { AuthScreen, UsernameScreen } from './ui/Auth';
import { LogoMark, TitleBar } from './ui/bits';
import { Shell } from './ui/Shell';

// signed out -> sign-in screen; signed in without a username -> pick one; otherwise the launcher
export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const uid = session?.user.id;

  useEffect(() => {
    sb.auth.getSession().then(async ({ data }) => {
      // a saved session for an account that no longer exists (deleted, or a different database): start signed out
      if (data.session) {
        const { error } = await sb.auth.getUser();
        if (error && (error.status === 401 || error.status === 403 || /not.*found|does not exist/i.test(error.message))) {
          await sb.auth.signOut({ scope: 'local' });
          setSession(null);
          return;
        }
      }
      setSession(data.session);
    });
    const { data } = sb.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const loadProfile = async (id: string) => {
    const { data } = await sb.from('profiles').select('*').eq('id', id).maybeSingle();
    setProfile((data as Profile) ?? null);
  };
  useEffect(() => {
    if (!uid) { setProfile(null); return; }
    setProfile(undefined);
    loadProfile(uid);
  }, [uid]);

  let body: React.ReactNode;
  if (session === undefined || (session && profile === undefined)) {
    body = <div className="grid flex-1 place-items-center"><LogoMark className="h-14 w-14 animate-pulse" /></div>;
  } else if (!session) {
    body = <AuthScreen />;
  } else if (!profile) {
    body = <UsernameScreen email={session.user.email ?? ''} onDone={() => loadProfile(session.user.id)} />;
  } else {
    return <Shell key={session.user.id} session={session} profile={profile} />;
  }
  return <div className="flex h-full flex-col"><TitleBar />{body}</div>;
}
