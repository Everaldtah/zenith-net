import type { Metadata } from 'next';
import { GameCard } from '@/components/GameCard';
import { getCatalog } from '@/lib/data';

export const revalidate = 60;
export const metadata: Metadata = { title: 'Games' };

export default async function Games() {
  const games = await getCatalog();
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="eyebrow">Library</p>
      <h1 className="h-display mt-2 text-3xl">All games</h1>
      <p className="mt-2 text-muted">Every game on Zenith.net installs and updates through the launcher. Most also run in your browser.</p>
      <div className="mt-8 grid gap-5 md:grid-cols-2">{games.map(g => <GameCard key={g.slug} g={g} />)}</div>
    </div>
  );
}
