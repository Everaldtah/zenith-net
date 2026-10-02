import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/AuthCard';
import { getViewer } from '@/lib/data';
import { safeNext } from '@/lib/safe';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Log in' };

export default async function Login(props: PageProps<'/login'>) {
  const sp = await props.searchParams;
  const next = safeNext(sp.next);
  const { userId, profile } = await getViewer();
  if (userId) redirect(profile ? next : `/welcome?next=${encodeURIComponent(next)}`);
  return (
    <AuthCard title="Log in to Zenith.net" subtitle="One account for the website, the forums and the launcher.">
      <LoginForm next={next} initialError={typeof sp.error === 'string' ? sp.error : undefined} />
    </AuthCard>
  );
}
