import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getBoards, getCatalog } from '@/lib/data';
import { gameArt, timeAgo } from '@/lib/format';
import type { Board, BoardStats } from '@/lib/types';

export const revalidate = 30;
export const metadata: Metadata = { title: 'Forums' };

const KIND_ICON: Record<string, string> = { news: '📣', discussion: '💬', bugs: '🐞', suggestions: '💡', help: '🛠️' };

function BoardRow({ b }: { b: Board & { stats: BoardStats } }) {
  return (
    <Link href={`/forums/${b.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-panel-2">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line bg-[#0a0e16] text-lg" aria-hidden="true">{KIND_ICON[b.kind]}</span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{b.name}</div>
        <div className="truncate text-sm text-muted">{b.description}</div>
      </div>
      <div className="hidden w-24 text-right text-sm sm:block">
        <div>{b.stats.threads.toLocaleString()}</div><div className="text-xs text-muted">threads</div>
      </div>
      <div className="hidden w-28 text-right text-xs text-muted md:block">{b.stats.last_post_at ? timeAgo(b.stats.last_post_at) : '-'}</div>
    </Link>
  );
}

export default async function Forums() {
  const [boards, games] = await Promise.all([getBoards(), getCatalog()]);
  const site = boards.filter(b => !b.game);
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <p className="eyebrow">Community</p>
      <h1 className="h-display mt-2 text-3xl">Forums</h1>
      <p className="mt-2 text-muted">Report bugs, suggest ideas and find people to play with. The developer reads every bug report.</p>

      {games.map(g => {
        const mine = boards.filter(b => b.game === g.slug);
        if (!mine.length) return null;
        return (
          <section key={g.slug} className="mt-10">
            <div className="flex items-center gap-3">
              <Image src={gameArt(g.slug, 'icon')} alt="" width={36} height={36} className="rounded-lg" />
              <h2 className="h-display text-xl">{g.name}</h2>
            </div>
            <div className="card mt-3 divide-y divide-line overflow-hidden">{mine.map(b => <BoardRow key={b.id} b={b} />)}</div>
          </section>
        );
      })}

      <section className="mt-10">
        <h2 className="h-display text-xl">Zenith.net</h2>
        <div className="card mt-3 divide-y divide-line overflow-hidden">{site.map(b => <BoardRow key={b.id} b={b} />)}</div>
      </section>
    </div>
  );
}
