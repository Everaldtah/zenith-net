'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { GoogleIcon } from '@/components/AuthCard';
import { Notice } from '@/components/Notice';
import { createClient } from '@/lib/supabase/client';

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const router = useRouter();
  const [error, setError] = useState(initialError ?? '');
  const [busy, setBusy] = useState(false);

  async function google() {
    setBusy(true);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) { setError(error.message); setBusy(false); }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get('email')).trim();
    setBusy(true); setError('');
    const { error } = await createClient().auth.signInWithPassword({ email, password: String(f.get('password')) });
    if (error) {
      setBusy(false);
      if (/confirm/i.test(error.message)) { router.push(`/register?verify=${encodeURIComponent(email)}`); return; }
      setError(error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {error && <Notice tone="error">{error}</Notice>}
      <button type="button" onClick={google} disabled={busy} className="btn w-full py-2.5"><GoogleIcon /> Continue with Google</button>
      <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
      <form onSubmit={submit} className="space-y-4">
        <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" className="input" /></div>
        <div>
          <div className="flex items-baseline justify-between">
            <label className="label" htmlFor="password">Password</label>
            <Link href="/forgot" className="text-xs text-muted hover:text-ink">Forgot password?</Link>
          </div>
          <input id="password" name="password" type="password" required autoComplete="current-password" className="input" />
        </div>
        <button className="btn btn-primary w-full py-2.5" disabled={busy}>{busy ? 'Signing in…' : 'Log in'}</button>
      </form>
      <p className="text-center text-sm text-muted">New to Zenith.net? <Link href={`/register?next=${encodeURIComponent(next)}`} className="link">Create an account</Link></p>
    </div>
  );
}
