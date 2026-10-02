import Image from 'next/image';
import Link from 'next/link';
import type { Game } from '@/lib/types';

export function GameCard({ g }: { g: Game }) {
  return (
    <Link href={`/games/${g.slug}`} className="group card overflow-hidden transition hover:-translate-y-0.5 hover:border-[color:var(--a)]" style={{ ['--a' as string]: g.accent }}>
      <div className="relative aspect-video overflow-hidden">
        <Image src={`/games/${g.slug}/card.webp`} alt="" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover transition duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-panel via-panel/10 to-transparent" />
        <Image src={`/games/${g.slug}/icon.webp`} alt="" width={52} height={52} className="absolute bottom-3 left-4 rounded-lg border border-white/10 shadow-lg" />
      </div>
      <div className="p-5 pt-3">
        <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: g.accent }}>{g.genre}</div>
        <h3 className="h-display mt-1 text-xl">{g.name}</h3>
        <p className="mt-2 text-sm text-muted">{g.tagline}</p>
      </div>
    </Link>
  );
}
