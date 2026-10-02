import type { Metadata } from 'next';
import { AuthCard } from '@/components/AuthCard';
import { ForgotForm } from './ForgotForm';

export const metadata: Metadata = { title: 'Reset password' };

export default function Forgot() {
  return <AuthCard title="Reset your password" subtitle="We'll email you a link to choose a new one."><ForgotForm /></AuthCard>;
}
