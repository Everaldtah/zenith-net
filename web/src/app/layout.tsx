import type { Metadata } from 'next';
import { Inter, Oxanium } from 'next/font/google';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { isEmbed } from '@/lib/data';
import './globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });
const oxanium = Oxanium({ variable: '--font-oxanium', subsets: ['latin'], weight: ['500', '600', '700', '800'] });

export const metadata: Metadata = {
  title: { default: 'Zenith.net', template: '%s · Zenith.net' },
  description: 'Download the Zenith.net launcher to play ZENITH//UMBRA and Nebula Dominion with your friends.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000')),
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const embed = await isEmbed();
  return (
    <html lang="en" className={`${inter.variable} ${oxanium.variable} h-full antialiased`}>
      <body className={`flex min-h-full flex-col font-sans ${embed ? 'bg-transparent' : ''}`}>
        {!embed && <Header />}
        <main className="flex-1">{children}</main>
        {!embed && <Footer />}
      </body>
    </html>
  );
}
