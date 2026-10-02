// Installs, updates, uninstalls and launches game editions. Builds are the games' own NSIS installers on GitHub Releases,
// run silently into a folder the launcher picks (/S /D=dir), so a game installed by hand and one installed here are the same.
import { app, shell } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { download, type Progress } from './download';
import { installs, setInstall, settings, type Install } from './store';

export interface BuildInfo { version: string; url: string; sha256: string; size: number; notes: string }
export interface CatalogEdition { game: string; edition: string; name: string; exe: string; detect: string[]; online: boolean; latest: BuildInfo | null }

export type Phase = 'download' | 'verify' | 'install' | 'uninstall' | 'done' | 'error' | 'cancelled';
export interface JobEvent { key: string; phase: Phase; received?: number; total?: number; speed?: number; error?: string }
export interface EditionStatus { installed: boolean; dir: string | null; version: string | null; external: boolean; running: boolean; busy: Phase | null }

export const keyOf = (e: { game: string; edition: string }) => `${e.game}/${e.edition}`;
const expand = (p: string) => p.replace(/%([^%]+)%/g, (_, v: string) => process.env[v] ?? '');

const jobs = new Map<string, { abort: AbortController; phase: Phase }>();
const running = new Map<string, { proc: ChildProcess; started: number }>();

/** Spawn with an NSIS-style command line: NSIS wants /D=path unquoted and last, so arguments go through verbatim. */
function runNsis(exe: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const p = spawn(exe, args, { windowsVerbatimArguments: true, argv0: `"${exe}"`, stdio: 'ignore', windowsHide: true });
    p.once('error', reject);
    p.once('exit', code => (code === 0 ? resolve() : reject(new Error(`The installer stopped with code ${code}`))));
  });
}

function findInstall(e: CatalogEdition): Install | null {
  const k = keyOf(e);
  const known = installs()[k];
  if (known) {
    if (fs.existsSync(path.join(known.dir, e.exe))) return known;
    setInstall(k, null);                               // removed behind our back
  }
  for (const d of e.detect.map(expand)) {
    if (d && fs.existsSync(path.join(d, e.exe))) {
      const found: Install = { dir: d, version: null, installedAt: new Date().toISOString(), external: true };
      setInstall(k, found);
      return found;
    }
  }
  return null;
}

export function status(eds: CatalogEdition[]): Record<string, EditionStatus> {
  const out: Record<string, EditionStatus> = {};
  for (const e of eds) {
    const k = keyOf(e);
    const i = findInstall(e);
    out[k] = { installed: !!i, dir: i?.dir ?? null, version: i?.version ?? null, external: !!i?.external, running: running.has(k), busy: jobs.get(k)?.phase ?? null };
  }
  return out;
}

export async function install(e: CatalogEdition, emit: (ev: JobEvent) => void) {
  const k = keyOf(e);
  const build = e.latest;
  if (!build) throw new Error('This edition has no download yet');
  if (jobs.has(k)) throw new Error('Already working on it');
  if (running.has(k)) throw new Error('Close the game before updating it');

  const abort = new AbortController();
  const job = { abort, phase: 'download' as Phase };
  jobs.set(k, job);
  const send = (ev: Omit<JobEvent, 'key'>) => { job.phase = ev.phase; emit({ key: k, ...ev }); };
  const dir = findInstall(e)?.dir ?? path.join(settings().libraryDir, `${e.game}-${e.edition}`);
  const tmpDir = path.join(app.getPath('temp'), 'ZenithNet');
  const setup = path.join(tmpDir, `${e.game}-${e.edition}-${build.version}-setup.exe`);
  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    send({ phase: 'download', received: 0, total: build.size, speed: 0 });
    const r = await download(build.url, setup, build.size, (p: Progress) => send({ phase: 'download', ...p }), abort.signal);
    send({ phase: 'verify' });
    if (r.sha256 !== build.sha256) {
      fs.rmSync(r.part, { force: true });
      throw new Error('The download was damaged (its fingerprint didn’t match). Please try again.');
    }
    fs.rmSync(setup, { force: true });
    fs.renameSync(r.part, setup);
    send({ phase: 'install' });
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    await runNsis(setup, ['/S', `/D=${dir}`]);
    if (!fs.existsSync(path.join(dir, e.exe))) throw new Error('The installer finished but the game files are missing');
    repairShortcuts(dir, e.exe);
    setInstall(k, { dir, version: build.version, installedAt: new Date().toISOString() });
    fs.rmSync(setup, { force: true });
    send({ phase: 'done' });
  } catch (err) {
    if (abort.signal.aborted) send({ phase: 'cancelled' });
    else send({ phase: 'error', error: (err as Error).message });
  } finally {
    jobs.delete(k);
  }
}

export function cancel(k: string) { jobs.get(k)?.abort.abort(); }

/**
 * Some game installers make Desktop / Start menu shortcuts to '<product name>.exe', which doesn't exist (the real exe
 * has another name). Point any shortcut into this install folder whose target is missing at the game's exe.
 */
function repairShortcuts(dir: string, exe: string) {
  const target = path.join(dir, exe);
  const folders = [app.getPath('desktop'), path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs')];
  for (const folder of folders) {
    let names: string[] = [];
    try { names = fs.readdirSync(folder).filter(f => f.toLowerCase().endsWith('.lnk')); } catch { continue; }
    for (const n of names) {
      const lnk = path.join(folder, n);
      try {
        const s = shell.readShortcutLink(lnk);
        if (s.target && path.resolve(s.target).toLowerCase().startsWith(path.resolve(dir).toLowerCase() + path.sep) && !fs.existsSync(s.target)) {
          shell.writeShortcutLink(lnk, 'update', { target, cwd: dir, icon: target, iconIndex: 0 });
        }
      } catch { /* not a readable shortcut */ }
    }
  }
}

/** Refuses anything that doesn't look like a game folder, so a bad path can never wipe something else. */
function safeToDelete(dir: string, exe: string) {
  const parts = path.resolve(dir).split(path.sep).filter(Boolean);
  return parts.length >= 3 && fs.existsSync(path.join(dir, exe));
}

export async function uninstall(e: CatalogEdition, emit: (ev: JobEvent) => void) {
  const k = keyOf(e);
  const i = findInstall(e);
  if (!i) return;
  if (running.has(k)) throw new Error('Close the game first');
  if (jobs.has(k)) throw new Error('Already working on it');
  jobs.set(k, { abort: new AbortController(), phase: 'uninstall' });
  emit({ key: k, phase: 'uninstall' });
  try {
    const deletable = safeToDelete(i.dir, e.exe);      // checked before the uninstaller removes the exe
    const un = fs.readdirSync(i.dir).find(f => /^Uninstall .*\.exe$/i.test(f));
    // _?= runs the uninstaller in place and waits for it (otherwise NSIS copies itself to %TEMP% and returns at once)
    if (un) await runNsis(path.join(i.dir, un), ['/S', `_?=${i.dir}`]).catch(() => undefined);
    if (deletable) fs.rmSync(i.dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
    setInstall(k, null);
    emit({ key: k, phase: 'done' });
  } catch (err) {
    emit({ key: k, phase: 'error', error: (err as Error).message });
  } finally {
    jobs.delete(k);
  }
}

export function locate(e: CatalogEdition, dir: string) {
  if (!fs.existsSync(path.join(dir, e.exe))) throw new Error(`${e.exe} isn't in that folder`);
  setInstall(keyOf(e), { dir, version: null, installedAt: new Date().toISOString(), external: true });
}

export function launch(e: CatalogEdition, args: string[], onExit: (seconds: number) => void) {
  const k = keyOf(e);
  if (running.has(k)) return false;
  const i = findInstall(e);
  if (!i) throw new Error('Install the game first');
  const proc = spawn(path.join(i.dir, e.exe), args, { cwd: i.dir, detached: true, stdio: 'ignore' });
  const started = Date.now();
  running.set(k, { proc, started });
  const done = () => {
    if (!running.has(k)) return;
    running.delete(k);
    onExit(Math.round((Date.now() - started) / 1000));
  };
  proc.once('exit', done);
  proc.once('error', done);
  return true;
}

export const isRunning = (k: string) => running.has(k);
export const anyRunning = () => [...running.keys()];
