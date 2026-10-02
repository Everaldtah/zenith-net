'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/redis';
import { POSTS_PER_PAGE } from '@/lib/data';
import type { FormState } from './profile';

async function signedIn() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, uid: (data?.claims?.sub as string | undefined) ?? null };
}

const text = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

export async function createThread(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, uid } = await signedIn();
  if (!uid) return { error: 'Sign in to post.' };
  const title = text(form, 'title');
  const body = text(form, 'body');
  if (title.length < 4 || title.length > 120) return { error: 'Titles are 4 to 120 characters.' };
  if (!body) return { error: 'Write something in the post.' };
  if (body.length > 10000) return { error: 'Posts are at most 10,000 characters.' };
  if (!(await rateLimit('thread', uid, 4, 600)).ok) return { error: 'You’ve started a lot of threads. Try again in a few minutes.' };

  const { data, error } = await supabase.rpc('forum_create_thread', {
    p_board: text(form, 'board'), p_title: title, p_body: body, p_game_version: text(form, 'game_version') || null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/forums/${text(form, 'board')}`);
  revalidatePath('/forums');
  redirect(`/forums/t/${data}`);
}

export async function reply(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, uid } = await signedIn();
  if (!uid) return { error: 'Sign in to reply.' };
  const thread = Number(form.get('thread'));
  const body = text(form, 'body');
  if (!body) return { error: 'Write something first.' };
  if (body.length > 10000) return { error: 'Posts are at most 10,000 characters.' };
  if (!(await rateLimit('reply', uid, 10, 60)).ok) return { error: 'Slow down a little and try again in a minute.' };

  const { data: postId, error } = await supabase.rpc('forum_reply', { p_thread: thread, p_body: body });
  if (error) return { error: error.message };
  const { count } = await supabase.from('forum_posts').select('id', { count: 'exact', head: true }).eq('thread_id', thread);
  const last = Math.max(1, Math.ceil((count ?? 1) / POSTS_PER_PAGE));
  revalidatePath(`/forums/t/${thread}`);
  redirect(`/forums/t/${thread}${last > 1 ? `?page=${last}` : ''}#p${postId}`);
}

export async function editPost(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, uid } = await signedIn();
  if (!uid) return { error: 'Sign in first.' };
  const body = text(form, 'body');
  if (!body || body.length > 10000) return { error: 'Posts are 1 to 10,000 characters.' };
  const { error } = await supabase.rpc('forum_edit_post', { p_post: Number(form.get('post')), p_body: body });
  if (error) return { error: error.message };
  revalidatePath(`/forums/t/${form.get('thread')}`);
  return { ok: 'Saved.' };
}

export async function deletePost(form: FormData) {
  const { supabase } = await signedIn();
  const { data } = await supabase.rpc('forum_delete_post', { p_post: Number(form.get('post')) });
  const board = text(form, 'board');
  revalidatePath(`/forums/${board}`);
  if (data === 'thread') redirect(`/forums/${board}`);
  revalidatePath(`/forums/t/${form.get('thread')}`);
}

export async function moderateThread(form: FormData) {
  const { supabase } = await signedIn();
  const flag = (k: string) => (form.has(k) ? form.get(k) === '1' : null);
  await supabase.rpc('forum_mod_thread', {
    p_thread: Number(form.get('thread')),
    p_status: text(form, 'status') || null,
    p_pinned: flag('pinned'),
    p_locked: flag('locked'),
  });
  revalidatePath(`/forums/t/${form.get('thread')}`);
  revalidatePath(`/forums/${text(form, 'board')}`);
}
