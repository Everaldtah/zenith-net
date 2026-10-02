import { createClient } from '@supabase/supabase-js';

// The launcher keeps its own Supabase session (localStorage of the launcher window). PKCE so Google sign-in can come
// back through the loopback redirect.
export const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'zenith-auth' },
  realtime: { params: { eventsPerSecond: 5 } },
});
