import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requestFromProfile } from '@/app/actions/social';
import { Avatar } from '@/components/Avatar';
import { RoleBadge } from '@/components/Handle';
import { getProfile, getProfileActivity, getSocial, getViewer } from '@/lib/data';
import { fmtDate, handle, handlePath, hours, parseHandlePath, timeAgo } from '@/lib/format';

export async function generateMetadata(props: PageProps<'/u/[handle]'>): Promise<Metadata> {
  const h = parseHandlePath((await props.params).handle);
  return h ? { title: `${h.username}#${h.tag}` } : {};
}

export default async function ProfilePage(props: PageProps<'/u/[handle]'>) {
  const h = parseHandlePath((await props.params).handle);
  if (!h) notFound();
  const p = await getProfile(h.username, h.tag);
  if (!p) notFound();
  const [activity, viewer] = await Promise.all([getProfileActivity(p.id), getViewer()]);
  const self = viewer.profile?.id === p.id;
  const social = viewer.profile && !self ? await getSocial() : null;
  const relation = !social ? null
    : social.friends.some(f => f.id === p.id) ? 'friend'
    : social.outgoing.some(f => f.id === p.id) ? 'pending'
    : social.incoming.some(f => f.id === p.id) ? 'incoming' : 'none';
  const totalSec = activity.stats.reduce((a, s) => a + Number(s.seconds_played), 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="card relative overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-accent/25 via-accent-2/20 to-transparent" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end">
          <Avatar id={p.avatar} size={112} className="rounded-xl border-2 border-panel shadow-xl" />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="h-display text-3xl">{p.username}<span className="text-muted">#{p.tag}</span></h1>
              <RoleBadge role={p.role} />
            </div>
            <p className="mt-1 text-sm text-muted">Member since {fmtDate(p.created_at)}</p>
            {p.bio && <p className="mt-3 max-w-2xl whitespace-pre-line">{p.bio}</p>}
          </div>
          <div>
            {self && <Link href="/settings" className="btn">Edit profile</Link>}
            {relation === 'friend' && <span className="btn pointer-events-none text-ok">✓ Friends</span>}
            {relation === 'pending' && <span className="btn pointer-events-none text-muted">Request sent</span>}
            {(relation === 'none' || relation === 'incoming') && (
              <form action={requestFromProfile}>
                <input type="hidden" name="handle" value={handle(p)} /><input type="hidden" name="path" value={handlePath(p)} />
                <button className="btn btn-primary">{relation === 'incoming' ? 'Accept friend request' : 'Add friend'}</button>
              </form>
            )}
            {!viewer.userId && <Link href={`/login?next=${encodeURIComponent(handlePath(p))}`} className="btn">Log in to add friend</Link>}
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <section>
          <h2 className="h-display text-xl">Games played</h2>
          <div className="mt-3 space-y-3">
            {activity.stats.length === 0 && <p className="card p-5 text-sm text-muted">No play time recorded yet. Time spent in games launched from the Zenith.net launcher shows up here.</p>}
            {activity.stats.map(s => (
              <Link key={s.game} href={`/games/${s.game}`} className="card flex items-center gap-4 p-4 hover:border-accent/50">
                <Image src={`/games/${s.game}/icon.webp`} alt="" width={48} height={48} className="rounded-lg" />
                <div className="flex-1">
                  <div className="font-semibold">{s.games?.name ?? s.game}</div>
                  <div className="text-xs text-muted">Last played {timeAgo(s.last_played)} · {s.sessions} sessions</div>
                </div>
                <div className="text-right"><div className="font-display text-lg font-bold">{hours(Number(s.seconds_played))}</div></div>
              </Link>
            ))}
          </div>

          <h2 className="h-display mt-10 text-xl">Recent threads</h2>
          <div className="card mt-3 divide-y divide-line">
            {activity.threads.length === 0 && <p className="p-5 text-sm text-muted">No threads yet.</p>}
            {activity.threads.map(t => (
              <Link key={t.id} href={`/forums/t/${t.id}`} className="flex justify-between gap-4 p-4 hover:bg-panel-2">
                <span className="truncate font-medium">{t.title}</span>
                <span className="shrink-0 text-xs text-muted">{t.reply_count} replies · {timeAgo(t.created_at)}</span>
              </Link>
            ))}
          </div>
        </section>
        <aside className="card h-fit p-5 text-sm">
          <div className="flex justify-between"><span className="text-muted">Total play time</span><span className="font-semibold">{totalSec ? hours(totalSec) : '-'}</span></div>
          <div className="mt-2 flex justify-between"><span className="text-muted">Forum posts</span><span className="font-semibold">{activity.posts}</span></div>
          <div className="mt-2 flex justify-between"><span className="text-muted">Games</span><span className="font-semibold">{activity.stats.length}</span></div>
        </aside>
      </div>
    </div>
  );
}
