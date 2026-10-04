// Sample install of a big chunked build through the real launcher UI WITHOUT downloading all of it (metered link):
// the install folder is seeded with a local copy of the build, then damaged: every file under 2 MB is deleted and
// random chunks of the big files are zeroed until about --sample-mb of download is needed. The launcher must then
// hash what is there, fetch exactly the missing pieces from the LIVE bucket, and end with every file equal to the
// manifest. Optionally starts the game headless (-batchmode -nographics) to prove the player loads its data.
//   node tests/e2e-fullgame.mjs <scratchDir> --build <build folder> --game zenith-umbra --edition full --version 0.2.2
//        --name "Zenith Umbra Full Game Experience" [--sample-mb 300] [--run] [--keep]
import { _electron as electron } from 'playwright-core';
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const scratch = path.resolve(argv[0]);
const build = path.resolve(arg('build'));
const game = arg('game'), edition = arg('edition'), version = arg('version'), title = arg('name');
const sampleBytes = Number(arg('sample-mb', '300')) * 1e6;
const BASE = 'https://pub-5e79124d1d624fafac090b36c5f2deb3.r2.dev', SITE = 'https://zenithnet.vercel.app';
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const env = Object.fromEntries(fs.readFileSync(new URL('../../web/.env.local', import.meta.url), 'utf8').split(/\r?\n/)
  .map(l => /^([A-Z0-9_]+)="?(.*?)"?$/.exec(l)).filter(Boolean).map(m => [m[1], m[2]]));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const run = crypto.randomBytes(3).toString('hex');
const root = path.join(scratch, `full-${run}`), local = path.join(root, 'local'), profile = path.join(root, 'profile');
const installDir = path.join(local, 'ZenithNet', 'Games', `${game}-${edition}`);
for (const d of [installDir, profile]) fs.mkdirSync(d, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
let failed = 0;
const check = (label, ok, extra = '') => { log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`); if (!ok) failed++; };

// ---- manifest + catalogue file
const manifestUrl = `${BASE}/manifests/${game}/${edition}/${version}.json`;
const raw = Buffer.from(await (await fetch(manifestUrl, { cache: 'no-store' })).arrayBuffer());
const m = JSON.parse(raw.toString());
const catalogFile = path.join(root, 'catalog.json');
fs.writeFileSync(catalogFile, JSON.stringify({
  site: SITE, launcher: null,
  games: [{ slug: game, name: 'ZENITH//UMBRA', tagline: 'Sample install test', description: '', genre: 'Hero Shooter', accent: '#8b5cf6', site_url: null,
    art: { banner: `${SITE}/games/${game}/banner-v2.webp`, card: `${SITE}/games/${game}/card-v2.webp`, icon: `${SITE}/games/${game}/icon-v2.webp` },
    editions: [{ edition, name: title, note: '', exe: m.exe, detect: [], online: false,
      latest: { version, url: manifestUrl, sha256: crypto.createHash('sha256').update(raw).digest('hex'), size: m.totals.download_size, install_size: m.totals.size, kind: 'chunked', notes: '' } }] }],
}));
log(`manifest ${version}: ${m.totals.files} files, ${(m.totals.size / 1e9).toFixed(2)} GB installed, ${(m.totals.download_size / 1e9).toFixed(2)} GB to download fresh`);

// ---- seed from the local build, then damage it
let t = Date.now();
for (const f of m.files) {
  const dst = path.join(installDir, f.path);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(path.join(build, f.path), dst);
}
log(`seeded ${m.files.length} files in ${((Date.now() - t) / 1000).toFixed(0)} s`);
let expectDownload = 0, removed = 0, zeroed = 0;
const needed = new Set();
for (const f of m.files) {
  if (f.size > 0 && f.size < 2e6) {
    fs.rmSync(path.join(installDir, f.path));
    removed++;
    for (const c of f.chunks) if (!needed.has(c.hash)) { needed.add(c.hash); expectDownload += c.csize; }
  }
}
const big = m.files.filter(f => f.size >= 2e6);
const slots = big.flatMap(f => { let off = 0; return f.chunks.map(c => { const s = { f, c, off }; off += c.size; return s; }); });
while (expectDownload < sampleBytes && zeroed < slots.length) {
  const s = slots[crypto.randomInt(slots.length)];
  if (needed.has(s.c.hash)) continue;
  const fd = fs.openSync(path.join(installDir, s.f.path), 'r+');
  fs.writeSync(fd, Buffer.alloc(Math.min(s.c.size, 65536)), 0, Math.min(s.c.size, 65536), s.off + Math.floor(s.c.size / 2));
  fs.closeSync(fd);
  needed.add(s.c.hash); expectDownload += s.c.csize; zeroed++;
}
log(`damaged: ${removed} small files deleted, ${zeroed} chunks of big files corrupted -> ${needed.size} chunks / ${(expectDownload / 1e6).toFixed(1)} MB must come from R2`);

// ---- the launcher
const email = `zn-full-${run}@zenith.test`, password = crypto.randomBytes(12).toString('base64url');
const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (error) throw error;
let app;
try {
  app = await electron.launch({ args: [path.resolve('.')], env: { ...process.env, LOCALAPPDATA: local, ZENITH_USER_DATA: profile, ZENITH_CATALOG_FILE: catalogFile, ZENITH_NO_SHORTCUTS: '1' } });
  const win = await app.firstWindow();
  await win.getByRole('button', { name: 'Log in' }).first().click();
  await win.locator('#l-email').fill(email);
  await win.locator('#l-pw').fill(password);
  await win.getByRole('button', { name: 'Log in', exact: true }).last().click();
  await win.getByPlaceholder('e.g. NovaStrike').fill(`Ful${run}`);
  await win.getByRole('button', { name: /^Claim / }).click();
  await win.getByRole('button', { name: /^Install/ }).waitFor({ timeout: 30000 });
  await win.screenshot({ path: path.join(scratch, 'full-1-before.png') });
  t = Date.now();
  await win.getByRole('button', { name: /^Install/ }).click();
  let tDownload = 0, peak = 0, shot = false;
  for (;;) {
    if (await win.getByRole('button', { name: 'PLAY' }).isVisible().catch(() => false)) break;
    const txt = await win.locator('body').innerText().catch(() => '');
    const err = /Try again/.test(txt) && /failed|Not enough|didn.t match|missing/i.test(txt);
    if (err) throw new Error('launcher reported: ' + txt.split('\n').find(l => /failed|Not enough|match|missing/i.test(l)));
    const sp = /([\d.]+) MB\/s/.exec(txt);
    if (/Downloading/.test(txt)) {
      tDownload ||= Date.now();
      if (sp) peak = Math.max(peak, Number(sp[1]));
      if (!shot) { shot = true; await win.screenshot({ path: path.join(scratch, 'full-2-downloading.png') }); }
    }
    if (Date.now() - t > 3600e3) throw new Error('timed out after 60 min');
    await win.waitForTimeout(500);
  }
  const tEnd = Date.now();
  await win.screenshot({ path: path.join(scratch, 'full-3-installed.png') });
  const dlSecs = (tEnd - (tDownload || tEnd)) / 1000;
  check('launcher finished the install and offers PLAY', true,
    `(total ${((tEnd - t) / 1000).toFixed(0)} s: checking ${(((tDownload || tEnd) - t) / 1000).toFixed(0)} s, download+finish ${dlSecs.toFixed(0)} s; ${(expectDownload / 1e6).toFixed(1)} MB = ${(expectDownload * 8 / 1e6 / Math.max(dlSecs, 0.001)).toFixed(1)} Mbit/s average, peak shown ${peak} MB/s)`);
} catch (e) {
  check('launcher install', false, e.message.split('\n')[0]);
} finally {
  if (app) await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await admin.auth.admin.deleteUser(created.user.id);
}

// ---- proof: every file equals the manifest
t = Date.now();
let bad = 0;
for (const f of m.files) {
  const h = crypto.createHash('sha256');
  const p = path.join(installDir, f.path);
  if (!fs.existsSync(p) || fs.statSync(p).size !== f.size) { bad++; log('  differs:', f.path); continue; }
  await new Promise((res, rej) => fs.createReadStream(p, { highWaterMark: 4 << 20 }).on('data', d => h.update(d)).on('end', res).on('error', rej));
  if (h.digest('hex') !== f.sha256) { bad++; log('  differs:', f.path); }
}
const extra = fs.readdirSync(installDir, { recursive: true, withFileTypes: true }).filter(e => e.isFile())
  .map(e => path.relative(installDir, path.join(e.parentPath, e.name)).split(path.sep).join('/')).filter(p => !p.startsWith('.zenith/') && !m.files.some(f => f.path === p));
check(`all ${m.files.length} files have the manifest's sha256`, bad === 0, `(hashed in ${((Date.now() - t) / 1000).toFixed(0)} s)`);
check('no stray files, staging folder gone', extra.length === 0 && !fs.existsSync(path.join(installDir, '.zenith', 'staging')), extra.slice(0, 3).join(', '));

// ---- headless start of the installed copy (no window, no GPU); its log goes to the scratch dir
if (argv.includes('--run') && !failed) {
  const logFile = path.join(root, 'player.log');
  const p = spawn(path.join(installDir, m.exe), ['-batchmode', '-nographics', '-logFile', logFile, '--zenith-user=Sample#0000'], { cwd: installDir, stdio: 'ignore' });
  let exited = null;
  p.once('exit', c => { exited = c; });
  await new Promise(r => setTimeout(r, 25000));
  const text = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '';
  check('player starts headless and stays up 25 s', exited === null, exited !== null ? `(exit code ${exited})` : '');
  check('player log shows the engine initialised', /Initialize engine version|UnityEngine|Mono path|il2cpp/i.test(text), `(${text.length} bytes of log; exceptions: ${(text.match(/Exception/g) ?? []).length})`);
  if (exited === null) execFileSync('taskkill', ['/PID', String(p.pid), '/T', '/F'], { stdio: 'ignore' });   // exactly the process this test started
}
if (!argv.includes('--keep')) { await new Promise(r => setTimeout(r, 1500)); fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }); log('scratch install removed'); }
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
process.exit(failed ? 1 : 0);
