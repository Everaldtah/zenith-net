'use client';
import { useActionState, useState } from 'react';
import { claimUsername, type FormState } from '@/app/actions/profile';
import { Notice } from '@/components/Notice';
import { SubmitButton } from '@/components/SubmitButton';

export function WelcomeForm({ next }: { next: string }) {
  const [state, action] = useActionState<FormState, FormData>(claimUsername, undefined);
  const [name, setName] = useState('');
  const valid = /^[A-Za-z][A-Za-z0-9_]{2,11}$/.test(name);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label" htmlFor="username">Username</label>
        <input id="username" name="username" required autoFocus maxLength={12} value={name} onChange={e => setName(e.target.value)}
          className="input text-lg" placeholder="e.g. NovaStrike" autoComplete="off" spellCheck={false} />
        <p className="mt-2 text-xs text-muted">3 to 12 letters, numbers or _, starting with a letter.</p>
      </div>
      <div className="rounded-lg border border-line bg-[#0a0e16] p-4 text-center">
        <div className="text-xs uppercase tracking-wider text-muted">Your tag will look like</div>
        <div className="mt-1 font-display text-2xl font-bold">{name || 'Name'}<span className="text-muted">#{'????'}</span></div>
        <div className="mt-1 text-xs text-muted">The 4-digit number is picked for you, so lots of people can share a name.</div>
      </div>
      <SubmitButton className="btn btn-primary w-full py-2.5" pendingText="Claiming…">{valid ? `Claim ${name}` : 'Claim username'}</SubmitButton>
    </form>
  );
}
