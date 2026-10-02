export function LogoMark({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="zn-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5fb0ff" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="14.5" fill="none" stroke="url(#zn-g)" strokeWidth="2" />
      <path d="M16 3.5 19 13l9.5 3-9.5 3-3 9.5-3-9.5L3.5 16 13 13z" fill="url(#zn-g)" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <LogoMark />
      <span className="font-display text-lg font-bold tracking-[0.18em]">
        ZENITH<span className="text-accent">.NET</span>
      </span>
    </span>
  );
}
