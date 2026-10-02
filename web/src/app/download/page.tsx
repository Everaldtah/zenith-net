import type { Metadata } from 'next';
import { LogoMark } from '@/components/Logo';
import { getLauncherRelease } from '@/lib/data';
import { bytes, fmtDate } from '@/lib/format';

export const revalidate = 60;
export const metadata: Metadata = { title: 'Download the launcher' };

const STEPS = [
  ['1. Run the installer', 'Open ZenithNet-Setup.exe. It installs in a few seconds and opens the launcher.'],
  ['2. Sign in', 'Continue with Google, or register with your email and the 6-digit code we send you.'],
  ['3. Pick a username', 'You get a tag like Name#1234. Friends add you with it.'],
];

export default async function Download() {
  const r = await getLauncherRelease();
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <div className="card relative overflow-hidden p-8 sm:p-12">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-accent-2/20 blur-3xl" />
        <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <LogoMark className="h-20 w-20" />
          <div className="flex-1">
            <h1 className="h-display text-3xl">Zenith.net launcher</h1>
            <p className="mt-2 text-muted">Install and update your games, keep your friends list and party with you, and launch together.</p>
          </div>
        </div>
        <div className="relative mt-8 flex flex-wrap items-center gap-4">
          {r ? (
            <>
              <a href="/api/download?launcher=1" className="btn btn-primary btn-lg">Download for Windows</a>
              <span className="text-sm text-muted">Version {r.version} · {bytes(r.size)} · {fmtDate(r.created_at)}</span>
            </>
          ) : (
            <span className="text-muted">The launcher download will appear here shortly.</span>
          )}
        </div>
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-3">
        {STEPS.map(([t, d]) => (
          <div key={t} className="card p-5"><div className="font-semibold">{t}</div><p className="mt-1.5 text-sm text-muted">{d}</p></div>
        ))}
      </div>

      <div className="card mt-6 p-5 text-sm">
        <div className="font-semibold">Windows says &ldquo;Windows protected your PC&rdquo;?</div>
        <p className="mt-1.5 text-muted">
          The launcher isn&apos;t code-signed yet, so Microsoft SmartScreen doesn&apos;t recognise it. Click <b className="text-ink">More info</b>,
          then <b className="text-ink">Run anyway</b>. Game downloads are checked against a SHA-256 fingerprint before anything is installed.
        </p>
        {r && <p className="mt-2 break-all font-mono text-xs text-muted">SHA-256 {r.sha256}</p>}
      </div>

      <div className="card mt-6 p-5 text-sm">
        <div className="font-semibold">System requirements</div>
        <ul className="mt-2 grid gap-1 text-muted sm:grid-cols-2">
          <li>Windows 10 or 11, 64-bit</li>
          <li>A DirectX 11 graphics card</li>
          <li>8 GB RAM (16 GB recommended)</li>
          <li>About 2 GB of disk for every edition</li>
        </ul>
      </div>
    </div>
  );
}
