'use client';
import { useActionState } from 'react';
import { createThread } from '@/app/actions/forum';
import type { FormState } from '@/app/actions/profile';
import { Notice } from '@/components/Notice';
import { SubmitButton } from '@/components/SubmitButton';

const BUG_TEMPLATE = `**What happened?**


**What did you expect to happen?**


**Steps to reproduce**
1.
2.

**Hero / unit / map / mission:**
**Your PC (GPU, RAM):**`;

export function NewThreadForm({ board, kind, versions }: { board: string; kind: string; versions: string[] }) {
  const [state, action] = useActionState<FormState, FormData>(createThread, undefined);
  const bug = kind === 'bugs';
  return (
    <form action={action} className="space-y-5">
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      <input type="hidden" name="board" value={board} />
      <div>
        <label className="label" htmlFor="title">{bug ? 'Short summary of the bug' : 'Title'}</label>
        <input id="title" name="title" required minLength={4} maxLength={120} className="input" placeholder={bug ? 'e.g. Tomoe falls through the floor on Sunset Mile after her ult' : ''} />
      </div>
      {bug && (
        <div>
          <label className="label" htmlFor="game_version">Game version</label>
          <input id="game_version" name="game_version" list="versions" maxLength={40} className="input max-w-xs" placeholder={versions[0] ?? 'e.g. 1.3.0'} />
          <datalist id="versions">{versions.map(v => <option key={v} value={v} />)}</datalist>
          <p className="mt-1.5 text-xs text-muted">Shown in the launcher under the Play button, or on the game&apos;s main menu.</p>
        </div>
      )}
      <div>
        <label className="label" htmlFor="body">Post</label>
        <textarea id="body" name="body" required rows={bug ? 14 : 10} maxLength={10000} defaultValue={bug ? BUG_TEMPLATE : ''} className="input font-mono text-[13px] leading-relaxed" />
        <p className="mt-1.5 text-xs text-muted">Markdown works: **bold**, *italic*, `code`, lists and links. Screenshots: paste an https image link as ![screenshot](https://…).</p>
      </div>
      <SubmitButton pendingText="Posting…">{bug ? 'Submit bug report' : 'Post thread'}</SubmitButton>
    </form>
  );
}
