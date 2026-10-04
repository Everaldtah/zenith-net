import { NextResponse, type NextRequest } from 'next/server';
import { getCatalog, getLauncherRelease } from '@/lib/data';
import { gameArt } from '@/lib/format';
import type { Build } from '@/lib/types';

export const revalidate = 60;

// What the launcher reads at start-up and every few minutes: games, editions, latest builds, and its own latest version.
// ?chunked=1 = the launcher can install chunked builds (1.1.0+). Without it, chunked builds are left out, and so are
// editions that only have chunked builds: launcher 1.0.0 would download the manifest and try to run it as an installer.
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const chunked = req.nextUrl.searchParams.get('chunked') === '1';
  const pick = (e: { latest?: Build | null; latestInstaller?: Build | null }) => (chunked ? e.latest : e.latestInstaller) ?? null;
  const [games, launcher] = await Promise.all([getCatalog(), getLauncherRelease()]);
  return NextResponse.json({
    site: origin,
    launcher: launcher && { version: launcher.version, url: launcher.url, sha256: launcher.sha256, size: launcher.size, notes: launcher.notes },
    games: games.map(g => ({
      slug: g.slug, name: g.name, tagline: g.tagline, description: g.description, genre: g.genre, accent: g.accent, site_url: g.site_url,
      art: { banner: origin + gameArt(g.slug, 'banner'), card: origin + gameArt(g.slug, 'card'), icon: origin + gameArt(g.slug, 'icon') },
      editions: g.game_editions.filter(e => chunked || e.latestInstaller || !e.latest).map(e => {
        const b = pick(e);
        return {
          edition: e.edition, name: e.name, note: e.note ?? '', exe: e.exe, detect: e.detect, online: e.online,
          latest: b && {
            version: b.version, url: b.url, sha256: b.sha256, size: b.size, notes: b.notes, created_at: b.created_at,
            ...(b.kind === 'chunked' ? { kind: 'chunked', install_size: b.install_size ?? b.size } : {}),
          },
        };
      }),
    })),
  }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
}
