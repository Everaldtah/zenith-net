import type { Catalog, EditionStatus, JobEvent, Settings } from './types';

export interface Zenith {
  info(): Promise<{ version: string; site: string; oauthRedirect: string; link: string | null }>;
  win: { minimize(): void; maximize(): void; close(): void; show(): void; onMaximized(cb: (m: boolean) => void): () => void };
  openExternal(url: string): Promise<void>;
  openFolder(key: string): Promise<void>;
  settings: { get(): Promise<Settings>; set(p: Partial<Settings>): Promise<Settings>; pickLibrary(): Promise<Settings> };
  catalog(): Promise<Catalog>;
  games: {
    status(): Promise<Record<string, EditionStatus>>;
    install(key: string): Promise<void>; cancel(key: string): Promise<void>; uninstall(key: string): Promise<void>;
    locate(key: string): Promise<boolean>; launch(key: string, args: string[]): Promise<boolean>;
    onJob(cb: (e: JobEvent) => void): () => void;
    onStarted(cb: (e: { key: string }) => void): () => void;
    onExited(cb: (e: { key: string; seconds: number }) => void): () => void;
  };
  auth: { google(url: string): Promise<string>; cancelGoogle(): Promise<void>; handoff(token: string, next: string): Promise<string>; clearWeb(): Promise<void> };
  launcher: { update(rel: object): Promise<void>; onProgress(cb: (p: { received: number; total: number; speed: number }) => void): () => void };
  onDeepLink(cb: (link: string) => void): () => void;
  onQuitting(cb: () => void): () => void;
  readyToQuit(): void;
}

declare global { interface Window { zenith: Zenith } }
export const zenith = window.zenith;
