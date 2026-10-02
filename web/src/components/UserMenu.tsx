'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Avatar } from './Avatar';
import { handlePath } from '@/lib/format';
import type { MiniProfile } from '@/lib/types';

export function UserMenu({ p }: { p: MiniProfile }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const item = 'block rounded-md px-3 py-2 text-sm hover:bg-panel-2';
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-panel-2" aria-expanded={open}>
        <Avatar id={p.avatar} size={30} />
        <span className="hidden text-sm font-semibold sm:inline">{p.username}<span className="font-normal text-muted">#{p.tag}</span></span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-52 rounded-lg border border-line bg-panel p-1.5 shadow-2xl" onClick={() => setOpen(false)}>
          <Link href={handlePath(p)} className={item}>My profile</Link>
          <Link href="/friends" className={item}>Friends</Link>
          <Link href="/settings" className={item}>Settings</Link>
          <form action="/auth/signout" method="post"><button className={`${item} w-full text-left text-muted`}>Sign out</button></form>
        </div>
      )}
    </div>
  );
}
