// Opens the built launcher (dist/) and saves screenshots of what it shows: node tests/ui-shot.mjs <outDir>
import { _electron as electron } from 'playwright-core';
import path from 'node:path';

const out = process.argv[2] ?? '.';
const app = await electron.launch({ args: [path.resolve('.')], env: { ...process.env } });
const win = await app.firstWindow();
await win.setViewportSize?.({ width: 1280, height: 800 }).catch(() => {});
await win.waitForTimeout(2500);
await win.screenshot({ path: path.join(out, 'launcher-1-welcome.png') });
const errors = [];
win.on('pageerror', e => errors.push(e.message));
await win.getByText('Register with email').click();
await win.waitForTimeout(600);
await win.screenshot({ path: path.join(out, 'launcher-2-register.png') });
await win.getByText('← Back').click().catch(() => {});
await win.waitForTimeout(400);
await win.getByRole('button', { name: 'Log in' }).first().click();
await win.waitForTimeout(600);
await win.screenshot({ path: path.join(out, 'launcher-3-login.png') });
console.log('errors:', errors.length ? errors : 'none');
await app.evaluate(({ app }) => app.exit(0));
