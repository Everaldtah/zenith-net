// End-to-end run of chunked installs through the real launcher UI, against the LIVE R2 bucket, with the small zz-test
// builds (scripts/publish-chunked.mjs --game zz-test) and a catalogue read from a file, so nothing has to be in the
// live catalogue: install -> quit -> reopen -> update -> repair -> kill mid-download -> resume -> uninstall.
// The launcher's profile and library live in the scratch dir (ZENITH_USER_DATA, LOCALAPPDATA); no shortcuts are made.
//   node tests/e2e-chunked.mjs <scratchDir> <v1 folder> <v2 folder>
import { _electron as electron } from 'playwright-core';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const [scratch, v1, v2] = process.argv.slice(2, 5).map(p => path.resolve(p));
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const env = Object.fromEntries(fs.readFileSync(new URL('../../web/.env.local', import.meta.url), 'utf8').split(/\r?\n/)
  .map(l => /^([A-Z0-9_]+)="?(.*?)"?$/.exec(l)).filter(Boolean).map(m => [m[1], m[2]]));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BASE = 'https://pub-5e79124d1d624fafac090b36c5f2deb3.r2.dev';
const SITE = 'https://zenithnet.vercel.app';

const run = crypto.randomBytes(3).toString('hex');
const root = path.join(scratch, `e2e-${run}`);
const local = path.join(root, 'local'), profile = path.join(root, 'profile'), shots = path.join(scratch, 'shots');
for (const d of [local, profile, shots]) fs.mkdirSync(d, { recursive: true });
const catalogFile = path.join(root, 'catalog.json');
const installDir = path.join(local, 'ZenithNet', 'Games', 'zz-test-main');

async function catalog(version) {
  const url = `${BASE}/manifests/zz-test/main/${version}.json`;
  const raw = Buffer.from(await (await fetch(url, { cache: 'no-store' })).arrayBuffer());
  const m = JSON.parse(raw.toString());
  fs.writeFileSync(catalogFile, JSON.stringify({
    site: SITE, launcher: null,
    games: [{
      slug: 'zz-test', name: 'Chunk Test', tagline: 'Test game for chunked installs', description: '', genre: 'Test', accent: '#2b8cff', site_url: null,
      art: { banner: `${SITE}/games/zenith-umbra/banner.webp`, card: `${SITE}/games/zenith-umbra/card.webp`, icon: `${SITE}/games/zenith-umbra/icon.webp` },
      editions: [{ edition: 'main', name: 'Chunk Test', note: 'A test edition.', exe: m.exe, detect: [], online: false,
        latest: { version, url, sha256: crypto.createHash('sha256').update(raw).digest('hex'), size: m.totals.download_size, install_size: m.totals.size, kind: 'chunked', notes: `Test build ${version}` } }],
    }],
  }));
}
const SKIP = /BackUpThisFolder|\.dmp$|^\.zenith/;
const tree = d => JSON.stringify(fs.readdirSync(d, { recursive: true, withFileTypes: true }).filter(e => e.isFile())
  .map(e => path.relative(d, path.join(e.parentPath, e.name)).split(path.sep).join('/')).filter(p => !SKIP.test(p)).sort()
  .map(p => [p, crypto.createHash('sha256').update(fs.readFileSync(path.join(d, p))).digest('hex')]));
const same = (a, b) => tree(a) === tree(b);

const email = `zn-chunk-${run}@zenith.test`, password = crypto.randomBytes(12).toString('base64url');
const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (error) throw error;
let app, win, failed = 0;
const step = async (name, fn) => { try { await fn(); console.log('PASS ', name); } catch (e) { failed++; console.log('FAIL ', name, '-', e.message.split('\n')[0]); } };
const open = async () => {
  app = await electron.launch({ args: [path.resolve('.')], env: { ...process.env, LOCALAPPDATA: local, ZENITH_USER_DATA: profile, ZENITH_CATALOG_FILE: catalogFile, ZENITH_NO_SHORTCUTS: '1' } });
  win = await app.firstWindow();
};
const quit = async () => { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await new Promise(r => setTimeout(r, 1500)); };
const shot = n => win.screenshot({ path: path.join(shots, `chunked-${n}.png`) });

try {
  await catalog('0.0.1');
  await open();
  await step('log in and claim a username', async () => {
    await win.getByRole('button', { name: 'Log in' }).first().click();
    await win.locator('#l-email').fill(email);
    await win.locator('#l-pw').fill(password);
    await win.getByRole('button', { name: 'Log in', exact: true }).last().click();
    await win.getByPlaceholder('e.g. NovaStrike').fill(`Chk${run}`);
    await win.getByRole('button', { name: /^Claim / }).click();
    await win.getByRole('button', { name: /^Install/ }).waitFor({ timeout: 30000 });
    await shot('1-not-installed');
  });
  await step('install 0.0.1 (chunked) and get PLAY', async () => {
    await win.getByRole('button', { name: /^Install/ }).click();
    await win.getByRole('button', { name: 'PLAY' }).waitFor({ timeout: 180000 });
    if (!same(installDir, v1)) throw new Error('installed files differ from v1');
    await shot('2-installed');
  });
  await step('quit, reopen: still installed; catalogue now offers 0.0.2', async () => {
    await quit();
    await catalog('0.0.2');
    await open();
    await win.getByRole('button', { name: 'Update to 0.0.2' }).waitFor({ timeout: 30000 });
    await shot('3-update-offered');
  });
  await step('update to 0.0.2: files equal v2', async () => {
    await win.getByRole('button', { name: 'Update to 0.0.2' }).click();
    await win.getByRole('button', { name: 'PLAY' }).waitFor({ timeout: 180000 });
    if (!same(installDir, v2)) throw new Error('installed files differ from v2');
    if (fs.existsSync(path.join(installDir, 'Data', 'sub'))) throw new Error('a folder v2 dropped is still there');
  });
  await step('damage the install, then Verify and repair files', async () => {
    fs.rmSync(path.join(installDir, 'Data', 'new.txt'));
    const fd = fs.openSync(path.join(installDir, 'Data', 'big.bin'), 'r+');
    fs.writeSync(fd, crypto.randomBytes(4096), 0, 4096, 11 << 20);
    fs.closeSync(fd);
    if (same(installDir, v2)) throw new Error('damage did not take');
    await win.getByRole('button', { name: 'Game options' }).click();
    await win.getByRole('button', { name: 'Verify and repair files' }).click();
    await win.getByText(/Checking|Downloading/).first().waitFor({ timeout: 15000 }).catch(() => {});
    await win.getByRole('button', { name: 'PLAY' }).waitFor({ timeout: 180000 });
    if (!same(installDir, v2)) throw new Error('files differ from v2 after repair');
  });
  await step('uninstall removes the folder', async () => {
    await win.getByRole('button', { name: 'Game options' }).click();
    await win.getByRole('button', { name: 'Uninstall' }).click();
    await win.getByRole('button', { name: 'Uninstall', exact: true }).last().click();
    await win.getByRole('button', { name: /^Install/ }).waitFor({ timeout: 60000 });
    if (fs.existsSync(installDir)) throw new Error('folder still there');
  });
  await step('kill the launcher mid-download', async () => {
    await win.getByRole('button', { name: /^Install/ }).click();
    await win.getByText(/Downloading (1[5-9]|[2-9]\d)%/).waitFor({ timeout: 120000 });
    // hard kill of exactly the process tree this test started (by pid, never by name)
    execFileSync('taskkill', ['/PID', String(app.process().pid), '/T', '/F'], { stdio: 'ignore' });
    await new Promise(r => setTimeout(r, 2500));
    const parts = fs.readdirSync(path.join(installDir, '.zenith', 'staging'), { recursive: true }).filter(f => String(f).endsWith('.part'));
    if (!parts.length) throw new Error('no staging files after the kill');
    if (fs.existsSync(path.join(installDir, 'Test Game.exe'))) throw new Error('files were moved into place before the download finished');
  });
  await step('reopen: not installed, Install resumes and finishes; files equal v2', async () => {
    await open();
    await win.getByRole('button', { name: /^Install/ }).waitFor({ timeout: 30000 });
    await win.getByRole('button', { name: /^Install/ }).click();
    await win.getByRole('button', { name: 'PLAY' }).waitFor({ timeout: 180000 });
    if (!same(installDir, v2)) throw new Error('files differ from v2 after the resumed install');
    if (fs.existsSync(path.join(installDir, '.zenith', 'staging'))) throw new Error('staging folder left behind');
    await shot('4-resumed');
  });
  await step('uninstall again', async () => {
    await win.getByRole('button', { name: 'Game options' }).click();
    await win.getByRole('button', { name: 'Uninstall' }).click();
    await win.getByRole('button', { name: 'Uninstall', exact: true }).last().click();
    await win.getByRole('button', { name: /^Install/ }).waitFor({ timeout: 60000 });
    if (fs.existsSync(installDir)) throw new Error('folder still there');
  });
} finally {
  if (app) await quit();
  await admin.auth.admin.deleteUser(created.user.id);
  console.log('test account deleted');
  console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
  process.exit(failed ? 1 : 0);
}
