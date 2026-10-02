// Right-hand social panel: me + status, party, invites, friend requests, friends list.
import { useState } from 'react';
import { handle } from '../lib/format';
import { sb } from '../lib/sb';
import type { Friend, Game, Social } from '../lib/types';
import { Avatar, Notice, STATUS_DOT } from './bits';

type Status = 'online' | 'away' | 'busy';

export function FriendsPanel({ social, games, myStatus, setMyStatus, refresh, onProfile, toast }: {
  social: Social | null; games: Game[]; myStatus: Status; setMyStatus: (s: Status) => void; refresh: () => void;
  onProfile: (p: { username: string; tag: number }) => void; toast: (msg: string, tone?: 'info' | 'error' | 'ok') => void;
}) {
  const [adding, setAdding] = useState('');
  const [addMsg, setAddMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  if (!social) return <aside className="w-80 shrink-0 border-l border-line bg-[#090c13]" />;

  const me = social.me;
  const party = social.party;
  const isLeader = party?.leader_id === me.id;
  const inMyParty = new Set(party?.members.map(m => m.id) ?? []);
  const pendingInParty = new Set(party?.pending.map(m => m.id) ?? []);
  const gameName = (slug: string | null) => games.find(g => g.slug === slug)?.name ?? slug ?? '';

  async function call(fn: string, args: Record<string, unknown>, ok?: string) {
    const { error } = await sb.rpc(fn, args);
    if (error) toast(error.message, 'error'); else if (ok) toast(ok, 'ok');
    refresh();
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const h = adding.trim();
    const { data, error } = await sb.rpc('send_friend_request', { p_handle: h });
    if (error) setAddMsg({ tone: 'error', text: error.message });
    else {
      setAddMsg({ tone: 'ok', text: data === 'accepted' ? `You and ${h} are now friends.` : data === 'already' ? `${h} is already a friend.` : `Request sent to ${h}.` });
      setAdding('');
      refresh();
    }
  }

  const playing = social.friends.filter(f => f.online && f.game);
  const online = social.friends.filter(f => f.online && !f.game);
  const offline = social.friends.filter(f => !f.online);

  const FriendRow = ({ f }: { f: Friend }) => (
    <div className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-panel-2">
      <div className="relative">
        <Avatar id={f.avatar} size={34} className={f.online ? '' : 'opacity-50 grayscale'} />
        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#090c13] ${f.game ? 'bg-accent' : STATUS_DOT[f.status]}`} />
      </div>
      <button onClick={() => onProfile(f)} className="min-w-0 flex-1 text-left">
        <div className={`truncate text-sm font-semibold ${f.online ? '' : 'text-muted'}`}>{f.username}<span className="font-normal text-muted">#{f.tag}</span></div>
        <div className={`truncate text-[11px] ${f.game ? 'text-accent' : 'text-muted'}`}>
          {f.game ? gameName(f.game) : f.online ? (f.status === 'online' ? 'Online' : f.status === 'away' ? 'Away' : 'Busy') : 'Offline'}
        </div>
      </button>
      {f.online && !inMyParty.has(f.id) && !pendingInParty.has(f.id) && (
        <button onClick={() => call('party_invite', { p_user: f.id }, `Party invite sent to ${f.username}`)}
          className="hidden rounded-md border border-line px-2 py-1 text-[11px] font-semibold text-muted hover:border-accent hover:text-ink group-hover:block">Invite</button>
      )}
      {pendingInParty.has(f.id) && <span className="text-[11px] text-muted">Invited</span>}
    </div>
  );

  const section = (title: string, n?: number) => (
    <div className="mt-4 px-2 pb-1 font-display text-[11px] font-bold uppercase tracking-[0.18em] text-muted">{title}{n !== undefined && <span className="ml-1 opacity-60">({n})</span>}</div>
  );

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-line bg-[#090c13]">
      <div className="flex items-center gap-3 border-b border-line p-4">
        <Avatar id={me.avatar} size={44} />
        <div className="min-w-0 flex-1">
          <button title="Copy your tag" onClick={() => { navigator.clipboard.writeText(handle(me)); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="block max-w-full truncate text-left font-semibold">
            {me.username}<span className="font-normal text-muted">#{me.tag}</span>{copied && <span className="ml-2 text-[11px] text-ok">copied</span>}
          </button>
          <select value={myStatus} onChange={e => setMyStatus(e.target.value as Status)} className="mt-0.5 -ml-1 rounded bg-transparent px-1 text-xs text-muted outline-none hover:text-ink">
            <option value="online">● Online</option><option value="away">● Away</option><option value="busy">● Busy</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {social.invites.map(inv => (
          <div key={inv.party_id} className="anim-in m-1 rounded-lg border border-accent-2/50 bg-accent-2/10 p-3">
            <div className="flex items-center gap-2 text-sm"><Avatar id={inv.avatar} size={28} /><span><b>{inv.username}</b> invited you to their party ({inv.size})</span></div>
            <div className="mt-2 flex gap-2">
              <button onClick={() => call('party_accept', { p_party: inv.party_id })} className="btn btn-primary flex-1 py-1.5 text-xs">Join party</button>
              <button onClick={() => call('party_decline', { p_party: inv.party_id })} className="btn flex-1 py-1.5 text-xs">Decline</button>
            </div>
          </div>
        ))}

        {party && (
          <>
            {section('Party', party.members.length)}
            <div className="m-1 rounded-lg border border-line bg-panel p-2">
              {party.members.map(m => (
                <div key={m.id} className="group flex items-center gap-2 rounded-md px-1.5 py-1">
                  <Avatar id={m.avatar} size={28} />
                  <span className="min-w-0 flex-1 truncate text-sm">{m.username}{m.id === party.leader_id && <span title="Party leader" className="ml-1 text-warn">♛</span>}</span>
                  {m.game && <span className="truncate text-[11px] text-accent">{gameName(m.game)}</span>}
                  {isLeader && m.id !== me.id && <button onClick={() => call('party_kick', { p_user: m.id })} className="hidden text-[11px] text-muted hover:text-bad group-hover:block">Kick</button>}
                </div>
              ))}
              {party.pending.map(m => (
                <div key={m.id} className="flex items-center gap-2 px-1.5 py-1 opacity-60"><Avatar id={m.avatar} size={28} /><span className="text-sm">{m.username}</span><span className="ml-auto text-[11px] text-muted">invited…</span></div>
              ))}
              <div className="mt-2 flex items-center justify-between border-t border-line px-1.5 pt-2 text-xs">
                <span className="text-muted">{isLeader ? 'Pick a game and press Play together.' : 'The leader picks the game.'}</span>
                <button onClick={() => call('party_leave', {})} className="font-semibold text-muted hover:text-bad">Leave</button>
              </div>
            </div>
          </>
        )}

        {social.incoming.length > 0 && section('Friend requests', social.incoming.length)}
        {social.incoming.map(r => (
          <div key={r.id} className="m-1 flex items-center gap-2 rounded-lg bg-panel p-2">
            <Avatar id={r.avatar} size={30} />
            <span className="min-w-0 flex-1 truncate text-sm">{r.username}<span className="text-muted">#{r.tag}</span></span>
            <button onClick={() => call('respond_friend_request', { p_from: r.id, p_accept: true }, `You and ${r.username} are friends`)} className="rounded-md bg-accent px-2 py-1 text-[11px] font-semibold text-white">Accept</button>
            <button onClick={() => call('respond_friend_request', { p_from: r.id, p_accept: false })} className="rounded-md px-1.5 py-1 text-[11px] text-muted hover:text-ink" aria-label="Decline">✕</button>
          </div>
        ))}

        {playing.length > 0 && section('Playing', playing.length)}
        {playing.map(f => <FriendRow key={f.id} f={f} />)}
        {section('Online', online.length)}
        {online.map(f => <FriendRow key={f.id} f={f} />)}
        {online.length === 0 && playing.length === 0 && <p className="px-2 py-1 text-xs text-muted">Nobody else is online right now.</p>}
        {offline.length > 0 && section('Offline', offline.length)}
        {offline.map(f => <FriendRow key={f.id} f={f} />)}
        {social.friends.length === 0 && <p className="px-2 py-2 text-xs text-muted">Add friends with their Name#1234 tag below. Share yours by clicking your name above.</p>}
        {social.outgoing.length > 0 && (
          <>
            {section('Sent requests', social.outgoing.length)}
            {social.outgoing.map(r => (
              <div key={r.id} className="flex items-center gap-2 px-2 py-1 text-xs text-muted">
                <span className="flex-1 truncate">{handle(r)}</span>
                <button onClick={() => call('cancel_friend_request', { p_to: r.id })} className="hover:text-ink">Cancel</button>
              </div>
            ))}
          </>
        )}
      </div>

      <form onSubmit={add} className="space-y-2 border-t border-line p-3">
        {addMsg && <Notice tone={addMsg.tone}>{addMsg.text}</Notice>}
        <div className="flex gap-2">
          <input value={adding} onChange={e => { setAdding(e.target.value); setAddMsg(null); }} placeholder="Add friend: Name#1234" className="input py-1.5" spellCheck={false} />
          <button className="btn btn-primary px-3 py-1.5" disabled={!/^[A-Za-z][A-Za-z0-9_]{2,11}#\d{4}$/.test(adding.trim())} aria-label="Send friend request">+</button>
        </div>
      </form>
    </aside>
  );
}
