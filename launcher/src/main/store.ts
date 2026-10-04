// Launcher state on disk: settings and which game editions are installed where. %APPDATA%/Zenith.net/state.json
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export interface Install {
  dir: string;
  version: string | null;   // null = found an install the launcher didn't make (version unknown)
  installedAt: string;
  external?: boolean;
  /** installed from chunks (no NSIS uninstaller; the launcher owns the folder) */
  chunked?: boolean;
  /** an update or repair was interrupted: finish it before playing */
  incomplete?: boolean;
}

export interface Settings {
  libraryDir: string;
  closeToTray: boolean;
  minimizeOnPlay: boolean;
  startWithWindows: boolean;
}

interface State { settings: Settings; installs: Record<string, Install> }

const file = () => path.join(app.getPath('userData'), 'state.json');

function defaults(): State {
  return {
    settings: {
      libraryDir: path.join(process.env.LOCALAPPDATA ?? app.getPath('userData'), 'ZenithNet', 'Games'),
      closeToTray: true,
      minimizeOnPlay: true,
      startWithWindows: false,
    },
    installs: {},
  };
}

let state: State | null = null;

export function load(): State {
  if (state) return state;
  const d = defaults();
  try {
    const raw = JSON.parse(fs.readFileSync(file(), 'utf8')) as Partial<State>;
    state = { settings: { ...d.settings, ...raw.settings }, installs: raw.installs ?? {} };
  } catch {
    state = d;
  }
  return state;
}

function save() {
  const tmp = file() + '.tmp';
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, file());
}

export const settings = () => load().settings;
export function setSettings(patch: Partial<Settings>) {
  Object.assign(load().settings, patch);
  save();
  return load().settings;
}

export const installs = () => load().installs;
export function setInstall(key: string, v: Install | null) {
  if (v) load().installs[key] = v; else delete load().installs[key];
  save();
}
