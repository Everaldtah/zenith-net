import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Terms of service' };

export default function Terms() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 leading-relaxed text-[#c3c9d8] [&_h2]:h-display [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:text-ink [&_li]:mt-1.5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
      <p className="eyebrow">Legal</p>
      <h1 className="h-display mt-2 text-3xl text-ink">Terms of service</h1>
      <p className="text-sm text-muted">Last updated 2 October 2026</p>

      <p>
        These terms cover the Zenith.net website, forums, launcher and the games you download through them, all provided by
        EveraldTah (&ldquo;we&rdquo;). By creating an account or using Zenith.net you agree to them.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You need to be at least 13 to have an account.</li>
        <li>Keep your sign-in details to yourself. You&apos;re responsible for what happens on your account.</li>
        <li>One person per account. Don&apos;t impersonate anyone, including us or other players.</li>
      </ul>

      <h2>Be decent</h2>
      <p>On the forums, in parties and in games, don&apos;t:</p>
      <ul>
        <li>harass, threaten or abuse anyone, or post hateful, sexual or illegal content;</li>
        <li>spam, advertise or post links to malware or scams;</li>
        <li>cheat, exploit bugs on purpose against other players, or attack the service;</li>
        <li>post other people&apos;s personal information.</li>
      </ul>
      <p>We can remove content and suspend or close accounts that break these rules.</p>

      <h2>What you post</h2>
      <p>
        You keep ownership of what you write. You give us permission to show it on Zenith.net and in the launcher. If you
        report a bug or suggest an idea, we may use that feedback to improve the games, with no obligation to you.
      </p>

      <h2>The games and the launcher</h2>
      <p>
        The games and the launcher are free and provided &ldquo;as is&rdquo;. They&apos;re made by an independent developer,
        so expect bugs, and please report them in the <Link href="/forums" className="link">forums</Link>. We may change,
        update or stop offering a game or feature at any time. The games and their art, characters and music belong to their
        creator. Don&apos;t redistribute or sell them.
      </p>

      <h2>Liability</h2>
      <p>
        As far as the law allows, we aren&apos;t liable for indirect losses or for loss of data or progress. Nothing in these
        terms limits rights you have under UK consumer law.
      </p>

      <h2>Ending things</h2>
      <p>
        You can stop using Zenith.net and ask us to delete your account at any time (see the{' '}
        <Link href="/privacy" className="link">privacy policy</Link>). We may close accounts that break these terms.
      </p>

      <h2>Law</h2>
      <p>These terms are governed by the laws of England and Wales.</p>
    </article>
  );
}
