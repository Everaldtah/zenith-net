'use client';
import { useActionState } from 'react';
import { addFriend } from '@/app/actions/social';
import type { FormState } from '@/app/actions/profile';
import { Notice } from '@/components/Notice';
import { SubmitButton } from '@/components/SubmitButton';

export function AddFriendForm() {
  const [state, action] = useActionState<FormState, FormData>(addFriend, undefined);
  return (
    <form action={action} className="space-y-3">
      <label className="label" htmlFor="handle">Add a friend</label>
      <div className="flex gap-2">
        <input id="handle" name="handle" required placeholder="Name#1234" pattern="[A-Za-z][A-Za-z0-9_]{2,11}#[0-9]{4}" title="Name#1234" className="input" autoComplete="off" spellCheck={false} />
        <SubmitButton className="btn btn-primary shrink-0" pendingText="Sending…">Send request</SubmitButton>
      </div>
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      {state?.ok && <Notice tone="ok">{state.ok}</Notice>}
    </form>
  );
}
