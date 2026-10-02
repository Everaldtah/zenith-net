import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cancelFriend, removeFriend, respondFriend } from '@/app/actions/social';
import { Avatar } from '@/components/Avatar';
import { getCatalog, getSocial, getViewer } from '@/lib/data';
import { handlePath, timeAgo } from '@/lib/format';
import { AddFriendForm } from './AddFriendForm';

export const metadata: Metadata = { title: 'Friends' };

const DOT: Record<string, string> = { online: 'bg-ok', away: 'bg-warn', busy: 'bg-bad', offline: 'bg-muted/40' };

export default async function Friends() {
  const { userId, profile } = await getViewer();
  if (!userId) redirect('/login?next=/friends');
  if (!profile) redirect('/welcome?next=/friends');
  const [social, games] = await Promise.all([getSocial(), getCatalog()]);
  const gameName = (slug: string | null) => games.find(g => g.slug === slug)?.name ?? slug;
  const s = social ?? { friends: [], incoming: [], outgoing: [] };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="h-display text-3xl">Friends</h1>
      <p className="mt-2 text-muted">
        Your tag is <span className="font-semibold text-ink">{profile.username}#{profile.tag}</span>. Share it so people can add you.
        Parties and &ldquo;Play together&rdquo; live in the launcher.
      </p>

      <div className="card mt-6 p-5"><AddFriendForm /></div>

      {s.incoming.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted">Friend requests ({s.incoming.length})</h2>
          <div className="card mt-3 divide-y divide-line">
            {s.incoming.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-4">
                <Avatar id={r.avatar} size={40} />
                <Link href={handlePath(r as never)} className="flex-1 font-semibold hover:underline">{r.username}<span className="font-normal text-muted">#{r.tag}</span></Link>
                <form action={respondFriend} className="flex gap-2">
                  <input type="hidden" name="from" value={r.id} />
                  <button name="accept" value="1" className="btn btn-primary text-xs">Accept</button>
                  <button name="accept" value="0" className="btn text-xs">Decline</button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted">Friends ({s.friends.length})</h2>
        <div className="card mt-3 divide-y divide-line">
          {s.friends.length === 0 && <p className="p-5 text-sm text-muted">No friends yet. Add someone with their Name#1234 tag above.</p>}
          {s.friends.map(f => (
            <div key={f.id} className="flex items-center gap-3 p-4">
              <div className="relative">
                <Avatar id={f.avatar} size={40} />
                <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-panel ${DOT[f.status] ?? DOT.offline}`} />
              </div>
              <div className="min-w-0 flex-1">
                <Link href={handlePath(f as never)} className="font-semibold hover:underline">{f.username}<span className="font-normal text-muted">#{f.tag}</span></Link>
                <div className="text-xs text-muted">{f.game ? <span className="text-ok">Playing {gameName(f.game)}</span> : f.online ? 'Online in the launcher' : 'Offline'}</div>
              </div>
              <form action={removeFriend}>
                <input type="hidden" name="friend" value={f.id} />
                <button className="btn btn-ghost text-xs text-muted hover:text-bad">Remove</button>
              </form>
            </div>
          ))}
        </div>
      </section>

      {s.outgoing.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted">Sent requests</h2>
          <div className="card mt-3 divide-y divide-line">
            {s.outgoing.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-4">
                <Avatar id={r.avatar} size={32} />
                <span className="flex-1">{r.username}<span className="text-muted">#{r.tag}</span> <span className="text-xs text-muted">· {timeAgo(r.created_at)}</span></span>
                <form action={cancelFriend}><input type="hidden" name="to" value={r.id} /><button className="btn btn-ghost text-xs">Cancel</button></form>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
