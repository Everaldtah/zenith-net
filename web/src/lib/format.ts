import type { MiniProfile } from './types';

export const handle = (p: Pick<MiniProfile, 'username' | 'tag'>) => `${p.username}#${p.tag}`;
/** URL form of a handle: Name#1234 -> Name-1234 */
export const handlePath = (p: Pick<MiniProfile, 'username' | 'tag'>) => `/u/${encodeURIComponent(`${p.username}-${p.tag}`)}`;
export function parseHandlePath(s: string) {
  const m = /^([A-Za-z][A-Za-z0-9_]{2,11})-(\d{4})$/.exec(decodeURIComponent(s));
  return m ? { username: m[1], tag: Number(m[2]) } : null;
}

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export function bytes(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} GB`;
  if (n >= 1e6) return `${Math.round(n / 1e6)} MB`;
  return `${Math.round(n / 1e3)} KB`;
}

export function hours(sec: number) {
  if (sec < 3600) return `${Math.max(1, Math.round(sec / 60))} min`;
  return `${(sec / 3600).toFixed(sec < 36000 ? 1 : 0)} h`;
}

export const STATUS_LABEL: Record<string, string> = {
  open: 'Open', investigating: 'Investigating', planned: 'Planned', fixed: 'Fixed', wontfix: "Won't fix", duplicate: 'Duplicate', answered: 'Answered',
};

// Game pictures live in /public/games/<slug>/<kind><version>.webp. Bump a game's version when its pictures change:
// a new file name gets past the image optimiser, the CDN and launchers that cached the old one.
const ART_VERSION: Record<string, string> = { 'zenith-umbra': '-v2' };
export const gameArt = (slug: string, kind: 'banner' | 'card' | 'icon' | 'art2') => `/games/${slug}/${kind}${ART_VERSION[slug] ?? ''}.webp`;
/** games with a second wide picture (shown on the game's page) */
export const HAS_ART2 = new Set(['zenith-umbra']);

/** avatar ids are file names in /public/avatars */
export const AVATARS = [
  'hayate', 'tomoe', 'mirei', 'haruto', 'seiran', 'yuzu', 'kaien', 'raijin', 'enra', 'hex', 'vorn', 'nocturne', 'hibiki', 'kagemaru',
  'gorgoth', 'tenkai', 'gantetsu', 'qelvaris', 'nd_juggernaut', 'nd_titan', 'nd_trooper', 'nd_wyvern', 'nd_hierophant', 'nd_matron',
  'nd_dreadnought', 'nd_seeker',
];
export const avatarSrc = (id: string) => `/avatars/${AVATARS.includes(id) ? id : 'hayate'}.webp`;
