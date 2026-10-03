'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { adminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/redis';
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

/** Settings -> Delete account. The person types their own tag (Name#1234) to confirm. */
export async function deleteAccount(_: FormState, form: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub as string | undefined;
  if (!uid) return { error: 'Sign in first.' };
  if (!(await rateLimit('delete-account', uid, 5, 3600)).ok) return { error: 'Too many attempts. Try again in an hour.' };

  const { data: profile } = await supabase.from('profiles').select('username, tag').eq('id', uid).maybeSingle();
  const expected = profile ? `${profile.username}#${profile.tag}` : 'DELETE';
  if (String(form.get('confirm') ?? '').trim().toLowerCase() !== expected.toLowerCase()) {
    return { error: `Type ${expected} exactly to confirm.` };
  }

  const admin = adminClient();
  const { error: purgeError } = await admin.rpc('purge_account_content', { p_uid: uid });
  if (purgeError) return { error: `Couldn’t remove your posts: ${purgeError.message}` };
  const { error: deleteError } = await admin.auth.admin.deleteUser(uid);
  if (deleteError) return { error: `Couldn’t delete the account: ${deleteError.message}` };

  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  revalidatePath('/', 'layout');
  redirect('/?deleted=1');
}
