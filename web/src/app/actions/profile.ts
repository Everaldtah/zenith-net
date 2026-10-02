'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/safe';
import { AVATARS } from '@/lib/format';

export type FormState = { error?: string; ok?: string } | undefined;

export async function claimUsername(_: FormState, form: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('claim_battletag', { p_username: String(form.get('username') ?? '') });
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  redirect(safeNext(form.get('next')));
}

export async function saveProfile(_: FormState, form: FormData): Promise<FormState> {
  const avatar = String(form.get('avatar') ?? '');
  if (avatar && !AVATARS.includes(avatar)) return { error: 'Pick one of the avatars shown.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_profile', { p_avatar: avatar, p_bio: String(form.get('bio') ?? '') });
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { ok: 'Saved.' };
}

export async function renameUser(_: FormState, form: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('claim_battletag', { p_username: String(form.get('username') ?? '') });
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { ok: `You are now ${data.username}#${data.tag}.` };
}

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const pw = String(form.get('password') ?? '');
  if (pw.length < 8) return { error: 'Use at least 8 characters.' };
  if (pw !== String(form.get('confirm') ?? '')) return { error: 'The passwords don’t match.' };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: pw });
  if (error) return { error: error.message };
  return { ok: 'Password changed.' };
}
