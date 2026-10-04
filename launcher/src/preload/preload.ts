// The only bridge between the launcher UI and the main process.
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

const on = <T>(channel: string) => (cb: (v: T) => void) => {
  const h = (_e: IpcRendererEvent, v: T) => cb(v);
  ipcRenderer.on(channel, h);
  return () => { ipcRenderer.removeListener(channel, h); };
};

const api = {
  info: () => ipcRenderer.invoke('app:info'),
  win: {
    minimize: () => ipcRenderer.send('win:minimize'),
    maximize: () => ipcRenderer.send('win:maximize'),
    close: () => ipcRenderer.send('win:close'),
    show: () => ipcRenderer.send('win:show'),
    onMaximized: on<boolean>('win:maximized'),
  },
  openExternal: (url: string) => ipcRenderer.invoke('open:external', url),
  openFolder: (key: string) => ipcRenderer.invoke('open:folder', key),
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch: object) => ipcRenderer.invoke('settings:set', patch),
    pickLibrary: () => ipcRenderer.invoke('settings:pickLibrary'),
  },
  catalog: () => ipcRenderer.invoke('catalog:get'),
  games: {
    status: () => ipcRenderer.invoke('games:status'),
    install: (key: string) => ipcRenderer.invoke('games:install', key),
    repair: (key: string) => ipcRenderer.invoke('games:repair', key),
    cancel: (key: string) => ipcRenderer.invoke('games:cancel', key),
    uninstall: (key: string) => ipcRenderer.invoke('games:uninstall', key),
    locate: (key: string) => ipcRenderer.invoke('games:locate', key),
    launch: (key: string, args: string[]) => ipcRenderer.invoke('games:launch', key, args),
    onJob: on<unknown>('games:job'),
    onStarted: on<{ key: string }>('games:started'),
    onExited: on<{ key: string; seconds: number }>('games:exited'),
  },
  auth: {
    google: (url: string) => ipcRenderer.invoke('auth:google', url),
    cancelGoogle: () => ipcRenderer.invoke('auth:cancelGoogle'),
    handoff: (accessToken: string, next: string) => ipcRenderer.invoke('auth:handoff', accessToken, next),
    clearWeb: () => ipcRenderer.invoke('auth:clearWeb'),
  },
  launcher: {
    update: (rel: object) => ipcRenderer.invoke('launcher:update', rel),
    onProgress: on<{ received: number; total: number; speed: number }>('launcher:progress'),
  },
  onDeepLink: on<string>('deeplink'),
  onQuitting: on<void>('app:quitting'),
  readyToQuit: () => ipcRenderer.send('app:ready-to-quit'),
};

contextBridge.exposeInMainWorld('zenith', api);
export type ZenithApi = typeof api;
