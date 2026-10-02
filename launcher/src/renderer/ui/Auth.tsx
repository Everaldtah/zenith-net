// First thing a new install shows: Continue with Google, register with email (6-digit code), or log in.
import { useState } from 'react';
import { zenith } from '../lib/bridge';
import { sb } from '../lib/sb';
import { GoogleIcon, LogoMark, Notice, SITE } from './bits';

type Mode = 'choose' | 'register' | 'code' | 'login' | 'google';

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('choose');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const go = (m: Mode) => { setError(''); setInfo(''); setMode(m); };

  async function google() {
    setError(''); setBusy(true);
    try {
      const redirect = (await zenith.info()).oauthRedirect;
      const { data, error } = await sb.auth.signInWithOAuth({
        provider: 'google', options: { redirectTo: redirect, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
      });
      if (error || !data.url) throw error ?? new Error('Google sign-in is not available');
      setMode('google');
      const code = await zenith.auth.google(data.url);
      const { error: exErr } = await sb.auth.exchangeCodeForSession(code);
      if (exErr) throw exErr;
    } catch (e) {
      const msg = (e as Error).message;
      setMode('choose');
      if (msg !== 'cancelled') setError(/provider is not enabled/i.test(msg) ? 'Google sign-in isn’t switched on yet. Register with your email for now.' : msg);
    } finally { setBusy(false); }
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
    const { data, error } = await sb.auth.signUp({ email: em, password: pw, options: { emailRedirectTo: `${SITE}/auth/callback?next=/welcome` } });
    setBusy(false);
    if (error) return setError(error.message);
    if (data.session) return;                       // confirmation off: signed in straight away
    setEmail(em);
    go('code');
    setInfo(`We sent a 6-digit code to ${em}. It can take a minute, so check spam too.`);
  }

  async function verify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const token = String(new FormData(e.currentTarget).get('code')).replace(/\D/g, '');
    if (token.length !== 6) return setError('The code has 6 digits.');
    setBusy(true); setError('');
    const { error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
    setBusy(false);
    if (error) setError(/expired|invalid/i.test(error.message) ? 'That code is wrong or has expired. Send a new one.' : error.message);
  }

  async function resend() {
    setBusy(true); setError('');
    const { error } = await sb.auth.resend({ type: 'signup', email });
    setBusy(false);
    if (error) setError(error.message); else setInfo(`New code sent to ${email}.`);
  }

  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const em = String(f.get('email')).trim();
    setBusy(true); setError('');
    const { error } = await sb.auth.signInWithPassword({ email: em, password: String(f.get('password')) });
    setBusy(false);
    if (!error) return;
    if (/confirm/i.test(error.message)) { setEmail(em.toLowerCase()); go('code'); setInfo(`Your email isn’t verified yet. Enter the code we sent to ${em}, or send a new one.`); return; }
    setError(error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message);
  }

  const back = <button type="button" onClick={() => go('choose')} className="text-sm text-muted hover:text-ink">&larr; Back</button>;
  const googleBtn = (label: string) => (
    <button type="button" onClick={google} disabled={busy} className="btn w-full py-3 text-[15px]"><GoogleIcon /> {label}</button>
  );

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[1fr_460px]">
      <div className="relative overflow-hidden">
        <img src={`${SITE}/games/zenith-umbra/banner.webp`} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" draggable={false} />
        <div className="absolute inset-0 bg-gradient-to-r from-bg/30 via-bg/50 to-bg" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-bg to-transparent" />
        <div className="absolute bottom-10 left-10 max-w-md">
          <p className="eyebrow">Your games. Your friends. One launcher.</p>
          <h1 className="h-display mt-3 text-4xl leading-tight">ZENITH//UMBRA<br /><span className="text-[#c9a8ff]">Nebula Dominion</span></h1>
          <p className="mt-3 text-[#c3c9d8]">Install, update and launch every game, add friends and party up to play together.</p>
        </div>
      </div>

      <div className="flex flex-col justify-center border-l border-line bg-panel px-10">
        <div className="anim-in" key={mode}>
          <LogoMark className="h-11 w-11" />
          {mode === 'choose' && (
            <>
              <h2 className="h-display mt-5 text-2xl">Welcome to Zenith.net</h2>
              <p className="mt-1.5 text-sm text-muted">Sign in to play, add friends and use the forums.</p>
              <div className="mt-7 space-y-3">
                {error && <Notice tone="error">{error}</Notice>}
                {googleBtn('Continue with Google')}
                <button type="button" onClick={() => go('register')} className="btn btn-primary w-full py-3 text-[15px]">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
                  Register with email
                </button>
              </div>
              <p className="mt-6 text-center text-sm text-muted">Already have an account? <button onClick={() => go('login')} className="font-semibold text-accent hover:underline">Log in</button></p>
            </>
          )}

          {mode === 'google' && (
            <>
              <h2 className="h-display mt-5 text-2xl">Finish in your browser</h2>
              <p className="mt-2 text-sm text-muted">We opened Google sign-in in your web browser. Pick your account there and you&apos;ll come straight back here.</p>
              <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-panel-2"><div className="progress-stripes h-full w-full bg-accent/60" /></div>
              <button onClick={() => zenith.auth.cancelGoogle()} className="btn btn-ghost mt-6 w-full">Cancel</button>
            </>
          )}

          {mode === 'register' && (
            <form onSubmit={register} className="mt-5 space-y-4">
              <div className="flex items-center justify-between"><h2 className="h-display text-2xl">Create your account</h2>{back}</div>
              {error && <Notice tone="error">{error}</Notice>}
              <div><label className="label" htmlFor="r-email">Email</label><input id="r-email" name="email" type="email" required autoFocus defaultValue={email} className="input" /></div>
              <div><label className="label" htmlFor="r-pw">Password</label><input id="r-pw" name="password" type="password" required minLength={8} className="input" /></div>
              <div><label className="label" htmlFor="r-pw2">Confirm password</label><input id="r-pw2" name="confirm" type="password" required className="input" /></div>
              <button className="btn btn-primary w-full py-2.5" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
              <p className="text-xs text-muted">We&apos;ll email you a 6-digit code to check the address is yours.</p>
            </form>
          )}

          {mode === 'code' && (
            <form onSubmit={verify} className="mt-5 space-y-4">
              <div className="flex items-center justify-between"><h2 className="h-display text-2xl">Check your email</h2>{back}</div>
              {info && <Notice>{info}</Notice>}
              {error && <Notice tone="error">{error}</Notice>}
              <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required autoFocus placeholder="000000"
                className="input py-3 text-center font-mono text-3xl tracking-[0.5em]" />
              <button className="btn btn-primary w-full py-2.5" disabled={busy}>{busy ? 'Checking…' : 'Verify and continue'}</button>
              <button type="button" onClick={resend} disabled={busy} className="w-full text-center text-sm text-muted hover:text-ink">Send a new code</button>
            </form>
          )}

          {mode === 'login' && (
            <form onSubmit={login} className="mt-5 space-y-4">
              <div className="flex items-center justify-between"><h2 className="h-display text-2xl">Log in</h2>{back}</div>
              {error && <Notice tone="error">{error}</Notice>}
              {googleBtn('Continue with Google')}
              <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
              <div><label className="label" htmlFor="l-email">Email</label><input id="l-email" name="email" type="email" required autoFocus className="input" /></div>
              <div>
                <div className="flex items-baseline justify-between">
                  <label className="label" htmlFor="l-pw">Password</label>
                  <button type="button" onClick={() => zenith.openExternal(`${SITE}/forgot`)} className="text-xs text-muted hover:text-ink">Forgot password?</button>
                </div>
                <input id="l-pw" name="password" type="password" required className="input" />
              </div>
              <button className="btn btn-primary w-full py-2.5" disabled={busy}>{busy ? 'Signing in…' : 'Log in'}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export function UsernameScreen({ email, onDone }: { email: string; onDone: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = /^[A-Za-z][A-Za-z0-9_]{2,11}$/.test(name);

  async function claim(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    const { error } = await sb.rpc('claim_battletag', { p_username: name });
    setBusy(false);
    if (error) setError(error.message); else onDone();
  }

  return (
    <div className="grid flex-1 place-items-center bg-[radial-gradient(ellipse_at_top,rgba(43,140,255,0.12),transparent_60%)]">
      <form onSubmit={claim} className="card anim-in w-[440px] space-y-5 p-8">
        <LogoMark className="h-10 w-10" />
        <div>
          <h2 className="h-display text-2xl">Choose your username</h2>
          <p className="mt-1.5 text-sm text-muted">Signed in as {email}. This is the name friends see and add.</p>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <div>
          <input value={name} onChange={e => setName(e.target.value)} maxLength={12} autoFocus required placeholder="e.g. NovaStrike" className="input py-2.5 text-lg" spellCheck={false} />
          <p className="mt-2 text-xs text-muted">3 to 12 letters, numbers or _, starting with a letter.</p>
        </div>
        <div className="rounded-lg border border-line bg-[#0a0e16] p-4 text-center">
          <div className="text-xs uppercase tracking-wider text-muted">You&apos;ll be</div>
          <div className="mt-1 font-display text-2xl font-bold">{name || 'Name'}<span className="text-muted">#????</span></div>
          <div className="mt-1 text-xs text-muted">The number is picked for you, so lots of people can share a name.</div>
        </div>
        <button className="btn btn-primary w-full py-2.5" disabled={!valid || busy}>{busy ? 'Claiming…' : valid ? `Claim ${name}` : 'Claim username'}</button>
        <button type="button" onClick={() => sb.auth.signOut()} className="w-full text-center text-sm text-muted hover:text-ink">Use a different account</button>
      </form>
    </div>
  );
}
