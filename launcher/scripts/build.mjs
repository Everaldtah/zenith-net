// Build the launcher: renderer (Vite) + main/preload (esbuild) -> dist/; then optionally package + NSIS installer.
//   node scripts/build.mjs            build dist/ and package to out/ZenithNet-win32-x64
//   node scripts/build.mjs --dev      build dist/ only (then `electron .`)
//   node scripts/build.mjs --installer   ...and make out/installer/ZenithNet-Setup.exe
import { build as esbuild } from 'esbuild';
import { build as vite, loadEnv } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const env = loadEnv('production', ROOT, 'VITE_');
for (const k of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_SITE_URL']) if (!env[k]) throw new Error(`${k} missing from launcher/.env`);
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

fs.rmSync(path.join(ROOT, 'dist'), { recursive: true, force: true });
await vite({ configFile: path.join(ROOT, 'vite.config.mts'), logLevel: 'warn' });
const common = { bundle: true, platform: 'node', format: 'cjs', target: 'node22', external: ['electron'], logLevel: 'warning', legalComments: 'none' };
await esbuild({ ...common, entryPoints: [path.join(ROOT, 'src/main/main.ts')], outfile: path.join(ROOT, 'dist/main.cjs'), define: { __SITE__: JSON.stringify(env.VITE_SITE_URL) } });
await esbuild({ ...common, entryPoints: [path.join(ROOT, 'src/preload/preload.ts')], outfile: path.join(ROOT, 'dist/preload.cjs') });
fs.copyFileSync(path.join(ROOT, 'build/icon.ico'), path.join(ROOT, 'dist/icon.ico'));
console.log('built dist/ for', env.VITE_SITE_URL);
if (process.argv.includes('--dev')) process.exit(0);

const { packager } = await import('@electron/packager');
const [appDir] = await packager({
  dir: ROOT, out: path.join(ROOT, 'out'), overwrite: true, platform: 'win32', arch: 'x64',
  name: 'ZenithNet', executableName: 'ZenithNet', icon: path.join(ROOT, 'build/icon.ico'), asar: true, prune: false,
  ignore: [/^\/(src|scripts|tests|out|build|node_modules)($|\/)/, /^\/\.env/, /^\/(tsconfig\.json|vite\.config\.mts|package-lock\.json|README\.md)$/],
  appVersion: pkg.version, appCopyright: 'EveraldTah',
  win32metadata: { CompanyName: 'EveraldTah', FileDescription: 'Zenith.net', ProductName: 'Zenith.net', InternalName: 'ZenithNet' },
});
console.log('packaged:', appDir);

if (process.argv.includes('--installer')) {
  const { build: ebuild, Platform, Arch } = await import('electron-builder');
  const files = await ebuild({
    targets: Platform.WINDOWS.createTarget(['nsis'], Arch.x64), prepackaged: appDir,
    config: {
      appId: 'net.zenith.launcher', productName: 'Zenith.net', copyright: 'EveraldTah',
      directories: { output: path.join(ROOT, 'out', 'installer') },
      protocols: [{ name: 'Zenith.net', schemes: ['zenithnet'] }],
      // executableName: shortcuts must point at ZenithNet.exe, not '<productName>.exe'
      win: { icon: path.join(ROOT, 'build/icon.ico'), signAndEditExecutable: false, executableName: 'ZenithNet' },
      nsis: {
        oneClick: true, perMachine: false, runAfterFinish: true, createDesktopShortcut: true, createStartMenuShortcut: true,
        shortcutName: 'Zenith.net', artifactName: 'ZenithNet-Setup.exe', uninstallDisplayName: 'Zenith.net',
        installerIcon: path.join(ROOT, 'build/icon.ico'), uninstallerIcon: path.join(ROOT, 'build/icon.ico'), deleteAppDataOnUninstall: false,
      },
    },
  });
  console.log('installer:', files.filter(f => f.endsWith('.exe')).join(', '));
}
