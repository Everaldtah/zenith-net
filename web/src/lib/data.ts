import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { publicClient } from '@/lib/supabase/admin';
import type { Board, BoardStats, Build, Game, LauncherRelease, Post, Profile, Thread } from '@/lib/types';

const AUTHOR = 'username, tag, avatar, role';
export const THREADS_PER_PAGE = 30;
export const POSTS_PER_PAGE = 25;

/** The signed-in user (verified JWT claims) and their profile, once per request. */
export const getViewer = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return { userId: null, email: null, profile: null as Profile | null };
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', claims.sub).maybeSingle<Profile>();
  return { userId: claims.sub as string, email: (claims.email as string) ?? null, profile: profile ?? null };
});

/** Pages rendered inside the launcher's Forums/Profile tab drop the site chrome. */
export const isEmbed = cache(async () => (await cookies()).get('zn_embed')?.value === '1');

function withLatest(g: Game): Game {
  return {
    ...g,
    game_editions: [...g.game_editions]
      .sort((a, b) => a.sort - b.sort)
      .map(e => ({ ...e, latest: [...(e.game_builds ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null })),
  };
}

export const getCatalog = cache(async (): Promise<Game[]> => {
  const { data, error } = await publicClient()
    .from('games')
    .select('*, game_editions(*, game_builds(*))')
    .order('sort');
  if (error) { console.error('catalog', error.message); return []; }
  return (data as Game[]).map(withLatest);
});

export const getGame = cache(async (slug: string) => (await getCatalog()).find(g => g.slug === slug) ?? null);

export const getLauncherRelease = cache(async (): Promise<LauncherRelease | null> => {
  const { data } = await publicClient().from('launcher_releases').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle();
  return (data as LauncherRelease) ?? null;
});

export async function getBuildHistory(game: string): Promise<Build[]> {
  const { data } = await publicClient().from('game_builds').select('*').eq('game', game).order('created_at', { ascending: false }).limit(10);
  return (data as Build[]) ?? [];
}

export const getBoards = cache(async () => {
  const sb = publicClient();
  const [{ data: boards }, { data: stats }] = await Promise.all([
    sb.from('forum_boards').select('*').order('sort'),
    sb.from('forum_board_stats').select('*'),
  ]);
  const byId = new Map(((stats as BoardStats[]) ?? []).map(s => [s.id, s]));
  return ((boards as Board[]) ?? []).map(b => ({ ...b, stats: byId.get(b.id) ?? { id: b.id, threads: 0, posts: 0, last_post_at: null } }));
});

export async function getBoard(id: string) {
  const { data } = await publicClient().from('forum_boards').select('*').eq('id', id).maybeSingle();
  return (data as Board) ?? null;
}

const THREAD_SELECT = `*, author:profiles!forum_threads_author_id_fkey(${AUTHOR}), last:profiles!forum_threads_last_post_by_fkey(${AUTHOR})`;

export async function getThreads(boardId: string, page: number) {
  const from = (page - 1) * THREADS_PER_PAGE;
  const { data, count } = await publicClient()
    .from('forum_threads')
    .select(THREAD_SELECT, { count: 'exact' })
    .eq('board_id', boardId)
    .order('pinned', { ascending: false })
    .order('last_post_at', { ascending: false })
    .range(from, from + THREADS_PER_PAGE - 1);
  return { threads: (data as unknown as Thread[]) ?? [], total: count ?? 0 };
}

export async function getThread(id: number) {
  const { data } = await publicClient().from('forum_threads').select(THREAD_SELECT).eq('id', id).maybeSingle();
  return (data as unknown as Thread) ?? null;
}

export async function getPosts(threadId: number, page: number) {
  const from = (page - 1) * POSTS_PER_PAGE;
  const { data, count } = await publicClient()
    .from('forum_posts')
    .select(`*, author:profiles(${AUTHOR})`, { count: 'exact' })
    .eq('thread_id', threadId)
    .order('id')
    .range(from, from + POSTS_PER_PAGE - 1);
  return { posts: (data as unknown as Post[]) ?? [], total: count ?? 0 };
}

export async function getNews(limit = 5) {
  const { data } = await publicClient()
    .from('forum_threads')
    .select(`${THREAD_SELECT}, board:forum_boards!inner(id, name, kind, game)`)
    .eq('board.kind', 'news')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data as unknown as (Thread & { board: Board })[]) ?? [];
}

export async function getProfile(username: string, tag: number) {
  const { data } = await publicClient().from('profiles').select('*').ilike('username', username.replace(/[\\%_]/g, '\\$&')).eq('tag', tag).maybeSingle();
  return (data as Profile) ?? null;
}

export async function getProfileActivity(userId: string) {
  const sb = publicClient();
  const [{ data: stats }, { data: threads }, { count: posts }] = await Promise.all([
    sb.from('game_stats').select('*, games(name)').eq('user_id', userId).order('seconds_played', { ascending: false }),
    sb.from('forum_threads').select('id, title, board_id, reply_count, created_at').eq('author_id', userId).order('created_at', { ascending: false }).limit(8),
    sb.from('forum_posts').select('id', { count: 'exact', head: true }).eq('author_id', userId).eq('deleted', false),
  ]);
  return {
    stats: (stats as { game: string; seconds_played: number; sessions: number; last_played: string; games: { name: string } }[]) ?? [],
    threads: (threads as { id: number; title: string; board_id: string; reply_count: number; created_at: string }[]) ?? [],
    posts: posts ?? 0,
  };
}

export interface Social {
  me: Profile;
  friends: { id: string; username: string; tag: number; avatar: string; status: string; game: string | null; edition: string | null; online: boolean }[];
  incoming: { id: string; username: string; tag: number; avatar: string; created_at: string }[];
  outgoing: { id: string; username: string; tag: number; avatar: string; created_at: string }[];
  party: null | { id: string; leader_id: string; members: { id: string; username: string; tag: number; avatar: string }[] };
}

export async function getSocial(): Promise<Social | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('my_social');
  if (error) { console.error('my_social', error.message); return null; }
  return data as Social | null;
}
