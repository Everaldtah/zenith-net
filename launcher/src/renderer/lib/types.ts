export interface BuildInfo { version: string; url: string; sha256: string; size: number; notes: string; created_at?: string }
export interface Edition { edition: string; name: string; exe: string; detect: string[]; online: boolean; latest: BuildInfo | null }
export interface Game {
  slug: string; name: string; tagline: string; description: string; genre: string; accent: string; site_url: string | null;
  art: { banner: string; card: string; icon: string }; editions: Edition[];
}
export interface Catalog { site: string; launcher: BuildInfo | null; games: Game[] }

export type Phase = 'download' | 'verify' | 'install' | 'uninstall' | 'done' | 'error' | 'cancelled';
export interface JobEvent { key: string; phase: Phase; received?: number; total?: number; speed?: number; error?: string }
export interface EditionStatus { installed: boolean; dir: string | null; version: string | null; external: boolean; running: boolean; busy: Phase | null }

export interface Settings { libraryDir: string; closeToTray: boolean; minimizeOnPlay: boolean; startWithWindows: boolean }

export type Role = 'player' | 'mod' | 'dev';
export interface Profile { id: string; username: string; tag: number; avatar: string; bio: string; role: Role }
export interface Person { id: string; username: string; tag: number; avatar: string }
export interface Friend extends Person { status: 'online' | 'away' | 'busy' | 'offline'; game: string | null; edition: string | null; online: boolean }
export interface Party {
  id: string; leader_id: string; game: string | null; edition: string | null; launch_seq: number; launched_at: string | null;
  members: (Person & { status: string; game: string | null })[]; pending: Person[];
}
export interface Social {
  me: Profile; friends: Friend[];
  incoming: (Person & { created_at: string })[]; outgoing: (Person & { created_at: string })[];
  party: Party | null;
  invites: { party_id: string; from_id: string; username: string; tag: number; avatar: string; size: number; created_at: string }[];
}
