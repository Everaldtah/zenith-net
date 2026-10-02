import Link from 'next/link';
import { getViewer } from '@/lib/data';
import { Logo } from './Logo';
import { UserMenu } from './UserMenu';

const NAV = [['/games', 'Games'], ['/forums', 'Forums'], ['/download', 'Download']] as const;

export async function Header() {
  const { userId, profile } = await getViewer();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href="/" aria-label="Zenith.net home"><Logo /></Link>
        <nav className="ml-2 hidden items-center gap-1 sm:flex">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="rounded-md px-3 py-1.5 font-display text-sm font-semibold uppercase tracking-wider text-muted hover:bg-panel-2 hover:text-ink">{label}</Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {profile ? <UserMenu p={profile} />
            : userId ? <Link href="/welcome" className="btn btn-primary">Choose your username</Link>
            : <>
                <Link href="/login" className="btn btn-ghost">Log in</Link>
                <Link href="/register" className="btn btn-primary">Create account</Link>
              </>}
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-line px-2 py-1 sm:hidden">
        {NAV.map(([href, label]) => (
          <Link key={href} href={href} className="rounded-md px-3 py-1 font-display text-xs font-semibold uppercase tracking-wider text-muted">{label}</Link>
        ))}
      </nav>
    </header>
  );
}
