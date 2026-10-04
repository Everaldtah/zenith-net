// Live end-to-end run of the built launcher (dist/) against the real backend with a throwaway account:
// log in -> claim a username -> library -> Forums tab -> install + uninstall a game. Windows' per-user folders are
// pointed at a scratch dir so the PC's real installs and launcher state are untouched (the game installer still makes
// its Desktop/Start-menu shortcuts in the real profile; the uninstall removes them again).
//   node tests/e2e-live.mjs <scratchDir> [--install <game>/<edition>]
import { _electron as electron } from 'playwright-core';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const scratch = path.resolve(process.argv[2] ?? '.');
const installKey = process.argv.includes('--install') ? process.argv[process.argv.indexOf('--install') + 1] : null;
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const env = Object.fromEntries(fs.readFileSync(new URL('../../web/.env.local', import.meta.url), 'utf8').split(/\r?\n/)
  .map(l => /^([A-Z0-9_]+)="?(.*?)"?$/.exec(l)).filter(Boolean).map(m => [m[1], m[2]]));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const shots = path.join(scratch, 'shots');
fs.mkdirSync(shots, { recursive: true });
const local = path.join(scratch, 'local'), roaming = path.join(scratch, 'roaming');
fs.mkdirSync(local, { recursive: true }); fs.mkdirSync(roaming, { recursive: true });

const email = `zn-e2e-${crypto.randomBytes(3).toString('hex')}@zenith.test`;
const password = crypto.randomBytes(12).toString('base64url');
const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (error) throw error;
let app, failed = 0;
const step = async (name, fn) => { try { await fn(); console.log('PASS ', name); } catch (e) { failed++; console.log('FAIL ', name, '-', e.message.split('\n')[0]); } };

try {
  // ZENITH_EXE = an installed launcher (for example the public release) instead of this checkout's dist/
  app = await electron.launch({ ...(process.env.ZENITH_EXE ? { executablePath: process.env.ZENITH_EXE, args: [] } : { args: [path.resolve('.')] }),
    env: { ...process.env, LOCALAPPDATA: local, ZENITH_USER_DATA: roaming } });
  const win = await app.firstWindow();
  const errors = [];
  win.on('pageerror', e => errors.push(e.message));
  const shot = n => win.screenshot({ path: path.join(shots, `${n}.png`) });

  await step('sign-in screen shows Google + email', async () => {
    await win.getByText('Continue with Google').waitFor({ timeout: 15000 });
    await win.getByText('Register with email').waitFor();
  });
  await step('log in with email + password', async () => {
    await win.getByRole('button', { name: 'Log in' }).first().click();
    await win.locator('#l-email').fill(email);
    await win.locator('#l-pw').fill(password);
    await win.getByRole('button', { name: 'Log in', exact: true }).last().click();
    await win.getByText('Choose your username').waitFor({ timeout: 15000 });
    await shot('1-username');
  });
  const name = `E2e${crypto.randomBytes(2).toString('hex')}`;
  await step('claim a username', async () => {
    await win.getByPlaceholder('e.g. NovaStrike').fill(name);
    await win.getByRole('button', { name: `Claim ${name}` }).click();
    await win.getByText('Loading your library').or(win.getByRole('button', { name: /PLAY|Install|Update/ }).first()).waitFor({ timeout: 20000 });
  });
  await step('library shows the games from the catalog', async () => {
    await win.getByRole('button', { name: /ZENITH\/\/UMBRA/ }).first().waitFor({ timeout: 20000 });
    await win.getByRole('button', { name: /Nebula Dominion/ }).first().waitFor();
    await win.waitForTimeout(2000);
    await shot('2-library-zu');
  });
  await step('friends panel shows my tag', async () => {
    await win.getByText(new RegExp(`${name}`)).first().waitFor({ timeout: 10000 });
  });
  await step('Nebula Dominion has two editions', async () => {
    await win.getByRole('button', { name: /Nebula Dominion/ }).first().click();
    await win.locator('#edition').waitFor({ timeout: 5000 });
    const opts = await win.locator('#edition option').allTextContents();
    if (opts.length !== 2) throw new Error(`editions: ${opts.join(', ')}`);
    await win.waitForTimeout(1500);
    await shot('3-library-nebula');
  });
  await step('Forums tab opens the site signed in (handoff)', async () => {
    await win.getByRole('button', { name: 'Forums' }).click();
    await win.waitForTimeout(9000);
    await shot('4-forums');
    const wv = app.windows().length;  // the webview is not a window; check via main process
    const url = await app.evaluate(({ webContents }) => webContents.getAllWebContents().filter(w => w.getType() === 'webview').map(w => w.getURL())[0]);
    if (!url || !url.includes('/forums')) throw new Error(`webview url ${url} (${wv})`);
    const signedIn = await app.evaluate(async ({ webContents }) => {
      const w = webContents.getAllWebContents().find(x => x.getType() === 'webview');
      return w.executeJavaScript('document.body.innerText.includes("Log in") === false');
    });
    if (!signedIn) throw new Error('web view not signed in');
  });
  if (installKey) {
    const [g, e] = installKey.split('/');
    await step(`install ${installKey} from GitHub Releases`, async () => {
      await win.getByRole('button', { name: 'Games' }).click();
      await win.getByRole('button', { name: g === 'zenith-umbra' ? /ZENITH/ : /Nebula Dominion/ }).first().click();
      if (e !== 'main') await win.locator('#edition').selectOption(e);
      await win.getByRole('button', { name: /^Install/ }).click();
      await win.getByText(/Downloading/).waitFor({ timeout: 20000 });
      await win.waitForTimeout(3000);
      await shot('5-downloading');
      await win.getByRole('button', { name: 'PLAY' }).waitFor({ timeout: 15 * 60_000 });
      await shot('6-installed');
      const dir = path.join(local, 'ZenithNet', 'Games', `${g}-${e}`);
      if (!fs.readdirSync(dir).some(f => f.toLowerCase().endsWith('.exe'))) throw new Error('no exe in ' + dir);
    });
    await step(`uninstall ${installKey}`, async () => {
      await win.getByRole('button', { name: 'Game options' }).click();
      await win.getByRole('button', { name: 'Uninstall' }).click();
      await win.getByRole('button', { name: 'Uninstall', exact: true }).last().click();
      await win.getByRole('button', { name: /^Install/ }).waitFor({ timeout: 120_000 });
      const dir = path.join(local, 'ZenithNet', 'Games', `${g}-${e}`);
      if (fs.existsSync(dir)) throw new Error('folder still there: ' + dir);
    });
  }
  console.log('renderer errors:', errors.length ? errors : 'none');
} finally {
  if (app) await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await admin.auth.admin.deleteUser(created.user.id);
  console.log('test account deleted');
  console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
}
