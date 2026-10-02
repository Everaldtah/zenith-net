import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Handle } from '@/components/Handle';
import { Pagination } from '@/components/Pagination';
import { StatusPill } from '@/components/StatusPill';
import { THREADS_PER_PAGE, getBoard, getGame, getThreads, getViewer } from '@/lib/data';
import { timeAgo } from '@/lib/format';

export async function generateMetadata(props: PageProps<'/forums/[board]'>): Promise<Metadata> {
  const b = await getBoard((await props.params).board);
  return b ? { title: b.name } : {};
}

export default async function BoardPage(props: PageProps<'/forums/[board]'>) {
  const { board: id } = await props.params;
  const page = Math.max(1, Number((await props.searchParams).page) || 1);
  const board = await getBoard(id);
  if (!board) notFound();
  const [{ threads, total }, game, { profile }] = await Promise.all([getThreads(id, page), board.game ? getGame(board.game) : null, getViewer()]);
  const canPost = !board.dev_only || profile?.role === 'dev' || profile?.role === 'mod';
  const tracked = board.kind === 'bugs' || board.kind === 'suggestions';

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav className="text-sm text-muted">
        <Link href="/forums" className="hover:text-ink">Forums</Link> <span className="mx-1">/</span>
        {game ? <Link href={`/games/${game.slug}`} className="hover:text-ink">{game.name}</Link> : 'Zenith.net'}
      </nav>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h-display text-3xl">{board.name}</h1>
          <p className="mt-1.5 max-w-2xl text-muted">{board.description}</p>
        </div>
        {canPost && <Link href={`/forums/${id}/new`} className="btn btn-primary">{board.kind === 'bugs' ? 'Report a bug' : 'New thread'}</Link>}
      </div>

      <div className="card mt-6 divide-y divide-line overflow-hidden">
        {threads.length === 0 && (
          <div className="p-10 text-center text-muted">
            No threads yet.{canPost && <> <Link href={`/forums/${id}/new`} className="link">Start the first one.</Link></>}
          </div>
        )}
        {threads.map(t => (
          <div key={t.id} className={`flex items-center gap-4 px-5 py-3.5 ${t.pinned ? 'bg-accent/[0.04]' : ''}`}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {t.pinned && <span className="text-xs font-bold uppercase tracking-wider text-accent">Pinned</span>}
                {tracked && <StatusPill status={t.status} />}
                {t.locked && <span title="Locked" aria-label="Locked">🔒</span>}
                <Link href={`/forums/t/${t.id}`} className="font-semibold hover:underline">{t.title}</Link>
                {t.dev_replied && <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">Dev response</span>}
              </div>
              <div className="mt-1 text-xs text-muted">
                <Handle p={t.author} /> · {timeAgo(t.created_at)}{t.game_version && <> · v{t.game_version}</>}
              </div>
            </div>
            <div className="hidden w-16 text-right text-sm sm:block">{t.reply_count}<div className="text-xs text-muted">replies</div></div>
            <div className="hidden w-36 text-right text-xs text-muted md:block">
              {timeAgo(t.last_post_at)}{t.last && <div className="truncate"><Handle p={t.last} /></div>}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4"><Pagination page={page} total={total} per={THREADS_PER_PAGE} base={`/forums/${id}`} /></div>
    </div>
  );
}
