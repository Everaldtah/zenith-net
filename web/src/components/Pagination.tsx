import Link from 'next/link';

export function Pagination({ page, total, per, base }: { page: number; total: number; per: number; base: string }) {
  const pages = Math.max(1, Math.ceil(total / per));
  if (pages <= 1) return null;
  const href = (p: number) => (p === 1 ? base : `${base}?page=${p}`);
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter(p => p === 1 || p === pages || Math.abs(p - page) <= 2);
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Pages">
      {nums.map((p, i) => (
        <span key={p} className="flex items-center gap-1">
          {i > 0 && nums[i - 1] !== p - 1 && <span className="px-1 text-muted">…</span>}
          <Link href={href(p)} className={`rounded-md border px-2.5 py-1 ${p === page ? 'border-accent bg-accent/15 text-ink' : 'border-line text-muted hover:text-ink'}`}>{p}</Link>
        </span>
      ))}
    </nav>
  );
}
