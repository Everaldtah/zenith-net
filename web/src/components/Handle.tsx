import Link from 'next/link';
import { handlePath } from '@/lib/format';
import type { MiniProfile, Role } from '@/lib/types';

export function RoleBadge({ role }: { role: Role }) {
  if (role === 'dev') return <span className="rounded bg-accent/15 px-1.5 py-0.5 font-display text-[10px] font-bold uppercase tracking-wider text-accent ring-1 ring-accent/40">Developer</span>;
  if (role === 'mod') return <span className="rounded bg-ok/15 px-1.5 py-0.5 font-display text-[10px] font-bold uppercase tracking-wider text-ok ring-1 ring-ok/40">Moderator</span>;
  return null;
}

export function Handle({ p, badge = false, className = '' }: { p: MiniProfile | null; badge?: boolean; className?: string }) {
  if (!p) return <span className="text-muted">[deleted]</span>;
  const staff = p.role === 'dev' || p.role === 'mod';
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <Link href={handlePath(p)} className={`font-semibold hover:underline ${p.role === 'dev' ? 'text-accent' : staff ? 'text-ok' : 'text-ink'}`}>
        {p.username}<span className="font-normal text-muted">#{p.tag}</span>
      </Link>
      {badge && <RoleBadge role={p.role} />}
    </span>
  );
}
