'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { GoogleIcon } from '@/components/AuthCard';
import { Notice } from '@/components/Notice';
import { createClient } from '@/lib/supabase/client';

export function RegisterForm({ next, verifyEmail }: { next: string; verifyEmail?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<'details' | 'code'>(verifyEmail ? 'code' : 'details');
  const [email, setEmail] = useState(verifyEmail ?? '');
  const [error, setError] = useState('');
  const [info, setInfo] = useState(verifyEmail ? `Enter the 6-digit code we sent to ${verifyEmail}.` : '');
  const [busy, setBusy] = useState(false);
  const welcome = `/welcome?next=${encodeURIComponent(next)}`;

  async function google() {
    setBusy(true);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google', options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) { setError(error.message); setBusy(false); }
  }

  async function register(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const em = String(f.get('email')).trim().toLowerCase();
    const pw = String(f.get('password'));
    setError('');
    if (pw.length < 8) return setError('Use at least 8 characters for your password.');
    if (pw !== String(f.get('confirm'))) return setError('The passwords don’t match.');
    setBusy(true);
    const { data, error } = await createClient().auth.signUp({
      email: em, password: pw, options: { emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(welcome)}` },
    });
    setBusy(false);
    if (error) return setError(error.message);
    if (data.session) { router.replace(welcome); router.refresh(); return; }   // email confirmation switched off
    setEmail(em);
    setStep('code');
    setInfo(`We sent a 6-digit code to ${em}. It can take a minute; check spam too. Already have an account with this email? Log in instead.`);
  }

  async function verify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const token = String(new FormData(e.currentTarget).get('code')).replace(/\D/g, '');
    if (token.length !== 6) return setError('The code has 6 digits.');
    setBusy(true); setError('');
    const { error } = await createClient().auth.verifyOtp({ email, token, type: 'email' });
    setBusy(false);
    if (error) return setError(/expired|invalid/i.test(error.message) ? 'That code is wrong or has expired. Send a new one.' : error.message);
    router.replace(welcome);
    router.refresh();
  }

  async function resend() {
    setBusy(true); setError('');
    const { error } = await createClient().auth.resend({ type: 'signup', email });
    setBusy(false);
    if (error) setError(error.message); else setInfo(`New code sent to ${email}.`);
  }

  if (step === 'code') {
    return (
      <form onSubmit={verify} className="space-y-4">
        {info && <Notice>{info}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        <div>
          <label className="label" htmlFor="code">Verification code</label>
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required autoFocus
            className="input text-center font-mono text-2xl tracking-[0.5em]" placeholder="000000" />
        </div>
        <button className="btn btn-primary w-full py-2.5" disabled={busy}>{busy ? 'Checking…' : 'Verify email'}</button>
        <div className="flex justify-between text-sm">
          <button type="button" onClick={resend} disabled={busy} className="text-muted hover:text-ink">Send a new code</button>
          <button type="button" onClick={() => { setStep('details'); setInfo(''); setError(''); }} className="text-muted hover:text-ink">Use a different email</button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-5">
      {error && <Notice tone="error">{error}</Notice>}
      <button type="button" onClick={google} disabled={busy} className="btn w-full py-2.5"><GoogleIcon /> Sign up with Google</button>
      <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-muted"><span className="h-px flex-1 bg-line" />or with email<span className="h-px flex-1 bg-line" /></div>
      <form onSubmit={register} className="space-y-4">
        <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" defaultValue={email} className="input" /></div>
        <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="input" /></div>
        <div><label className="label" htmlFor="confirm">Confirm password</label><input id="confirm" name="confirm" type="password" required autoComplete="new-password" className="input" /></div>
        <button className="btn btn-primary w-full py-2.5" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        <p className="text-xs text-muted">Be decent on the forums and in games. Accounts that harass people or post spam get removed.</p>
      </form>
      <p className="text-center text-sm text-muted">Already registered? <Link href={`/login?next=${encodeURIComponent(next)}`} className="link">Log in</Link></p>
    </div>
  );
}
