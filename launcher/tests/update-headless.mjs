// Real update of a chunked game with NO window at all (plain Node, the launcher's own sync engine), for a metered
// link: the scratch install is seeded from a local copy of the NEW build, brought back to the OLD version (fetching
// only the chunks that differ), then updated to the new version the way a player's launcher does it.
//   node tests/update-headless.mjs <scratchDir> --build <new build folder> --game zenith-umbra --edition full
//        --from 0.2.2 --to 0.2.3 [--run] [--keep]
import { build as bundle } from 'esbuild';
import { spawn, execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const argv = process.argv.slice(2);
const arg = k => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const scratch = path.resolve(argv[0]), src = path.resolve(arg('build'));
const game = arg('game'), edition = arg('edition'), from = arg('from'), to = arg('to');
const BASE = 'https://pub-5e79124d1d624fafac090b36c5f2deb3.r2.dev';
const root = path.join(scratch, `upd-${crypto.randomBytes(3).toString('hex')}`), dir = path.join(root, 'install');
fs.mkdirSync(dir, { recursive: true });
const out = path.join(root, 'chunked.bundle.mjs');
await bundle({ entryPoints: ['src/main/chunked.ts'], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'warning' });
const { syncInstall } = await import(pathToFileURL(out).href);

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
let failed = 0;
const check = (label, ok, extra = '') => { log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`); if (!ok) failed++; };
const url = v => `${BASE}/manifests/${game}/${edition}/${v}.json`;
const load = async v => { const raw = Buffer.from(await (await fetch(url(v), { cache: 'no-store' })).arrayBuffer()); return { m: JSON.parse(raw.toString()), sha: crypto.createHash('sha256').update(raw).digest('hex') }; };
const A = await load(from), B = await load(to);
const sync = (v, sha, extra = {}) => syncInstall({ manifestUrl: url(v), manifestSha256: sha, dir, fetch, signal: new AbortController().signal, onProgress: () => {}, ...extra });
const brief = r => `(${r.downloadedChunks} chunks / ${(r.downloaded / 1e6).toFixed(1)} MB downloaded, ${r.reusedChunks} chunks reused from disk, ${r.filesBuilt} files rebuilt, ${r.filesPatched} patched in place, ${r.filesRemoved} removed, ${r.seconds.toFixed(0)} s)`;
async function equals(m) {
  let bad = 0;
  for (const f of m.files) {
    const p = path.join(dir, f.path);
    if (!fs.existsSync(p) || fs.statSync(p).size !== f.size) { bad++; continue; }
    const h = crypto.createHash('sha256');
    await new Promise((res, rej) => fs.createReadStream(p, { highWaterMark: 4 << 20 }).on('data', d => h.update(d)).on('end', res).on('error', rej));
    if (h.digest('hex') !== f.sha256) bad++;
  }
  const stray = fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter(e => e.isFile())
    .map(e => path.relative(dir, path.join(e.parentPath, e.name)).split(path.sep).join('/')).filter(p => !p.startsWith('.zenith/') && !m.files.some(f => f.path === p));
  return { bad, stray };
}

// what the update is on paper
const hashesA = new Set(A.m.files.flatMap(f => f.chunks.map(c => c.hash)));
const fresh = new Map(B.m.files.flatMap(f => f.chunks).filter(c => !hashesA.has(c.hash)).map(c => [c.hash, c.csize]));
const changed = B.m.files.filter(f => A.m.files.find(x => x.path === f.path)?.sha256 !== f.sha256).length;
log(`${from} -> ${to}: ${changed} of ${B.m.totals.files} files differ; ${fresh.size} of ${B.m.totals.chunks} chunks are new = ${([...fresh.values()].reduce((a, b) => a + b, 0) / 1e6).toFixed(1)} MB to download (a fresh install is ${(B.m.totals.download_size / 1e6).toFixed(0)} MB)`);

let t = Date.now();
for (const f of B.m.files) { const d = path.join(dir, f.path); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(src, f.path), d); }
log(`seeded from the local ${to} build in ${((Date.now() - t) / 1000).toFixed(0)} s`);

let r = await sync(from, A.sha);
let e = await equals(A.m);
// files only the newer build has stay behind here (a folder the launcher has no record of is never cleaned): fine
check(`scratch install brought to ${from}: every file equals the ${from} manifest`, e.bad === 0, brief(r) + (e.stray.length ? ` [${e.stray.length} newer-only files left, expected]` : ''));

let modified = 0;
r = await sync(to, B.sha, { onModify: () => modified++ });
e = await equals(B.m);
check(`UPDATE ${from} -> ${to}: every file equals the ${to} manifest`, e.bad === 0 && e.stray.length === 0, brief(r));
check('the update downloaded only new chunks', r.downloadedChunks <= fresh.size && (fresh.size === 0 || r.downloadedChunks > 0 || e.bad === 0), `(${r.downloadedChunks} downloaded; ${fresh.size} chunks are new in ${to})`);
check('staging folder gone, installed record says ' + to, !fs.existsSync(path.join(dir, '.zenith', 'staging')) && JSON.parse(fs.readFileSync(path.join(dir, '.zenith', 'manifest.json'), 'utf8')).version === to);
r = await sync(to, B.sha);
check('running the update again does nothing', r.downloadedChunks === 0 && r.filesBuilt === 0 && r.filesPatched === 0, brief(r));

if (argv.includes('--run') && !failed) {
  const logFile = path.join(root, 'player.log');
  const p = spawn(path.join(dir, B.m.exe), ['-batchmode', '-nographics', '-logFile', logFile, '--zenith-user=Sample#0000'], { cwd: dir, stdio: 'ignore' });
  let exited = null;
  p.once('exit', c => { exited = c; });
  await new Promise(res => setTimeout(res, 25000));
  const text = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '';
  check('updated copy starts headless and stays up 25 s', exited === null && text.length > 0, `(${text.length} bytes of log; exceptions: ${(text.match(/Exception/g) ?? []).length})`);
  if (exited === null) execFileSync('taskkill', ['/PID', String(p.pid), '/T', '/F'], { stdio: 'ignore' });   // exactly the process this test started
}
if (!argv.includes('--keep')) { await new Promise(res => setTimeout(res, 1500)); fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }); log('scratch install removed'); }
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
process.exit(failed ? 1 : 0);
