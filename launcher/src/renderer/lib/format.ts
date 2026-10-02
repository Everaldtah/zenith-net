export const handle = (p: { username: string; tag: number }) => `${p.username}#${p.tag}`;
export function bytes(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)} MB`;
  return `${Math.round(n / 1e3)} KB`;
}
export const speed = (bps: number) => `${(bps / 1e6).toFixed(1)} MB/s`;
export function eta(remaining: number, bps: number) {
  if (!bps) return '';
  const s = Math.round(remaining / bps);
  return s < 60 ? `${s}s left` : `${Math.floor(s / 60)}m ${s % 60}s left`;
}
/** semver-ish compare: 1.10.0 > 1.9.2 */
export function newer(a: string, b: string) {
  const pa = a.split(/[.-]/).map(n => parseInt(n, 10) || 0), pb = b.split(/[.-]/).map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const d = (pa[i] ?? 0) - (pb[i] ?? 0); if (d) return d > 0; }
  return false;
}
