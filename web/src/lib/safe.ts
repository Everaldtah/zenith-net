/** Only same-site paths are allowed as post-login destinations (no //evil.com, no /\evil.com, no absolute URLs). */
export function safeNext(v: unknown, fallback = '/') {
  return typeof v === 'string' && /^\/(?![/\\])/.test(v) ? v : fallback;
}
