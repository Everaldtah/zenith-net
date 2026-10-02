import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getBoard, getBuildHistory, getViewer } from '@/lib/data';
import { NewThreadForm } from './NewThreadForm';

export const metadata: Metadata = { title: 'New thread' };

export default async function NewThread(props: PageProps<'/forums/[board]/new'>) {
  const { board: id } = await props.params;
  const board = await getBoard(id);
  if (!board) notFound();
  const { userId, profile } = await getViewer();
  if (!userId) redirect(`/login?next=${encodeURIComponent(`/forums/${id}/new`)}`);
  if (!profile) redirect(`/welcome?next=${encodeURIComponent(`/forums/${id}/new`)}`);
  if (board.dev_only && profile.role === 'player') redirect(`/forums/${id}`);
  const versions = board.game ? [...new Set((await getBuildHistory(board.game)).map(b => b.version))] : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <nav className="text-sm text-muted">
        <Link href="/forums" className="hover:text-ink">Forums</Link> <span className="mx-1">/</span>
        <Link href={`/forums/${id}`} className="hover:text-ink">{board.name}</Link>
      </nav>
      <h1 className="h-display mt-3 text-3xl">{board.kind === 'bugs' ? 'Report a bug' : 'New thread'}</h1>
      {board.kind === 'bugs' && (
        <p className="mt-2 text-muted">One bug per report. Search the board first; if someone already reported it, add your details there instead.</p>
      )}
      <div className="card mt-6 p-6"><NewThreadForm board={id} kind={board.kind} versions={versions} /></div>
    </div>
  );
}
