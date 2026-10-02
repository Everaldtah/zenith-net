import { NextResponse, type NextRequest } from 'next/server';
import { getCatalog, getLauncherRelease } from '@/lib/data';
import { bump } from '@/lib/redis';

// Counts a download in Redis, then sends the browser to the GitHub Releases file.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  if (q.get('launcher')) {
    const r = await getLauncherRelease();
    if (!r) return NextResponse.redirect(new URL('/download', req.url));
    await bump('dl:launcher');
    return NextResponse.redirect(r.url);
  }
  const game = (await getCatalog()).find(g => g.slug === q.get('game'));
  const ed = game?.game_editions.find(e => e.edition === q.get('edition'));
  if (!game || !ed?.latest) return NextResponse.redirect(new URL('/games', req.url));
  await bump(`dl:${game.slug}:${ed.edition}`);
  return NextResponse.redirect(ed.latest.url);
}
