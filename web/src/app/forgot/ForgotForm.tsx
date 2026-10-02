'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Notice } from '@/components/Notice';
import { createClient } from '@/lib/supabase/client';

export function ForgotForm() {
  const [sent, setSent] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get('email')).trim();
    setBusy(true); setError('');
    const { error } = await createClient().auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/auth/callback?next=/reset` });
    setBusy(false);
    if (error) setError(error.message); else setSent(email);
  }
  if (sent) return <Notice tone="ok">If {sent} has a Zenith.net account, a reset link is on its way. Open it on this device.</Notice>;
  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Notice tone="error">{error}</Notice>}
      <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required className="input" autoComplete="email" /></div>
      <button className="btn btn-primary w-full py-2.5" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
      <p className="text-center text-sm text-muted">Signed up with Google? Just use <Link href="/login" className="link">Continue with Google</Link>.</p>
    </form>
  );
}
