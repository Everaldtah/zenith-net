// Publish a game build as content-addressed chunks on Cloudflare R2 (for builds too big for one installer, and so
// that an update only downloads what changed).
//
//   node scripts/publish-chunked.mjs --game zenith-umbra --edition full --version 0.2.2 --dir <build folder>
//        --exe "Zenith Umbra Unity.exe" [--notes-file notes.md] [--exclude <glob> ...] [--no-catalog] [--force]
//   node scripts/publish-chunked.mjs --verify --game zenith-umbra --edition full --version 0.2.2 [--sample 20]
//
// Layout in the bucket:
//   chunks/<aa>/<sha256 of the uncompressed chunk>      the chunk, zstd-compressed (shared by every game and version)
//   manifests/<game>/<edition>/<version>.json           files -> chunk lists; immutable once written
// Re-runnable: chunks already in the bucket are never uploaded again, so a second run after a failure (or a new
// version of the same game) only sends what is missing.
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import { CHUNKER, chunkFile } from './chunker.mjs';
import { loadEnv, loadR2 } from './env.mjs';

const zstdCompress = promisify(zlib.zstdCompress);
const zstdDecompress = promisify(zlib.zstdDecompress);
const args = process.argv.slice(2);
const arg = k => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const flag = k => args.includes(`--${k}`);
const all = k => args.flatMap((a, i) => (a === `--${k}` ? [args[i + 1]] : []));

const game = arg('game'), edition = arg('edition') ?? 'main', version = arg('version');
if (!game || !version || !/^[a-z0-9-]+$/.test(game) || !/^[a-z0-9-]+$/.test(edition) || !/^[\w.-]+$/.test(version)) {
  console.error('usage: --game <slug> --edition <id> --version x.y.z --dir <folder> --exe <file> [--notes-file f] [--exclude glob] [--no-catalog] [--force] | --verify [--sample N]');
  process.exit(2);
}
const r2 = loadR2();
const s3 = new S3Client({
  region: 'auto', endpoint: r2.endpoint, credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey },
  requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED', maxAttempts: 3,
});
const manifestKey = `manifests/${game}/${edition}/${version}.json`;
const manifestUrl = `${r2.publicUrl}/${manifestKey}`;
const chunkKey = h => `chunks/${h.slice(0, 2)}/${h}`;
const mb = n => (n / 1e6).toFixed(1) + ' MB';
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function retry(what, fn, tries = 6) {
  for (let i = 1; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= tries) throw new Error(`${what}: ${e.message}`);
      await sleep(Math.min(30000, 500 * 2 ** i) * (0.5 + Math.random()));
    }
  }
}

// ---------------------------------------------------------------- verify: read back through the PUBLIC address
if (flag('verify')) {
  const t0 = Date.now();
  const res = await fetch(manifestUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error(`manifest ${res.status} at ${manifestUrl}`);
  const raw = Buffer.from(await res.arrayBuffer());
  const m = JSON.parse(raw.toString('utf8'));
  console.log(`manifest ok: ${m.game}/${m.edition} ${m.version}, ${m.totals.files} files, ${m.totals.chunks} chunks, sha256 ${sha(raw)}`);
  const base = new URL(m.chunk_path, manifestUrl);
  const allChunks = m.files.flatMap(f => f.chunks);
  const n = Math.min(Number(arg('sample') ?? 20), allChunks.length);
  const picks = [...new Set(Array.from({ length: n * 3 }, () => allChunks[crypto.randomInt(allChunks.length)]))].slice(0, n);
  let bytes = 0, bad = 0;
  const t1 = Date.now();
  for (const c of picks) {
    const r = await fetch(new URL(`${c.hash.slice(0, 2)}/${c.hash}`, base));
    if (!r.ok) { bad++; console.log(`FAIL ${c.hash} HTTP ${r.status}`); continue; }
    const body = Buffer.from(await r.arrayBuffer());
    bytes += body.length;
    const plain = await zstdDecompress(body);
    const ok = body.length === c.csize && plain.length === c.size && sha(plain) === c.hash;
    if (!ok) { bad++; console.log(`FAIL ${c.hash} size ${plain.length}/${c.size} csize ${body.length}/${c.csize}`); }
  }
  const secs = (Date.now() - t1) / 1000;
  console.log(`${picks.length - bad}/${picks.length} random chunks fetched from the public address, decompressed and hashed correctly`);
  console.log(`${mb(bytes)} in ${secs.toFixed(1)} s = ${(bytes * 8 / 1e6 / secs).toFixed(1)} Mbit/s (sequential), total ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  process.exit(bad ? 1 : 0);
}

// ---------------------------------------------------------------- publish
const dir = arg('dir') && path.resolve(arg('dir'));
const exe = arg('exe');
if (!dir || !exe || !fs.existsSync(path.join(dir, exe))) throw new Error(`--dir must be a folder that contains --exe (${exe})`);
const notes = arg('notes-file') ? fs.readFileSync(arg('notes-file'), 'utf8').trim() : (arg('notes') ?? '');
const globs = ['*_BackUpThisFolder_ButDontShipItWithYourGame/**', '*_BurstDebugInformation_DoNotShip/**', '**/*.dmp', '**/*.pdb',
  'uigamma.off', '**/Thumbs.db', '**/desktop.ini', '.zenith/**', ...all('exclude')];
const toRe = g => new RegExp('^' + g.split('**/').map(p => p.split('**').map(q => q.split('*').map(x => x.replace(/[.+^${}()|[\]\\]/g, '\\$&')).join('[^/]*')).join('.*')).join('(?:.*/)?') + '$', 'i');
const excludes = globs.map(toRe);

const files = [], skipped = [];
(function walk(rel) {
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const p = rel ? `${rel}/${e.name}` : e.name;
    if (excludes.some(re => re.test(p) || (e.isDirectory() && re.test(p + '/x')))) { skipped.push(p + (e.isDirectory() ? '/' : '')); continue; }
    if (e.isDirectory()) walk(p); else if (e.isFile()) files.push(p);
  }
})('');
const totalSize = files.reduce((s, f) => s + fs.statSync(path.join(dir, f)).size, 0);
console.log(`${game}/${edition} ${version}: ${files.length} files, ${mb(totalSize)} from ${dir}`);
if (skipped.length) console.log(`excluded: ${skipped.join(', ')}`);

// what the bucket already holds (one listing instead of a HEAD per chunk)
const have = new Map();
for (let token; ;) {
  const r = await retry('list chunks', () => s3.send(new ListObjectsV2Command({ Bucket: r2.bucket, Prefix: 'chunks/', ContinuationToken: token })));
  for (const o of r.Contents ?? []) have.set(o.Key.slice(o.Key.lastIndexOf('/') + 1), o.Size);
  if (!r.IsTruncated) break;
  token = r.NextContinuationToken;
}
console.log(`bucket holds ${have.size} chunks already`);

const LEVEL = Number(arg('level') ?? 12), PARALLEL = Number(arg('parallel') ?? 12);
const stats = { scanned: 0, chunks: 0, fresh: 0, reused: 0, uploaded: 0, t0: Date.now() };
const csize = new Map();        // hash -> compressed size, for every chunk of this build
const running = new Set();
let failed = null;

async function upload(hash, data) {
  const body = await zstdCompress(data, { params: { [zlib.constants.ZSTD_c_compressionLevel]: LEVEL } });
  await retry(`put ${hash}`, () => s3.send(new PutObjectCommand({
    Bucket: r2.bucket, Key: chunkKey(hash), Body: body, ContentLength: body.length,
    ContentType: 'application/octet-stream', CacheControl: 'public, max-age=31536000, immutable',
  })));
  csize.set(hash, body.length);
  have.set(hash, body.length);
  stats.uploaded += body.length;
}

const tick = setInterval(() => {
  const s = (Date.now() - stats.t0) / 1000;
  console.log(`  ${(stats.scanned / totalSize * 100).toFixed(1)}%  scanned ${mb(stats.scanned)}  uploaded ${mb(stats.uploaded)} (${(stats.uploaded * 8 / 1e6 / s).toFixed(1)} Mbit/s)  chunks ${stats.chunks}: ${stats.fresh} new, ${stats.reused} reused  ${Math.round(s)} s`);
}, 30000);

const outFiles = [];
for (const rel of files) {
  const info = await chunkFile(path.join(dir, rel), async ({ hash, size, data }) => {
    if (failed) throw failed;
    stats.scanned += size; stats.chunks++;
    if (csize.has(hash)) { stats.reused++; return; }                    // repeated inside this build
    if (have.has(hash)) { csize.set(hash, have.get(hash)); stats.reused++; return; }
    stats.fresh++;
    csize.set(hash, -1);                                                // claimed; real size set when the PUT lands
    const copy = Buffer.from(data);
    const p = upload(hash, copy).catch(e => { failed ??= e; }).finally(() => running.delete(p));
    running.add(p);
    while (running.size >= PARALLEL) await Promise.race(running);
  });
  outFiles.push({ path: rel, ...info });
}
await Promise.all(running);
clearInterval(tick);
if (failed) { console.error(`\nFAILED: ${failed.message}\nRun the same command again: it continues from the chunks already uploaded.`); process.exit(1); }

const seen = new Set();
let downloadSize = 0;
for (const f of outFiles) for (const c of f.chunks) {
  c.csize = csize.get(c.hash);
  if (!(c.csize > 0)) throw new Error(`no stored size for chunk ${c.hash}`);
  if (!seen.has(c.hash)) { seen.add(c.hash); downloadSize += c.csize; }
}
const manifest = {
  format: 1, game, edition, version, exe, codec: 'zstd',
  chunker: CHUNKER, chunk_path: '../../../chunks/',
  totals: { files: outFiles.length, size: totalSize, chunks: seen.size, download_size: downloadSize },
  files: outFiles.map(f => ({ path: f.path, size: f.size, sha256: f.sha256, chunks: f.chunks })),
};
const body = Buffer.from(JSON.stringify(manifest));
const manifestSha = sha(body);

// immutable: an existing manifest is only ever replaced by identical content (or with --force)
let existing = null;
try {
  const r = await s3.send(new GetObjectCommand({ Bucket: r2.bucket, Key: manifestKey }));
  existing = sha(Buffer.from(await r.Body.transformToByteArray()));
} catch (e) { if (e.name !== 'NoSuchKey' && e.$metadata?.httpStatusCode !== 404) throw e; }
if (existing && existing !== manifestSha && !flag('force')) {
  throw new Error(`${manifestKey} already exists with different content. A published version is immutable: publish a new --version (or pass --force if nobody has installed it yet).`);
}
if (existing !== manifestSha) {
  await retry('put manifest', () => s3.send(new PutObjectCommand({
    Bucket: r2.bucket, Key: manifestKey, Body: body, ContentLength: body.length, ContentType: 'application/json',
    CacheControl: 'public, max-age=300',
  })));
}

const secs = (Date.now() - stats.t0) / 1000;
console.log(`\ndone in ${Math.round(secs)} s`);
console.log(`files ${outFiles.length}, install size ${mb(totalSize)}`);
console.log(`chunks ${stats.chunks} (${seen.size} distinct): ${stats.fresh} uploaded, ${stats.reused} reused`);
console.log(`uploaded ${mb(stats.uploaded)}; download size of a fresh install ${mb(downloadSize)} (${(downloadSize / totalSize * 100).toFixed(1)}% of the install size)`);
console.log(`manifest ${manifestUrl}\nmanifest sha256 ${manifestSha}`);

if (flag('no-catalog')) { console.log('catalogue not touched (--no-catalog)'); process.exit(0); }
const { url: supabaseUrl, serviceKey } = loadEnv();
if (!supabaseUrl || !serviceKey) throw new Error('Supabase credentials missing: run `npx vercel env pull .env.local` in web/');
const row = { game, edition, version, kind: 'chunked', url: manifestUrl, sha256: manifestSha, size: downloadSize, install_size: totalSize, notes };
const res = await fetch(`${supabaseUrl}/rest/v1/game_builds?on_conflict=game,edition,version`, {
  method: 'POST',
  headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify(row),
});
if (!res.ok) throw new Error(`catalogue update failed: ${res.status} ${await res.text()}`);
console.log(`catalogue: ${game}/${edition} ${version} published (chunked)`);
