import { STATUS_LABEL } from '@/lib/format';

const TONE: Record<string, string> = {
  open: 'bg-panel-2 text-muted ring-line',
  investigating: 'bg-warn/10 text-warn ring-warn/40',
  planned: 'bg-accent-2/10 text-[#b49cff] ring-accent-2/40',
  fixed: 'bg-ok/10 text-ok ring-ok/40',
  answered: 'bg-ok/10 text-ok ring-ok/40',
  wontfix: 'bg-bad/10 text-bad ring-bad/40',
  duplicate: 'bg-panel-2 text-muted ring-line',
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${TONE[status] ?? TONE.open}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
