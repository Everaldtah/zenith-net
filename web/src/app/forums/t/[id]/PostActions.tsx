'use client';
import { useActionState, useState } from 'react';
import { deletePost, editPost, reply } from '@/app/actions/forum';
import type { FormState } from '@/app/actions/profile';
import { Notice } from '@/components/Notice';
import { SubmitButton } from '@/components/SubmitButton';

export function PostActions({ post, thread, board, body, isOp }: { post: number; thread: number; board: string; body: string; isOp: boolean }) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [state, action] = useActionState<FormState, FormData>(async (s, f) => {
    const r = await editPost(s, f);
    if (r?.ok) setEditing(false);
    return r;
  }, undefined);

  if (editing) {
    return (
      <form action={action} className="mt-3 space-y-2">
        {state?.error && <Notice tone="error">{state.error}</Notice>}
        <input type="hidden" name="post" value={post} /><input type="hidden" name="thread" value={thread} />
        <textarea name="body" defaultValue={body} rows={8} maxLength={10000} className="input font-mono text-[13px]" />
        <div className="flex gap-2">
          <SubmitButton className="btn btn-primary text-xs">Save</SubmitButton>
          <button type="button" onClick={() => setEditing(false)} className="btn btn-ghost text-xs">Cancel</button>
        </div>
      </form>
    );
  }
  return (
    <div className="flex items-center gap-3 text-xs">
      <button onClick={() => setEditing(true)} className="text-muted hover:text-ink">Edit</button>
      {confirm ? (
        <form action={deletePost} className="flex items-center gap-2">
          <input type="hidden" name="post" value={post} /><input type="hidden" name="thread" value={thread} /><input type="hidden" name="board" value={board} />
          <span className="text-bad">{isOp ? 'Delete this thread?' : 'Delete this post?'}</span>
          <button className="font-semibold text-bad hover:underline">Yes, delete</button>
          <button type="button" onClick={() => setConfirm(false)} className="text-muted hover:text-ink">No</button>
        </form>
      ) : (
        <button onClick={() => setConfirm(true)} className="text-muted hover:text-bad">Delete</button>
      )}
    </div>
  );
}

export function ReplyForm({ thread }: { thread: number }) {
  const [state, action] = useActionState<FormState, FormData>(reply, undefined);
  return (
    <form action={action} className="space-y-3">
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      <input type="hidden" name="thread" value={thread} />
      <label className="label" htmlFor="reply">Your reply</label>
      <textarea id="reply" name="body" required rows={6} maxLength={10000} className="input text-[14px] leading-relaxed" placeholder="Markdown works. Be kind and stay on topic." />
      <SubmitButton pendingText="Posting…">Post reply</SubmitButton>
    </form>
  );
}
