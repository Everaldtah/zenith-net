// Content-defined chunking (gear hash, FastCDC-style normalised cut points). Deterministic: the same bytes always cut
// at the same places, so a data file that grew in the middle still shares almost all of its chunks with the old one.
// CHANGING ANYTHING HERE (table seed, masks, sizes) makes new publishes stop deduplicating against old ones.
import crypto from 'node:crypto';
import fs from 'node:fs';

export const CHUNKER = { id: 'gear32-v1', min: 1 << 20, avg: 4 << 20, max: 16 << 20 };

const GEAR = new Uint32Array(256);
for (let i = 0; i < 256; i++) GEAR[i] = crypto.createHash('sha256').update(`zenith-cdc-v1:${i}`).digest().readUInt32LE(0);

// h = (h << 1) + gear[b]: bit k depends on the last k+1 bytes, so the HIGH bits see the widest window.
const MASK_HARD = 0xfffffe00 >>> 0;   // 23 bits: before the average size, cut rarely
const MASK_EASY = 0xffffe000 >>> 0;   // 19 bits: after it, cut readily

/** Length of the next chunk in buf[start, end). `last` = no more data follows. Returns 0 when more data is needed. */
export function nextCut(buf, start, end, last) {
  const n = end - start;
  if (n <= CHUNKER.min) return last ? n : 0;
  if (!last && n < CHUNKER.max) return 0;
  const limit = Math.min(n, CHUNKER.max);
  const mid = Math.min(limit, CHUNKER.avg);
  let h = 0;
  let i = CHUNKER.min - 64;                    // warm the hash up over the 64 bytes before the first allowed cut
  for (; i < CHUNKER.min; i++) h = ((h << 1) + GEAR[buf[start + i]]) >>> 0;
  for (; i < mid; i++) {
    h = ((h << 1) + GEAR[buf[start + i]]) >>> 0;
    if ((h & MASK_HARD) === 0) return i + 1;
  }
  for (; i < limit; i++) {
    h = ((h << 1) + GEAR[buf[start + i]]) >>> 0;
    if ((h & MASK_EASY) === 0) return i + 1;
  }
  return limit;
}

/**
 * Chunks one file. Calls `onChunk({ hash, size, data })` in order and awaits it (back-pressure); `data` is a view into
 * a reused buffer, so copy it if you keep it. Returns { size, sha256, chunks: [{ hash, size }] }.
 */
export async function chunkFile(file, onChunk) {
  const fh = await fs.promises.open(file, 'r');
  const cap = CHUNKER.max * 4;
  const buf = Buffer.allocUnsafe(cap);
  const whole = crypto.createHash('sha256');
  const chunks = [];
  let start = 0, end = 0, pos = 0, eof = false, size = 0;
  try {
    for (;;) {
      while (!eof && end - start < CHUNKER.max) {
        if (start > 0) { buf.copyWithin(0, start, end); end -= start; start = 0; }
        const { bytesRead } = await fh.read(buf, end, cap - end, pos);
        if (bytesRead === 0) eof = true;
        end += bytesRead; pos += bytesRead;
      }
      if (end === start) break;
      const len = nextCut(buf, start, end, eof);
      const data = buf.subarray(start, start + len);
      const hash = crypto.createHash('sha256').update(data).digest('hex');
      whole.update(data);
      chunks.push({ hash, size: len });
      size += len;
      await onChunk({ hash, size: len, data });
      start += len;
    }
  } finally {
    await fh.close();
  }
  return { size, sha256: whole.digest('hex'), chunks };
}
