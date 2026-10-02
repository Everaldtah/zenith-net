import Link from 'next/link';
import { LogoMark } from './Logo';

export function Footer() {
  return (
    <footer className="mt-20 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <LogoMark className="h-6 w-6 opacity-80" />
          <span>Zenith.net, an independent game platform by EveraldTah.</span>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/games" className="hover:text-ink">Games</Link>
          <Link href="/forums" className="hover:text-ink">Forums</Link>
          <Link href="/download" className="hover:text-ink">Launcher</Link>
          <Link href="/forums/zenith-launcher" className="hover:text-ink">Support</Link>
        </div>
      </div>
    </footer>
  );
}
