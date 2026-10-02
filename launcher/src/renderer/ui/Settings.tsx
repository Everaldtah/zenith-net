import { useEffect, useState } from 'react';
import { zenith } from '../lib/bridge';
import type { Settings } from '../lib/types';

export function SettingsModal({ email, version, onClose, onSignOut }: { email: string; version: string; onClose: () => void; onSignOut: () => void }) {
  const [s, setS] = useState<Settings | null>(null);
  useEffect(() => { zenith.settings.get().then(setS); }, []);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  const set = async (p: Partial<Settings>) => setS(await zenith.settings.set(p));
  const Toggle = ({ k, label, hint }: { k: 'closeToTray' | 'minimizeOnPlay' | 'startWithWindows'; label: string; hint: string }) => (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-panel-2">
      <input type="checkbox" checked={!!s?.[k]} onChange={e => set({ [k]: e.target.checked })} className="mt-1 h-4 w-4 accent-[#2b8cff]" />
      <span><span className="block text-sm font-semibold">{label}</span><span className="text-xs text-muted">{hint}</span></span>
    </label>
  );
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="card anim-in w-[520px] p-6" onMouseDown={e => e.stopPropagation()} role="dialog" aria-label="Settings">
        <div className="flex items-center justify-between"><h2 className="h-display text-xl">Settings</h2><button onClick={onClose} className="text-muted hover:text-ink" aria-label="Close">✕</button></div>
        <div className="mt-5 space-y-5">
          <div>
            <div className="label">Game install folder</div>
            <div className="flex gap-2">
              <div className="input selectable truncate">{s?.libraryDir}</div>
              <button onClick={async () => setS(await zenith.settings.pickLibrary())} className="btn shrink-0">Change</button>
            </div>
            <p className="mt-1.5 text-xs text-muted">New installs go here. Games you already installed stay where they are.</p>
          </div>
          <div className="space-y-1">
            <Toggle k="closeToTray" label="Keep running in the tray when closed" hint="Friends see you online and party invites still reach you." />
            <Toggle k="minimizeOnPlay" label="Minimise the launcher when a game starts" hint="It comes back when you quit the game." />
            <Toggle k="startWithWindows" label="Start with Windows" hint="Opens quietly in the tray when you sign in to Windows." />
          </div>
          <div className="flex items-center justify-between border-t border-line pt-4 text-sm">
            <div><div className="font-semibold">{email}</div><div className="text-xs text-muted">Launcher version {version}</div></div>
            <button onClick={onSignOut} className="btn hover:border-bad hover:text-bad">Sign out</button>
          </div>
        </div>
      </div>
    </div>
  );
}
