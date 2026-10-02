export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'ok'; children: React.ReactNode }) {
  const c = tone === 'error' ? 'border-bad/40 bg-bad/10 text-[#ffb4c1]' : tone === 'ok' ? 'border-ok/40 bg-ok/10 text-[#a7f3d0]' : 'border-accent/40 bg-accent/10 text-[#bcdcff]';
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-md border px-3 py-2 text-sm ${c}`}>{children}</div>;
}
