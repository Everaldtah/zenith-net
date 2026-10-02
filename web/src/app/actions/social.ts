'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/redis';
import type { FormState } from './profile';

export async function addFriend(_: FormState, form: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub as string | undefined;
  if (!uid) return { error: 'Sign in first.' };
  if (!(await rateLimit('friendreq', uid, 30, 3600)).ok) return { error: 'Too many friend requests this hour.' };
  const target = String(form.get('handle') ?? '').trim();
  const { data, error } = await supabase.rpc('send_friend_request', { p_handle: target });
  if (error) return { error: error.message };
  revalidatePath('/friends');
  return { ok: data === 'accepted' ? `You and ${target} are now friends.` : data === 'already' ? `${target} is already your friend.` : `Friend request sent to ${target}.` };
}

export async function respondFriend(form: FormData) {
  const supabase = await createClient();
  await supabase.rpc('respond_friend_request', { p_from: String(form.get('from')), p_accept: form.get('accept') === '1' });
  revalidatePath('/friends');
}

export async function cancelFriend(form: FormData) {
  const supabase = await createClient();
  await supabase.rpc('cancel_friend_request', { p_to: String(form.get('to')) });
  revalidatePath('/friends');
}

export async function removeFriend(form: FormData) {
  const supabase = await createClient();
  await supabase.rpc('remove_friend', { p_friend: String(form.get('friend')) });
  revalidatePath('/friends');
}

/** "Add friend" button on someone's profile */
export async function requestFromProfile(form: FormData) {
  const supabase = await createClient();
  await supabase.rpc('send_friend_request', { p_handle: String(form.get('handle')) });
  revalidatePath(String(form.get('path') ?? '/friends'));
}
