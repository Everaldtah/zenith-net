'use client';
import { useActionState } from 'react';
import Link from 'next/link';
import { changePassword, type FormState } from '@/app/actions/profile';
import { Notice } from '@/components/Notice';
import { SubmitButton } from '@/components/SubmitButton';

export function ResetForm() {
  const [state, action] = useActionState<FormState, FormData>(changePassword, undefined);
  if (state?.ok) return <Notice tone="ok">Password changed. <Link href="/" className="underline">Continue</Link></Notice>;
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      <div><label className="label" htmlFor="password">New password</label><input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="input" /></div>
      <div><label className="label" htmlFor="confirm">Confirm</label><input id="confirm" name="confirm" type="password" required autoComplete="new-password" className="input" /></div>
      <SubmitButton className="btn btn-primary w-full py-2.5">Save password</SubmitButton>
    </form>
  );
}
