// Resumable download with a running SHA-256, through Electron's network stack (follows GitHub's redirect to its CDN,
// honours the system proxy). A partial file is kept as <dest>.part so an interrupted download continues where it stopped.
import { net } from 'electron';
import crypto from 'node:crypto';
import fs from 'node:fs';

export interface Progress { received: number; total: number; speed: number }

export async function download(url: string, dest: string, expectedSize: number, onProgress: (p: Progress) => void, signal: AbortSignal) {
  const part = dest + '.part';
  const hash = crypto.createHash('sha256');
  let have = 0;
  try { have = fs.statSync(part).size; } catch { /* fresh */ }
  if (have >= expectedSize) { fs.rmSync(part, { force: true }); have = 0; }

  const res = await net.fetch(url, { headers: have ? { Range: `bytes=${have}-` } : {}, signal, cache: 'no-store' });
  if (res.status === 200 && have) have = 0;                        // server ignored the range: start over
  else if (res.status !== 200 && res.status !== 206) throw new Error(`Download failed (HTTP ${res.status})`);
  if (!res.body) throw new Error('Download failed (empty response)');

  if (have) {                                                        // hash what we already have
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(part).on('data', c => hash.update(c)).on('end', () => resolve()).on('error', reject);
    });
  }
  const out = fs.createWriteStream(part, { flags: have ? 'a' : 'w' });
  const total = expectedSize;
  let received = have;
  let windowStart = Date.now(), windowBytes = 0, speed = 0, lastEmit = 0;
  const reader = res.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      hash.update(value);
      received += value.length;
      windowBytes += value.length;
      if (!out.write(value)) await new Promise(r => out.once('drain', r));
      const now = Date.now();
      if (now - windowStart >= 1000) { speed = (windowBytes * 1000) / (now - windowStart); windowStart = now; windowBytes = 0; }
      if (now - lastEmit > 150) { lastEmit = now; onProgress({ received, total, speed }); }
    }
  } finally {
    await new Promise<void>(r => out.end(() => r()));
  }
  onProgress({ received, total, speed });
  const sha256 = hash.digest('hex');
  return { part, sha256, size: received };
}
