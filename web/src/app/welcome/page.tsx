import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/AuthCard';
import { getViewer } from '@/lib/data';
import { safeNext } from '@/lib/safe';
import { WelcomeForm } from './WelcomeForm';

export const metadata: Metadata = { title: 'Choose your username' };

export default async function Welcome(props: PageProps<'/welcome'>) {
  const next = safeNext((await props.searchParams).next);
  const { userId, email, profile } = await getViewer();
  if (!userId) redirect(`/login?next=${encodeURIComponent('/welcome')}`);
  if (profile) redirect(next);
  return (
    <AuthCard title="Choose your username" subtitle={<>Signed in as {email}. This is the name friends see and add.</>}>
      <WelcomeForm next={next} />
    </AuthCard>
  );
}
