import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacy policy' };

const CONTACT = 'evraldtah@gmail.com';

export default function Privacy() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 leading-relaxed text-[#c3c9d8] [&_h2]:h-display [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:text-ink [&_li]:mt-1.5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
      <p className="eyebrow">Legal</p>
      <h1 className="h-display mt-2 text-3xl text-ink">Privacy policy</h1>
      <p className="text-sm text-muted">Last updated 3 October 2026</p>

      <p>
        Zenith.net is run by EveraldTah, an independent game developer in the United Kingdom. This page explains what we
        collect when you use the Zenith.net website, forums and launcher, why, and what you can ask us to do with it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><b>Account</b>: your email address and a password (stored only as a hash), or, if you sign in with Google, the email address and basic profile Google shares with us. We don&apos;t receive your Google password.</li>
        <li><b>Profile</b>: your username and tag (like Name#1234), the avatar you pick and the bio you write. These are public.</li>
        <li><b>What you post</b>: forum threads and replies, which are public.</li>
        <li><b>Social</b>: your friends list, friend requests, party invites, and whether you&apos;re online or in a game. Only your friends see your online status.</li>
        <li><b>Play time</b>: how long you play each game launched from the launcher. Totals appear on your public profile.</li>
        <li><b>Technical</b>: IP address, browser or launcher version and request logs kept by our hosting providers to run the service and stop abuse, plus counts of downloads.</li>
      </ul>

      <h2>Why we use it</h2>
      <p>
        To run your account, show your profile and posts, let friends find you and play together, deliver game downloads and
        updates, send account emails (sign-up codes and password resets), and keep the service secure. We don&apos;t sell
        your data, we don&apos;t show ads and we don&apos;t use advertising trackers. Under UK GDPR our legal basis is
        providing the service you asked for (contract) and keeping it secure (legitimate interests).
      </p>

      <h2>Who processes it for us</h2>
      <ul>
        <li>Supabase: database and sign-in, hosted in London (eu-west-2).</li>
        <li>Vercel: website hosting.</li>
        <li>Upstash: short-lived counters and rate limits.</li>
        <li>GitHub: game and launcher downloads.</li>
        <li>Google: &ldquo;Continue with Google&rdquo; sign-in, and Gmail for sending account emails.</li>
      </ul>
      <p>Some of these providers may process data outside the UK under their own data-protection safeguards.</p>

      <h2>How long we keep it</h2>
      <p>
        For as long as your account exists. You can delete your account yourself in Settings: that removes your profile,
        friends, party and play time at once, deletes threads you started that nobody replied to, and replaces your other
        posts with &ldquo;[deleted]&rdquo; with your name taken off, so other people&apos;s replies still make sense.
      </p>

      <h2>Your rights</h2>
      <p>
        You can delete your account in Settings at any time. You can also ask for a copy of your data or for corrections: email{' '}
        <a href={`mailto:${CONTACT}`} className="link">{CONTACT}</a> from your account&apos;s address and we&apos;ll
        reply within 30 days. You can also complain to the UK Information Commissioner&apos;s Office (ico.org.uk).
      </p>

      <h2>Children</h2>
      <p>Zenith.net isn&apos;t meant for children under 13, and they shouldn&apos;t create an account.</p>

      <h2>Changes</h2>
      <p>If this policy changes in a way that matters, we&apos;ll post it in Zenith.net News before it takes effect.</p>
    </article>
  );
}
