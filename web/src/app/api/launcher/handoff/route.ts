import { NextResponse, type NextRequest } from 'next/server';
import { adminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/redis';
import { safeNext } from '@/lib/safe';

// The launcher is signed in with its own session. To open the forums inside the launcher already signed in, it trades
// its access token for a one-time sign-in link: the embedded web view opens it and gets a session of its own
// (sharing one refresh token between two apps would make each log the other out).
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'missing token' }, { status: 401 });

  const admin = adminClient();
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user?.email) return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  if (!(await rateLimit('handoff', user.id, 20, 600)).ok) return NextResponse.json({ error: 'slow down' }, { status: 429 });

  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: user.email });
  if (error || !data.properties?.hashed_token) return NextResponse.json({ error: error?.message ?? 'no link' }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const next = safeNext(body?.next, '/forums');
  const url = new URL('/auth/confirm', req.nextUrl.origin);
  url.searchParams.set('token_hash', data.properties.hashed_token);
  url.searchParams.set('type', 'email');
  url.searchParams.set('embed', '1');
  url.searchParams.set('next', next);
  return NextResponse.json({ url: url.toString() }, { headers: { 'Cache-Control': 'no-store' } });
}
