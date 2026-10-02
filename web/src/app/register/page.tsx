import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/AuthCard';
import { getViewer } from '@/lib/data';
import { safeNext } from '@/lib/safe';
import { RegisterForm } from './RegisterForm';

export const metadata: Metadata = { title: 'Create account' };

export default async function Register(props: PageProps<'/register'>) {
  const sp = await props.searchParams;
  const next = safeNext(sp.next);
  const { userId, profile } = await getViewer();
  if (userId) redirect(profile ? next : `/welcome?next=${encodeURIComponent(next)}`);
  return (
    <AuthCard title="Create your account" subtitle="Free. Works on the website, in the forums and in the launcher.">
      <RegisterForm next={next} verifyEmail={typeof sp.verify === 'string' ? sp.verify : undefined} />
    </AuthCard>
  );
}
