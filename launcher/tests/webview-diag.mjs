import { _electron as electron } from 'playwright-core';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
const scratch = path.resolve(process.argv[2]);
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const env = Object.fromEntries(fs.readFileSync(new URL('../../web/.env.local', import.meta.url), 'utf8').split(/\r?\n/).map(l => /^([A-Z0-9_]+)="?(.*?)"?$/.exec(l)).filter(Boolean).map(m => [m[1], m[2]]));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const email = `zn-diag-${crypto.randomBytes(3).toString('hex')}@zenith.test`, password = crypto.randomBytes(12).toString('base64url');
const { data: u } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
const run = crypto.randomBytes(3).toString('hex'); const local = path.join(scratch, 'l-' + run), roaming = path.join(scratch, 'r-' + run);
fs.mkdirSync(local, { recursive: true }); fs.mkdirSync(roaming, { recursive: true });
const app = await electron.launch({ args: [path.resolve('.')], env: { ...process.env, LOCALAPPDATA: local, ZENITH_USER_DATA: roaming } });
try {
  const win = await app.firstWindow();
  await win.waitForTimeout(3000);
  await win.screenshot({ path: path.join(scratch, 'shots', 'diag-start.png') });
  await win.getByText('Continue with Google').waitFor({ timeout: 15000 });
  await win.getByRole('button', { name: 'Log in' }).first().click();
  await win.locator('#l-email').fill(email); await win.locator('#l-pw').fill(password);
  await win.getByRole('button', { name: 'Log in', exact: true }).last().click();
  await win.getByPlaceholder('e.g. NovaStrike').fill('Diag' + crypto.randomBytes(2).toString('hex'));
  await win.getByRole('button', { name: /^Claim / }).click();
  await win.getByRole('button', { name: 'Forums' }).waitFor({ timeout: 20000 });
  await win.getByRole('button', { name: 'Forums' }).click();
  await win.waitForTimeout(10000);
  const host = await win.evaluate(() => { const r = document.querySelector('webview').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, win: [innerWidth, innerHeight] }; });
  const guest = await app.evaluate(async ({ webContents }) => { const w = webContents.getAllWebContents().find(x => x.getType() === 'webview'); const s = await w.executeJavaScript('({w: innerWidth, h: innerHeight, scrollY, bg: getComputedStyle(document.body).backgroundColor, url: location.href})'); const img = await w.capturePage(); return { ...s, png: img.toPNG().toString('base64') }; });
  fs.writeFileSync(path.join(scratch, 'shots', 'wv.png'), Buffer.from(guest.png, 'base64')); delete guest.png;
  console.log(JSON.stringify({ host, guest }));
} finally {
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await admin.auth.admin.deleteUser(u.user.id);
}
