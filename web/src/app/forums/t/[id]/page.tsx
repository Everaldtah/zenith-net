import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { moderateThread } from '@/app/actions/forum';
import { Avatar } from '@/components/Avatar';
import { Handle, RoleBadge } from '@/components/Handle';
import { Markdown } from '@/components/Markdown';
import { Pagination } from '@/components/Pagination';
import { StatusPill } from '@/components/StatusPill';
import { POSTS_PER_PAGE, getBoard, getPosts, getThread, getViewer } from '@/lib/data';
import { STATUS_LABEL, fmtDate, timeAgo } from '@/lib/format';
import { PostActions, ReplyForm } from './PostActions';

export async function generateMetadata(props: PageProps<'/forums/t/[id]'>): Promise<Metadata> {
  const t = await getThread(Number((await props.params).id));
  return t ? { title: t.title } : {};
}

export default async function ThreadPage(props: PageProps<'/forums/t/[id]'>) {
  const id = Number((await props.params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const page = Math.max(1, Number((await props.searchParams).page) || 1);
  const thread = await getThread(id);
  if (!thread) notFound();
  const [board, { posts, total }, viewer] = await Promise.all([getBoard(thread.board_id), getPosts(id, page), getViewer()]);
  const me = viewer.profile;
  const staff = me?.role === 'dev' || me?.role === 'mod';
  const tracked = board?.kind === 'bugs' || board?.kind === 'suggestions';

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav className="text-sm text-muted">
        <Link href="/forums" className="hover:text-ink">Forums</Link> <span className="mx-1">/</span>
        {board && <Link href={`/forums/${board.id}`} className="hover:text-ink">{board.name}</Link>}
      </nav>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {tracked && <StatusPill status={thread.status} />}
        {thread.pinned && <span className="text-xs font-bold uppercase tracking-wider text-accent">Pinned</span>}
        {thread.locked && <span className="text-xs font-bold uppercase tracking-wider text-muted">Locked</span>}
        {thread.game_version && <span className="text-xs text-muted">Game version {thread.game_version}</span>}
      </div>
      <h1 className="h-display mt-2 text-2xl sm:text-3xl">{thread.title}</h1>

      {staff && (
        <form action={moderateThread} className="card mt-4 flex flex-wrap items-center gap-3 border-accent/30 p-3 text-sm">
          <input type="hidden" name="thread" value={thread.id} /><input type="hidden" name="board" value={thread.board_id} />
          <span className="font-display text-xs font-bold uppercase tracking-wider text-accent">Developer tools</span>
          <select name="status" defaultValue={thread.status} className="input w-auto py-1">
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select name="pinned" defaultValue={thread.pinned ? '1' : '0'} className="input w-auto py-1"><option value="0">Not pinned</option><option value="1">Pinned</option></select>
          <select name="locked" defaultValue={thread.locked ? '1' : '0'} className="input w-auto py-1"><option value="0">Open for replies</option><option value="1">Locked</option></select>
          <button className="btn btn-primary py-1 text-xs">Apply</button>
        </form>
      )}

      <div className="mt-6 space-y-4">
        {posts.map(p => {
          const dev = p.author?.role === 'dev';
          const mine = !!me && p.author_id === me.id;
          return (
            <article key={p.id} id={`p${p.id}`} className={`card flex flex-col gap-4 p-5 sm:flex-row ${dev ? 'border-accent/50 shadow-[0_0_30px_-12px] shadow-accent/50' : ''}`}>
              <div className="flex shrink-0 items-center gap-3 sm:w-40 sm:flex-col sm:items-start">
                {p.author ? <Avatar id={p.author.avatar} size={56} /> : <div className="h-14 w-14 rounded-md bg-panel-2" />}
                <div className="min-w-0">
                  <Handle p={p.author} className="flex-wrap text-sm" />
                  {p.author && <div className="mt-1"><RoleBadge role={p.author.role} /></div>}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted">
                  <a href={`#p${p.id}`} title={fmtDate(p.created_at)} className="hover:text-ink">{timeAgo(p.created_at)}</a>
                  {p.edited_at && !p.deleted && <span>edited {timeAgo(p.edited_at)}</span>}
                </div>
                {p.deleted ? <p className="italic text-muted">This post was deleted.</p> : <Markdown>{p.body}</Markdown>}
                {!p.deleted && (mine || staff) && (
                  <div className="mt-4 border-t border-line pt-3">
                    <PostActions post={p.id} thread={thread.id} board={thread.board_id} body={p.body} isOp={p.is_op} />
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <div className="mt-4"><Pagination page={page} total={total} per={POSTS_PER_PAGE} base={`/forums/t/${id}`} /></div>

      <div className="card mt-8 p-5">
        {thread.locked && !staff ? (
          <p className="text-sm text-muted">This thread is locked.</p>
        ) : me ? (
          <ReplyForm thread={thread.id} />
        ) : viewer.userId ? (
          <p className="text-sm text-muted"><Link href={`/welcome?next=/forums/t/${id}`} className="link">Choose a username</Link> to reply.</p>
        ) : (
          <p className="text-sm text-muted"><Link href={`/login?next=/forums/t/${id}`} className="link">Log in</Link> or <Link href={`/register?next=/forums/t/${id}`} className="link">create an account</Link> to reply.</p>
        )}
      </div>
    </div>
  );
}
