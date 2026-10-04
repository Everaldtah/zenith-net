import Image from 'next/image';
import Link from 'next/link';
import { GameCard } from '@/components/GameCard';
import { Handle } from '@/components/Handle';
import { getCatalog, getNews, getViewer } from '@/lib/data';
import { gameArt, timeAgo } from '@/lib/format';

export const revalidate = 60;

const STEPS = [
  ['Download the launcher', 'One small installer for Windows. It keeps every game and itself up to date.'],
  ['Sign in with Google or email', 'Pick a username. You get a tag like Name#1234 that friends use to find you.'],
  ['Play together', 'Add friends, see who is online, form a party and launch into the same lobby.'],
];

export default async function Home(props: PageProps<'/'>) {
  const deleted = (await props.searchParams).deleted === '1';
  const [games, news, { profile }] = await Promise.all([getCatalog(), getNews(4), getViewer()]);
  return (
    <>
      {deleted && (
        <div role="status" className="border-b border-ok/30 bg-ok/10 px-4 py-2 text-center text-sm text-[#a7f3d0]">Your Zenith.net account has been deleted.</div>
      )}
      <section className="relative isolate overflow-hidden border-b border-line">
        <Image src={gameArt('zenith-umbra', 'banner')} alt="" fill priority sizes="100vw" className="-z-10 object-cover opacity-55" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-bg via-bg/80 to-bg/10" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-bg to-transparent" />
        <div className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
          <p className="eyebrow">Your games. Your friends. One launcher.</p>
          <h1 className="h-display mt-3 max-w-2xl text-4xl leading-tight sm:text-6xl">
            Welcome to <span className="bg-gradient-to-r from-[#5fb0ff] to-accent-2 bg-clip-text text-transparent">Zenith.net</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-[#c3c9d8]">
            Install ZENITH//UMBRA and Nebula Dominion, keep them updated, add friends and launch into games together.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/download" className="btn btn-primary btn-lg">Download the launcher</Link>
            {!profile && <Link href="/register" className="btn btn-lg">Create a free account</Link>}
          </div>
          <p className="mt-3 text-xs text-muted">Windows 10 / 11 · 64-bit · free</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-14">
        <div className="flex items-end justify-between">
          <h2 className="h-display text-2xl">Games</h2>
          <Link href="/games" className="link text-sm">All games</Link>
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {games.map(g => <GameCard key={g.slug} g={g} />)}
        </div>
      </section>

      <section className="mx-auto mt-16 grid max-w-6xl gap-8 px-4 lg:grid-cols-[1fr_380px]">
        <div>
          <h2 className="h-display text-2xl">How it works</h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-3">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="card p-5">
                <div className="font-display text-3xl font-bold text-accent/80">0{i + 1}</div>
                <div className="mt-2 font-semibold">{t}</div>
                <p className="mt-1.5 text-sm text-muted">{d}</p>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h2 className="h-display text-2xl">News</h2>
          <div className="card mt-5 divide-y divide-line">
            {news.length === 0 && <p className="p-5 text-sm text-muted">No news yet. Patch notes and announcements will show up here.</p>}
            {news.map(n => (
              <Link key={n.id} href={`/forums/t/${n.id}`} className="block p-4 hover:bg-panel-2">
                <div className="text-xs text-muted">{n.board.name} · {timeAgo(n.created_at)}</div>
                <div className="mt-1 font-semibold">{n.title}</div>
                <div className="mt-1 text-xs"><Handle p={n.author} /></div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
