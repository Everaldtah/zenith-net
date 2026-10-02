import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/AuthCard';
import { getViewer } from '@/lib/data';
import { ResetForm } from './ResetForm';

export const metadata: Metadata = { title: 'Choose a new password' };

export default async function Reset() {
  const { userId } = await getViewer();
  if (!userId) redirect('/forgot');
  return <AuthCard title="Choose a new password"><ResetForm /></AuthCard>;
}
