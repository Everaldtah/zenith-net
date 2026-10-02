import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/safe';

// Token-hash sign-ins: links from emails, and the launcher's one-time handoff into its Forums tab (embed=1).
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const tokenHash = url.searchParams.get('token_hash');
  const type = (url.searchParams.get('type') ?? 'email') as EmailOtpType;
  const embed = url.searchParams.get('embed') === '1';
  const next = safeNext(url.searchParams.get('next'));

  let dest = '/login?error=' + encodeURIComponent('That link has expired. Sign in again.');
  if (tokenHash) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) dest = type === 'recovery' ? '/reset' : next;
  }
  const res = NextResponse.redirect(new URL(dest, url.origin));
  if (embed) res.cookies.set('zn_embed', '1', { path: '/', sameSite: 'lax', secure: url.protocol === 'https:', httpOnly: false, maxAge: 60 * 60 * 24 * 365 });
  return res;
}
