export type Role = 'player' | 'mod' | 'dev';
export interface Profile { id: string; username: string; tag: number; avatar: string; bio: string; role: Role; created_at: string }
export type MiniProfile = Pick<Profile, 'username' | 'tag' | 'avatar' | 'role'>;

export interface Build { id: number; game: string; edition: string; version: string; url: string; sha256: string; size: number; notes: string; created_at: string; kind?: 'installer' | 'chunked'; install_size?: number | null }
export interface Edition { game: string; edition: string; name: string; exe: string; detect: string[]; online: boolean; sort: number; note?: string; game_builds?: Build[]; latest?: Build | null; latestInstaller?: Build | null }
export interface Game {
  slug: string; name: string; tagline: string; description: string; genre: string; accent: string; site_url: string | null; sort: number;
  game_editions: Edition[];
}
export interface LauncherRelease { version: string; url: string; sha256: string; size: number; notes: string; created_at: string }

export type BoardKind = 'news' | 'discussion' | 'bugs' | 'suggestions' | 'help';
export interface Board { id: string; game: string | null; name: string; description: string; kind: BoardKind; dev_only: boolean; sort: number }
export interface BoardStats { id: string; threads: number; posts: number; last_post_at: string | null }
export type ThreadStatus = 'open' | 'investigating' | 'planned' | 'fixed' | 'wontfix' | 'duplicate' | 'answered';
export interface Thread {
  id: number; board_id: string; author_id: string | null; title: string; status: ThreadStatus; game_version: string | null;
  pinned: boolean; locked: boolean; reply_count: number; dev_replied: boolean; last_post_at: string; created_at: string;
  author: MiniProfile | null; last: MiniProfile | null;
}
export interface Post { id: number; thread_id: number; author_id: string | null; body: string; is_op: boolean; deleted: boolean; created_at: string; edited_at: string | null; author: MiniProfile | null }
