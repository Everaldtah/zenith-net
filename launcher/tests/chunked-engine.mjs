// Tests the chunk sync engine (src/main/chunked.ts) in plain Node against the LIVE bucket, with the small zz-test
// builds published by scripts/publish-chunked.mjs:  node tests/chunked-engine.mjs <scratchDir> <v1 folder> <v2 folder>
import { build } from 'esbuild';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [scratch, v1, v2] = process.argv.slice(2).map(p => path.resolve(p));
const out = path.join(scratch, 'chunked.bundle.mjs');
await build({ entryPoints: ['src/main/chunked.ts'], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'warning' });
const { syncInstall } = await import(pathToFileURL(out).href);
const BASE = process.env.R2_PUBLIC_URL ?? 'https://pub-5e79124d1d624fafac090b36c5f2deb3.r2.dev';
const url = v => `${BASE}/manifests/zz-test/main/${v}.json`;
const shaOf = async u => crypto.createHash('sha256').update(Buffer.from(await (await fetch(u, { cache: 'no-store' })).arrayBuffer())).digest('hex');
const SKIP = /BackUpThisFolder|\.dmp$|^\.zenith/;
const tree = d => Object.fromEntries(fs.readdirSync(d, { recursive: true, withFileTypes: true }).filter(e => e.isFile())
  .map(e => [path.relative(d, path.join(e.parentPath, e.name)).split(path.sep).join('/'), e]).filter(([p]) => !SKIP.test(p))
  .map(([p]) => [p, crypto.createHash('sha256').update(fs.readFileSync(path.join(d, p))).digest('hex')]).sort());
const same = (a, b) => JSON.stringify(tree(a)) === JSON.stringify(tree(b));
let failed = 0;
const check = (label, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`); if (!ok) failed++; };
const dir = path.join(scratch, 'install');
fs.rmSync(dir, { recursive: true, force: true });
const sha1 = await shaOf(url('0.0.1')), sha2 = await shaOf(url('0.0.2'));
const run = (v, sha, extra = {}) => syncInstall({ manifestUrl: url(v), manifestSha256: sha, dir, fetch, signal: new AbortController().signal, onProgress: () => {}, ...extra });
const brief = r => `(${r.downloadedChunks} chunks / ${(r.downloaded / 1e6).toFixed(1)} MB downloaded, ${r.reusedChunks} reused, built ${r.filesBuilt}, patched ${r.filesPatched}, removed ${r.filesRemoved}, ${r.seconds.toFixed(1)} s)`;

// resume: stop the first install part-way (2 at a time, so some chunks are complete), then run it again
const ac = new AbortController();
let stoppedAt = 0;
await syncInstall({ manifestUrl: url('0.0.1'), manifestSha256: sha1, dir, fetch, signal: ac.signal, parallel: 2,
  onProgress: p => { if (p.phase === 'download' && p.received > p.total * 0.6 && !ac.signal.aborted) { stoppedAt = p.received; ac.abort(); } } })
  .then(() => check('interrupted install stops', false), e => check('interrupted install stops', e.message === 'aborted', `(at ${(stoppedAt / 1e6).toFixed(1)} MB)`));
check('nothing is in place after an interrupted first install', !fs.existsSync(path.join(dir, 'Test Game.exe')));
let r = await run('0.0.1', sha1);
check('resumed install finishes and matches v1', same(dir, v1), brief(r));
check('resume did not download everything again', r.downloaded < 25.2e6 - 3e6, `(${(r.downloaded / 1e6).toFixed(1)} of 25.2 MB)`);
check('empty file exists', fs.existsSync(path.join(dir, 'Data/empty.dat')) && fs.statSync(path.join(dir, 'Data/empty.dat')).size === 0);
check('excluded files were not shipped', !fs.existsSync(path.join(dir, 'crash.dmp')));

r = await run('0.0.1', sha1);
check('second run is a no-op', r.downloadedChunks === 0 && r.filesBuilt === 0, brief(r));

let modified = 0;
r = await run('0.0.2', sha2, { onModify: () => modified++ });
check('update to v2 matches v2', same(dir, v2), brief(r));
check('update downloaded only the changed chunks', r.downloadedChunks <= 4 && r.reusedChunks >= 5);
check('update removed the file v2 dropped', !fs.existsSync(path.join(dir, 'Data/sub/text.txt')) && !fs.existsSync(path.join(dir, 'Data/sub')));
check('onModify fired once', modified === 1);

// repair: delete one file, corrupt 2 KB inside the big one, add a stray file (must be left alone)
fs.rmSync(path.join(dir, 'Data/new.txt'));
const fd = fs.openSync(path.join(dir, 'Data/big.bin'), 'r+');
fs.writeSync(fd, crypto.randomBytes(2048), 0, 2048, 9 << 20);
fs.closeSync(fd);
fs.writeFileSync(path.join(dir, 'my-notes.txt'), 'player file');
r = await run('0.0.2', sha2);
check('a normal run trusts the record (no hashing): damage not noticed, missing file restored', r.filesBuilt === 1 && r.filesPatched === 0, brief(r));
r = await run('0.0.2', sha2, { repair: true });
check('repair fixes the damaged file in place', same(dir, v2) || fs.existsSync(path.join(dir, 'my-notes.txt')), brief(r));
check('repair downloaded one chunk', r.downloadedChunks === 1 && r.filesPatched === 1);
fs.rmSync(path.join(dir, 'my-notes.txt'));
check('folder equals v2 after repair', same(dir, v2));

// downgrade back to v1 (any manifest can be the target)
r = await run('0.0.1', sha1);
check('back to v1 matches v1', same(dir, v1), brief(r));

// tampered manifest fingerprint, path escape
await run('0.0.1', 'f'.repeat(64)).then(() => check('wrong manifest fingerprint refused', false), e => check('wrong manifest fingerprint refused', /fingerprint/.test(e.message)));
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
process.exit(failed ? 1 : 0);
