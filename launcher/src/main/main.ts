// Zenith.net launcher - Electron main process.
import { BrowserWindow, Menu, Tray, app, dialog, ipcMain, nativeImage, net, session, shell } from 'electron';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { download } from './download';
import * as games from './games';
import { OAUTH_REDIRECT, cancelOAuth, waitForCode } from './oauth';
import * as store from './store';

declare const __SITE__: string;
const SITE = (process.env.ZENITH_SITE ?? __SITE__).replace(/\/$/, '');
const SITE_ORIGIN = new URL(SITE).origin;
const ownSite = (url: string) => { try { return new URL(url).origin === SITE_ORIGIN; } catch { return false; } };
const WEB_PARTITION = 'persist:zenithweb';
const PROTOCOL = 'zenithnet';

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;
let pendingLink: string | null = null;

// ------------------------------------------------------------------ single instance + zenithnet:// links
if (!app.requestSingleInstanceLock()) app.exit(0);

if (process.defaultApp) app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1] ?? '.')]);
else app.setAsDefaultProtocolClient(PROTOCOL);

const linkFrom = (argv: string[]) => argv.find(a => a.startsWith(`${PROTOCOL}://`)) ?? null;
pendingLink = linkFrom(process.argv);

app.on('second-instance', (_e, argv) => {
  show();
  const link = linkFrom(argv);
  if (link) win?.webContents.send('deeplink', link);
});

function show() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

// ------------------------------------------------------------------ window
const asset = (f: string) => path.join(__dirname, f);

function createWindow(hidden: boolean) {
  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 1000, minHeight: 640, frame: false, show: false,
    backgroundColor: '#07090f', title: 'Zenith.net', icon: asset('icon.ico'),
    webPreferences: { preload: asset('preload.cjs'), contextIsolation: true, sandbox: true, webviewTag: true, spellcheck: false },
  });
  win.once('ready-to-show', () => { if (!hidden) win?.show(); });
  win.on('close', e => {
    if (!quitting && store.settings().closeToTray) { e.preventDefault(); win?.hide(); }
  });
  win.on('maximize', () => win?.webContents.send('win:maximized', true));
  win.on('unmaximize', () => win?.webContents.send('win:maximized', false));
  win.on('closed', () => { win = null; });

  // the Forums tab is a <webview> on the website: no preload, no node, only our own site
  win.webContents.on('will-attach-webview', (e, prefs, params) => {
    delete prefs.preload;
    prefs.nodeIntegration = false;
    prefs.contextIsolation = true;
    prefs.sandbox = true;
    if (!ownSite(params.src) && params.src !== 'about:blank') e.preventDefault();
  });
  win.webContents.on('will-navigate', e => e.preventDefault());   // the launcher UI never navigates away

  if (process.env.ZENITH_DEV_URL) win.loadURL(process.env.ZENITH_DEV_URL);
  else win.loadFile(asset('renderer/index.html'));
}

app.on('web-contents-created', (_e, wc) => {
  wc.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  if (wc.getType() === 'webview') {
    wc.on('will-navigate', (e, url) => {
      if (!ownSite(url)) { e.preventDefault(); if (/^https?:\/\//.test(url)) shell.openExternal(url); }
    });
  }
});

function createTray() {
  const icon = nativeImage.createFromPath(asset('icon.ico')).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('Zenith.net');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Zenith.net', click: show },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]));
  tray.on('click', show);
}

// tell the UI we're leaving (so it can set presence to offline), give it a moment, then go
let quitAcked = false;
app.on('before-quit', e => {
  quitting = true;
  if (quitAcked || !win) return;
  e.preventDefault();
  win.webContents.send('app:quitting');
  setTimeout(() => { quitAcked = true; app.quit(); }, 1500);
});
ipcMain.on('app:ready-to-quit', () => { quitAcked = true; app.quit(); });

// ------------------------------------------------------------------ IPC
async function getJson(url: string, init?: RequestInit) {
  const r = await net.fetch(url, { cache: 'no-store', ...init });
  if (!r.ok) throw new Error(`${new URL(url).pathname}: HTTP ${r.status}`);
  return r.json();
}

let catalogEditions: games.CatalogEdition[] = [];
const editionFor = (key: string) => {
  const e = catalogEditions.find(x => games.keyOf(x) === key);
  if (!e) throw new Error('Unknown game');
  return e;
};
const emitJob = (ev: games.JobEvent) => win?.webContents.send('games:job', ev);

ipcMain.handle('app:info', () => ({ version: app.getVersion(), site: SITE, oauthRedirect: OAUTH_REDIRECT, link: pendingLink }));
ipcMain.on('win:minimize', () => win?.minimize());
ipcMain.on('win:maximize', () => (win?.isMaximized() ? win.unmaximize() : win?.maximize()));
ipcMain.on('win:close', () => win?.close());
ipcMain.on('win:show', () => show());
ipcMain.handle('open:external', (_e, url: string) => { if (/^https?:\/\//.test(url)) return shell.openExternal(url); });
ipcMain.handle('open:folder', (_e, key: string) => {
  const i = store.installs()[key];
  if (i) shell.openPath(i.dir);
});

ipcMain.handle('settings:get', () => store.settings());
ipcMain.handle('settings:set', (_e, patch: Partial<store.Settings>) => {
  const s = store.setSettings(patch);
  if ('startWithWindows' in patch) app.setLoginItemSettings({ openAtLogin: s.startWithWindows, args: ['--hidden'] });
  return s;
});
ipcMain.handle('settings:pickLibrary', async () => {
  const r = await dialog.showOpenDialog(win!, { title: 'Where should games be installed?', properties: ['openDirectory', 'createDirectory'], defaultPath: store.settings().libraryDir });
  if (r.canceled || !r.filePaths[0]) return store.settings();
  return store.setSettings({ libraryDir: r.filePaths[0] });
});

// the last catalog is kept on disk so installed games still show and launch when the PC is offline
const catalogCache = () => path.join(app.getPath('userData'), 'catalog.json');
ipcMain.handle('catalog:get', async () => {
  let c;
  try {
    c = await getJson(`${SITE}/api/catalog`);
    fs.writeFileSync(catalogCache(), JSON.stringify(c));
  } catch (err) {
    try { c = { ...JSON.parse(fs.readFileSync(catalogCache(), 'utf8')), offline: true }; } catch { throw err; }
  }
  catalogEditions = (c.games as { slug: string; editions: Omit<games.CatalogEdition, 'game'>[] }[])
    .flatMap(g => g.editions.map(e => ({ ...e, game: g.slug })));
  return c;
});
ipcMain.handle('games:status', () => games.status(catalogEditions));
ipcMain.handle('games:install', (_e, key: string) => { games.install(editionFor(key), emitJob); });
ipcMain.handle('games:cancel', (_e, key: string) => games.cancel(key));
ipcMain.handle('games:uninstall', (_e, key: string) => games.uninstall(editionFor(key), emitJob));
ipcMain.handle('games:locate', async (_e, key: string) => {
  const e = editionFor(key);
  const r = await dialog.showOpenDialog(win!, { title: `Find the folder that contains ${e.exe}`, properties: ['openDirectory'] });
  if (r.canceled || !r.filePaths[0]) return false;
  games.locate(e, r.filePaths[0]);
  return true;
});
ipcMain.handle('games:launch', (_e, key: string, args: string[]) => {
  const e = editionFor(key);
  const safeArgs = (args ?? []).filter(a => /^--zenith-[a-z-]+=[\w#:.\- ]{0,120}$/.test(a));
  const ok = games.launch(e, safeArgs, seconds => {
    win?.webContents.send('games:exited', { key, seconds });
    if (store.settings().minimizeOnPlay && !win?.isVisible()) show();
  });
  if (ok) {
    win?.webContents.send('games:started', { key });
    if (store.settings().minimizeOnPlay) win?.minimize();
  }
  return ok;
});

ipcMain.handle('auth:google', (_e, url: string) => waitForCode(url).finally(() => show()));
ipcMain.handle('auth:cancelGoogle', () => cancelOAuth());
ipcMain.handle('auth:handoff', async (_e, accessToken: string, next: string) => {
  const r = await getJson(`${SITE}/api/launcher/handoff`, {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ next }),
  });
  return r.url as string;
});
ipcMain.handle('auth:clearWeb', () => session.fromPartition(WEB_PARTITION).clearStorageData());

// self-update: download the new launcher installer, check its fingerprint, run it silently and relaunch
ipcMain.handle('launcher:update', async (_e, rel: { version: string; url: string; sha256: string; size: number }) => {
  if (games.anyRunning().length) throw new Error('Close your games before updating the launcher');
  const dir = path.join(app.getPath('temp'), 'ZenithNet');
  fs.mkdirSync(dir, { recursive: true });
  const setup = path.join(dir, `ZenithNet-Setup-${rel.version}.exe`);
  const r = await download(rel.url, setup, rel.size, p => win?.webContents.send('launcher:progress', p), new AbortController().signal);
  if (r.sha256 !== rel.sha256) { fs.rmSync(r.part, { force: true }); throw new Error('The update download was damaged. Try again.'); }
  fs.rmSync(setup, { force: true });
  fs.renameSync(r.part, setup);
  spawn(setup, ['/S', '--force-run'], { detached: true, stdio: 'ignore' }).unref();
  quitting = true; quitAcked = true;
  setTimeout(() => app.quit(), 300);
});

// ------------------------------------------------------------------ start
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow(process.argv.includes('--hidden'));
  createTray();
});

app.on('window-all-closed', () => { if (!store.settings().closeToTray) app.quit(); });
