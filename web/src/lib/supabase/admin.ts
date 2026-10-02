import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, serviceKey } from '@/lib/env';

/** Service-role client: bypasses row level security. Only for trusted server code (launcher handoff, counters). */
export function adminClient() {
  return createClient(SUPABASE_URL, serviceKey(), { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Anonymous client with no cookies, for public reads that can be cached. */
export function publicClient() {
  return createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
