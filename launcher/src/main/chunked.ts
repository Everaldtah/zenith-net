// Chunked builds (big games on Cloudflare R2): bring an install folder to exactly the state a manifest describes,
// downloading only the chunks that folder doesn't already hold. One routine does fresh install, resume after a quit,
// update and repair: it never trusts what is on disk without hashing it, except files the last finished run recorded.
//
// No Electron imports here (the fetch function is passed in), so the engine can be tested in plain Node.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { promisify } from 'node:util';

const zstdDecompress = promisify(zlib.zstdDecompress);
const fsp = fs.promises;

export interface ManifestChunk { hash: string; size: number; csize: number }
export interface ManifestFile { path: string; size: number; sha256: string; chunks: ManifestChunk[] }
export interface Manifest {
  format: number; game: string; edition: string; version: string; exe: string; codec: string; chunk_path: string;
  totals: { files: number; size: number; chunks: number; download_size: number };
  files: ManifestFile[];
}
export interface SyncProgress { phase: 'verify' | 'download' | 'install'; received: number; total: number; speed: number }
export interface SyncResult { manifest: Manifest; downloaded: number; downloadedChunks: number; reusedChunks: number; filesBuilt: number; filesPatched: number; filesRemoved: number; seconds: number }
export type FetchLike = (url: string, init?: { signal?: AbortSignal; cache?: RequestCache }) => Promise<Response>;

export interface SyncOptions {
  manifestUrl: string;
  manifestSha256: string;
  dir: string;
  /** hash every file instead of trusting the record of the last finished run */
  repair?: boolean;
  parallel?: number;
  fetch: FetchLike;
  signal: AbortSignal;
  onProgress: (p: SyncProgress) => void;
  /** called once, right before the first change to files of a finished install (so the caller can mark it "updating") */
  onModify?: () => void;
}

const META = '.zenith';
const sha = (b: Uint8Array) => crypto.createHash('sha256').update(b).digest('hex');
const sleep = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal.addEventListener('abort', () => { clearTimeout(t); reject(new Error('aborted')); }, { once: true });
});
const gb = (n: number) => (n / 1e9).toFixed(1) + ' GB';

/** A manifest path must stay inside the install folder: plain relative segments only. */
function safeRel(p: string) {
  if (typeof p !== 'string' || !p || p.length > 400 || /[\\:*?"<>|\0]/.test(p)) return false;
  const parts = p.split('/');
  return parts.every(s => s && s !== '.' && s !== '..' && !/[. ]$/.test(s)) && parts[0].toLowerCase() !== META;
}

export async function fetchManifest(url: string, sha256: string, fetchImpl: FetchLike, signal: AbortSignal): Promise<{ manifest: Manifest; raw: Buffer }> {
  const res = await fetchImpl(url, { signal, cache: 'no-store' });
  if (!res.ok) throw new Error(`Couldn't get the game's file list (HTTP ${res.status})`);
  const raw = Buffer.from(await res.arrayBuffer());
  if (sha(raw) !== sha256) throw new Error('The game’s file list didn’t match its fingerprint. Please try again.');
  const m = JSON.parse(raw.toString('utf8')) as Manifest;
  if (m.format !== 1 || m.codec !== 'zstd' || !Array.isArray(m.files)) throw new Error('This game needs a newer launcher. Update Zenith.net and try again.');
  const seen = new Set<string>();
  for (const f of m.files) {
    if (!safeRel(f.path) || seen.has(f.path.toLowerCase())) throw new Error(`Bad file path in the game's file list: ${f.path}`);
    seen.add(f.path.toLowerCase());
    if (!Number.isSafeInteger(f.size) || f.size < 0 || f.chunks.reduce((s, c) => s + c.size, 0) !== f.size) throw new Error(`Bad sizes for ${f.path}`);
    for (const c of f.chunks) if (!/^[0-9a-f]{64}$/.test(c.hash) || !(c.size > 0) || !(c.csize > 0)) throw new Error(`Bad chunk in ${f.path}`);
  }
  if (!seen.has(m.exe.toLowerCase())) throw new Error('The game’s file list has no executable');
  return { manifest: m, raw };
}

async function readExact(fh: fs.promises.FileHandle, offset: number, size: number): Promise<Buffer | null> {
  const buf = Buffer.allocUnsafe(size);
  let got = 0;
  while (got < size) {
    const { bytesRead } = await fh.read(buf, got, size - got, offset + got);
    if (bytesRead === 0) return null;
    got += bytesRead;
  }
  return buf;
}
async function writeAll(fh: fs.promises.FileHandle, data: Buffer, offset: number) {
  let done = 0;
  while (done < data.length) {
    const { bytesWritten } = await fh.write(data, done, data.length - done, offset + done);
    done += bytesWritten;
  }
}
const statOrNull = (p: string) => fsp.stat(p).catch(() => null);

interface Target { f: ManifestFile; final: string; part: string; mode: 'ok' | 'inplace' | 'staged'; offsets: number[] }
interface Slot { t: Target; offset: number }
interface Need { hash: string; size: number; csize: number; slots: Slot[] }

/** Makes `dir` match the manifest. Safe to interrupt at any point: run it again and it continues. */
export async function syncInstall(o: SyncOptions): Promise<SyncResult> {
  const t0 = Date.now();
  const { signal } = o;
  const check = () => { if (signal.aborted) throw new Error('aborted'); };
  const { manifest: m, raw } = await fetchManifest(o.manifestUrl, o.manifestSha256, o.fetch, signal);
  const dir = path.resolve(o.dir);
  const meta = path.join(dir, META), staging = path.join(meta, 'staging');
  await fsp.mkdir(staging, { recursive: true });

  let old: Manifest | null = null;
  try { old = JSON.parse(await fsp.readFile(path.join(meta, 'manifest.json'), 'utf8')) as Manifest; } catch { /* first install, or an install the launcher didn't make */ }
  const recorded = new Map<string, string>(!o.repair && old ? old.files.map(f => [f.path, f.sha256]) : []);

  const handles = new Map<string, fs.promises.FileHandle>();
  const open = async (p: string, flags: string) => {
    let h = handles.get(p + flags);
    if (!h) { h = await fsp.open(p, flags); handles.set(p + flags, h); }
    return h;
  };
  const closeAll = async () => { for (const h of handles.values()) await h.close().catch(() => undefined); handles.clear(); };

  let modified = false;
  const modify = () => { if (!modified) { modified = true; o.onModify?.(); } };
  let speedBytes = 0, speedAt = Date.now(), speed = 0, lastEmit = 0;
  const emit = (phase: SyncProgress['phase'], received: number, total: number, bytes = 0, force = false) => {
    const now = Date.now();
    speedBytes += bytes;
    if (now - speedAt >= 1000) { speed = (speedBytes * 1000) / (now - speedAt); speedAt = now; speedBytes = 0; }
    if (force || now - lastEmit > 200) { lastEmit = now; o.onProgress({ phase, received, total, speed: phase === 'download' ? speed : 0 }); }
  };

  try {
    // ---------------------------------------------------------------- 1. what is already right?
    const targets: Target[] = [];
    for (const f of m.files) {
      const final = path.join(dir, ...f.path.split('/'));
      if (!final.startsWith(dir + path.sep)) throw new Error(`Bad file path: ${f.path}`);
      const offsets: number[] = [];
      let off = 0;
      for (const c of f.chunks) { offsets.push(off); off += c.size; }
      targets.push({ f, final, part: path.join(staging, ...f.path.split('/')) + '.part', mode: 'staged', offsets });
    }
    const have = new Map<string, { file: string; offset: number }>();     // chunks known (or recorded) to be on disk
    const needs = new Map<string, Need>();
    const want = (t: Target, i: number) => {
      const c = t.f.chunks[i];
      let n = needs.get(c.hash);
      if (!n) { n = { hash: c.hash, size: c.size, csize: c.csize, slots: [] }; needs.set(c.hash, n); }
      n.slots.push({ t, offset: t.offsets[i] });
    };

    const scan: { t: Target; file: string }[] = [];
    let needSpace = 0;
    for (const t of targets) {
      const st = await statOrNull(t.final);
      if (st?.isFile() && st.size === t.f.size && recorded.get(t.f.path) === t.f.sha256) {
        t.mode = 'ok';
        t.f.chunks.forEach((c, i) => { if (!have.has(c.hash)) have.set(c.hash, { file: t.final, offset: t.offsets[i] }); });
      } else if (st?.isFile() && st.size === t.f.size && t.f.size > 0) {
        t.mode = 'inplace';
        scan.push({ t, file: t.final });
      } else if (st?.isFile() && t.f.size === 0 && st.size === 0) {
        t.mode = 'ok';
      } else {
        const ps = await statOrNull(t.part);
        if (ps?.isFile() && ps.size === t.f.size && t.f.size > 0) scan.push({ t, file: t.part });
        else { needSpace += t.f.size; t.f.chunks.forEach((_, i) => want(t, i)); }
      }
    }
    const scanTotal = scan.reduce((s, x) => s + x.t.f.size, 0);
    let scanned = 0;
    for (const { t, file } of scan) {
      const fh = await open(file, 'r');
      let good = 0;
      for (let i = 0; i < t.f.chunks.length; i++) {
        check();
        const c = t.f.chunks[i];
        const data = await readExact(fh, t.offsets[i], c.size);
        if (data && sha(data) === c.hash) { good++; if (!have.has(c.hash)) have.set(c.hash, { file, offset: t.offsets[i] }); }
        else want(t, i);
        scanned += c.size;
        emit('verify', scanned, scanTotal);
      }
      if (good === t.f.chunks.length && t.mode === 'inplace') t.mode = 'ok';
    }
    // chunks of the previously installed version that still sit in files on disk (verified when they are copied)
    if (old) {
      for (const f of old.files) {
        if (!safeRel(f.path)) continue;
        const p = path.join(dir, ...f.path.split('/'));
        const st = await statOrNull(p);
        if (!st?.isFile() || st.size !== f.size) continue;
        let off = 0;
        for (const c of f.chunks) { if (!have.has(c.hash)) have.set(c.hash, { file: p, offset: off }); off += c.size; }
      }
    }

    // ---------------------------------------------------------------- 2. room on the disk, staging files
    const disk = await fsp.statfs(dir).catch(() => null);
    if (disk) {
      const free = Number(disk.bavail) * Number(disk.bsize);
      if (free < needSpace + 256e6) throw new Error(`Not enough disk space: this needs ${gb(needSpace + 256e6)} free on ${path.parse(dir).root} and there is ${gb(free)}. Free some space or change the install folder in Settings.`);
    }
    for (const t of targets) {
      if (t.mode !== 'staged' || t.f.size === 0) continue;
      const ps = await statOrNull(t.part);
      if (!ps || ps.size !== t.f.size) {
        await fsp.mkdir(path.dirname(t.part), { recursive: true });
        const fh = await fsp.open(t.part, 'w');
        await fh.truncate(t.f.size);
        await fh.close();
      }
    }
    const target = (s: Slot) => open(s.t.mode === 'inplace' ? s.t.final : s.t.part, 'r+');
    const store = async (n: Need, data: Buffer) => {
      for (const s of n.slots) {
        if (s.t.mode === 'inplace') modify();
        await writeAll(await target(s), data, s.offset);
      }
    };

    // ---------------------------------------------------------------- 3. reuse what is on disk
    // staged-only needs first: they only read, so every source is still intact when they run
    const order = [...needs.values()].sort((a, b) => Number(a.slots.some(s => s.t.mode === 'inplace')) - Number(b.slots.some(s => s.t.mode === 'inplace')));
    const copyTotal = order.filter(n => have.has(n.hash)).reduce((s, n) => s + n.size, 0);
    let copied = 0, reusedChunks = 0;
    for (const n of order) {
      const src = have.get(n.hash);
      if (!src) continue;
      check();
      const data = await readExact(await open(src.file, 'r'), src.offset, n.size).catch(() => null);
      copied += n.size;
      emit('verify', copied, copyTotal);
      if (!data || sha(data) !== n.hash) continue;          // changed since it was recorded: download it instead
      await store(n, data);
      needs.delete(n.hash);
      reusedChunks++;
    }

    // ---------------------------------------------------------------- 4. download the rest
    const queue = [...needs.values()].sort((a, b) => (a.slots[0].t.f.path === b.slots[0].t.f.path ? a.slots[0].offset - b.slots[0].offset : a.slots[0].t.f.path < b.slots[0].t.f.path ? -1 : 1));
    const total = queue.reduce((s, n) => s + n.csize, 0);
    const base = new URL(m.chunk_path, o.manifestUrl);
    let received = 0, next = 0, downloadedChunks = 0;
    emit('download', 0, total, 0, true);
    const fetchChunk = async (n: Need) => {
      for (let attempt = 1; ; attempt++) {
        check();
        let got = 0;
        try {
          const res = await o.fetch(new URL(`${n.hash.slice(0, 2)}/${n.hash}`, base).toString(), { signal });
          if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
          const parts: Uint8Array[] = [];
          const reader = res.body!.getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            parts.push(value); got += value.length; received += value.length;
            emit('download', received, total, value.length);
          }
          const body = Buffer.concat(parts);
          if (body.length !== n.csize) throw new Error('short read');
          const plain = await zstdDecompress(body);
          if (plain.length !== n.size || sha(plain) !== n.hash) throw new Error('fingerprint mismatch');
          await store(n, plain);
          downloadedChunks++;
          return;
        } catch (e) {
          if (signal.aborted) throw new Error('aborted');
          received -= got;
          const status = (e as { status?: number }).status;
          if (attempt >= 8 || status === 404) throw new Error(`Download failed (${(e as Error).message}). Check your connection and try again: it continues where it stopped.`);
          await sleep(Math.min(status === 429 ? 60000 : 20000, 700 * 2 ** attempt) * (0.5 + Math.random()), signal);
        }
      }
    };
    let failure: Error | null = null;
    await Promise.all(Array.from({ length: Math.min(o.parallel ?? 10, queue.length) }, async () => {
      while (!failure && next < queue.length) {
        try { await fetchChunk(queue[next++]); } catch (e) { failure ??= e as Error; }
      }
    }));
    if (failure) throw failure;
    emit('download', total, total, 0, true);

    // ---------------------------------------------------------------- 5. move into place, drop what the new version no longer has
    await closeAll();
    emit('install', 0, 1, 0, true);
    let filesBuilt = 0, filesPatched = 0, filesRemoved = 0;
    for (const t of targets) {
      check();
      if (t.mode === 'inplace') { filesPatched++; continue; }
      if (t.mode !== 'staged') continue;
      modify();
      await fsp.mkdir(path.dirname(t.final), { recursive: true });
      if (t.f.size === 0) await fsp.writeFile(t.final, '');
      else {
        await fsp.rm(t.final, { force: true, recursive: true });
        await fsp.rename(t.part, t.final);
      }
      filesBuilt++;
    }
    if (old) {
      const keep = new Set(m.files.map(f => f.path.toLowerCase()));
      for (const f of old.files) {
        if (keep.has(f.path.toLowerCase()) || !safeRel(f.path)) continue;
        modify();
        const p = path.join(dir, ...f.path.split('/'));
        await fsp.rm(p, { force: true });
        filesRemoved++;
        for (let d = path.dirname(p); d.length > dir.length; d = path.dirname(d)) {       // folders left empty
          try { await fsp.rmdir(d); } catch { break; }
        }
      }
    }
    await fsp.rm(staging, { recursive: true, force: true });
    await fsp.writeFile(path.join(meta, 'manifest.json.tmp'), raw);
    await fsp.rename(path.join(meta, 'manifest.json.tmp'), path.join(meta, 'manifest.json'));
    emit('install', 1, 1, 0, true);
    return { manifest: m, downloaded: received, downloadedChunks, reusedChunks, filesBuilt, filesPatched, filesRemoved, seconds: (Date.now() - t0) / 1000 };
  } finally {
    await closeAll();
  }
}

/** Version recorded in an install folder by the last finished sync, if any. */
export function installedManifest(dir: string): Manifest | null {
  try { return JSON.parse(fs.readFileSync(path.join(dir, META, 'manifest.json'), 'utf8')) as Manifest; } catch { return null; }
}
