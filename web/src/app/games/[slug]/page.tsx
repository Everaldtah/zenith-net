import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Markdown } from '@/components/Markdown';
import { getBoards, getBuildHistory, getGame } from '@/lib/data';
import { counters } from '@/lib/redis';
import { bytes, fmtDate } from '@/lib/format';

export const revalidate = 60;

export async function generateMetadata(props: PageProps<'/games/[slug]'>): Promise<Metadata> {
  const g = await getGame((await props.params).slug);
  return g ? { title: g.name, description: g.tagline } : {};
}

export default async function GamePage(props: PageProps<'/games/[slug]'>) {
  const { slug } = await props.params;
  const g = await getGame(slug);
  if (!g) notFound();
  const [boards, history, downloads] = await Promise.all([
    getBoards(), getBuildHistory(slug), counters(g.game_editions.map(e => `dl:${g.slug}:${e.edition}`)),
  ]);
  const myBoards = boards.filter(b => b.game === slug);
  const totalDownloads = downloads.reduce((a, b) => a + b, 0);

  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-line">
        <Image src={`/games/${slug}/banner.webp`} alt="" fill priority sizes="100vw" className="-z-10 object-cover opacity-60" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-bg via-bg/60 to-bg/20" />
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-10 pt-28 sm:flex-row sm:items-end">
          <Image src={`/games/${slug}/icon.webp`} alt="" width={96} height={96} className="rounded-2xl border border-white/10 shadow-2xl" />
          <div className="flex-1">
            <div className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: g.accent }}>{g.genre}</div>
            <h1 className="h-display mt-1 text-4xl sm:text-5xl">{g.name}</h1>
            <p className="mt-2 max-w-2xl text-[#c3c9d8]">{g.tagline}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`zenithnet://game/${slug}`} className="btn btn-primary btn-lg">Open in launcher</a>
            {g.site_url && <a href={g.site_url} target="_blank" rel="noopener noreferrer" className="btn btn-lg">Play in browser</a>}
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[1fr_340px]">
        <div>
          <h2 className="h-display text-xl">About</h2>
          <p className="mt-3 leading-relaxed text-[#c3c9d8]">{g.description}</p>

          <h2 className="h-display mt-10 text-xl">Editions</h2>
          <div className="card mt-3 divide-y divide-line">
            {g.game_editions.map(e => (
              <div key={e.edition} className="flex flex-wrap items-center gap-3 p-4">
                <div className="flex-1">
                  <div className="font-semibold">{e.name}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    {e.latest ? <>Version {e.latest.version} · {bytes(e.latest.size)} · {fmtDate(e.latest.created_at)}</> : 'Coming soon to the launcher'}
                    {e.online && <> · <span className="text-ok">Party play</span></>}
                  </div>
                </div>
                {e.latest && <a href={`/api/download?game=${slug}&edition=${e.edition}`} className="btn text-xs">Standalone installer</a>}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            The launcher is the easy way: it installs, updates and launches every edition and lets you play with friends.{' '}
            <Link href="/download" className="link">Get the launcher</Link>
          </p>

          <h2 className="h-display mt-10 text-xl">Patch notes</h2>
          <div className="mt-3 space-y-3">
            {history.length === 0 && <p className="text-sm text-muted">No releases yet.</p>}
            {history.map(b => (
              <div key={b.id} className="card p-4">
                <div className="text-sm">
                  <span className="font-semibold">{g.game_editions.find(e => e.edition === b.edition)?.name}</span>{' '}
                  <span className="text-muted">v{b.version} · {fmtDate(b.created_at)}</span>
                </div>
                {b.notes && <div className="mt-2 text-sm"><Markdown>{b.notes}</Markdown></div>}
              </div>
            ))}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="card p-5">
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-muted">Community</h3>
            <ul className="mt-3 space-y-1">
              {myBoards.map(b => (
                <li key={b.id}>
                  <Link href={`/forums/${b.id}`} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-panel-2">
                    <span>{b.name}</span><span className="text-xs text-muted">{b.stats.threads}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link href={`/forums/${slug}-bugs/new`} className="btn mt-4 w-full">Report a bug</Link>
          </div>
          <div className="card p-5 text-sm">
            <div className="flex justify-between"><span className="text-muted">Developer</span><span>EveraldTah</span></div>
            <div className="mt-2 flex justify-between"><span className="text-muted">Platform</span><span>Windows · Web</span></div>
            {totalDownloads > 0 && (
              <div className="mt-2 flex justify-between"><span className="text-muted">Downloads</span><span>{totalDownloads.toLocaleString()}</span></div>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
