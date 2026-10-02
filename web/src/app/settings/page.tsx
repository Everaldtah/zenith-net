import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/data';
import { SettingsForms } from './SettingsForms';

export const metadata: Metadata = { title: 'Settings' };

export default async function Settings() {
  const { userId, email, profile } = await getViewer();
  if (!userId) redirect('/login?next=/settings');
  if (!profile) redirect('/welcome?next=/settings');
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="h-display text-3xl">Settings</h1>
      <p className="mt-2 text-muted">Signed in as {email}</p>
      <SettingsForms profile={profile} />
    </div>
  );
}
