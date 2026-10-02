import { NextResponse, type NextRequest } from 'next/server';
import { getCatalog, getLauncherRelease } from '@/lib/data';

export const revalidate = 60;

// What the launcher reads at start-up and every few minutes: games, editions, latest builds, and its own latest version.
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const [games, launcher] = await Promise.all([getCatalog(), getLauncherRelease()]);
  return NextResponse.json({
    site: origin,
    launcher: launcher && { version: launcher.version, url: launcher.url, sha256: launcher.sha256, size: launcher.size, notes: launcher.notes },
    games: games.map(g => ({
      slug: g.slug, name: g.name, tagline: g.tagline, description: g.description, genre: g.genre, accent: g.accent, site_url: g.site_url,
      art: { banner: `${origin}/games/${g.slug}/banner.webp`, card: `${origin}/games/${g.slug}/card.webp`, icon: `${origin}/games/${g.slug}/icon.webp` },
      editions: g.game_editions.map(e => ({
        edition: e.edition, name: e.name, exe: e.exe, detect: e.detect, online: e.online,
        latest: e.latest && { version: e.latest.version, url: e.latest.url, sha256: e.latest.sha256, size: e.latest.size, notes: e.latest.notes, created_at: e.latest.created_at },
      })),
    })),
  });
}
