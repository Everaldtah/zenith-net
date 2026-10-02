// Publish a game build (or a launcher release): upload the installer to GitHub Releases, then add it to the catalog.
// The launcher picks it up within minutes, and the website shows it right away.
//
//   node scripts/publish.mjs --game zenith-umbra --edition main --version 1.4.0 --file path/Setup.exe --notes-file notes.md
//   node scripts/publish.mjs --launcher --version 1.0.1 --file launcher/out/installer/ZenithNet-Setup.exe --notes "Fixes"
//
// A brand-new game first needs a row in public.games + public.game_editions (copy supabase/migrations/0002_seed.sql
// into a new migration) and art in web/public/games/<slug>/ (banner.webp 1280x560, card.webp 640x360, icon.webp 128x128).
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { loadEnv } from './env.mjs';

const REPO = process.env.ZENITH_RELEASE_REPO ?? 'Everaldtah/zenith-net';
const arg = k => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const launcher = process.argv.includes('--launcher');
const game = arg('game'), edition = arg('edition') ?? 'main', version = arg('version'), file = arg('file');
const notes = arg('notes-file') ? fs.readFileSync(arg('notes-file'), 'utf8').trim() : (arg('notes') ?? '');
if (!version || !file || (!launcher && !game)) {
  console.error('usage: --game <slug> [--edition main] --version x.y.z --file <installer.exe> [--notes ".." | --notes-file f.md]   or   --launcher --version x.y.z --file <exe>');
  process.exit(2);
}
if (!fs.existsSync(file)) throw new Error(`no such file: ${file}`);

const uploadOnly = process.argv.includes('--upload-only');      // put the file on GitHub now, add it to the catalog later
const { url: supabaseUrl, serviceKey } = loadEnv();
if (!uploadOnly && (!supabaseUrl || !serviceKey)) throw new Error('Supabase credentials missing: run `npx vercel env pull .env.local` in web/');

// 1. fingerprint
const size = fs.statSync(file).size;
const sha256 = await new Promise((res, rej) => {
  const h = crypto.createHash('sha256');
  fs.createReadStream(file).on('data', c => h.update(c)).on('end', () => res(h.digest('hex'))).on('error', rej);
});
console.log(`${path.basename(file)}  ${(size / 1e6).toFixed(1)} MB  sha256 ${sha256}`);

// 2. GitHub release (one tag per build)
const tag = launcher ? `launcher-v${version}` : `${game}-${edition}-v${version}`;
const title = launcher ? `Zenith.net launcher ${version}` : `${game} (${edition}) ${version}`;
const gh = (...a) => execFileSync('gh', a, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
let exists = true;
try { gh('release', 'view', tag, '--repo', REPO); } catch { exists = false; }
if (!exists) gh('release', 'create', tag, '--repo', REPO, '--title', title, '--notes', notes || title, '--latest=false');
const assets = JSON.parse(gh('release', 'view', tag, '--repo', REPO, '--json', 'assets')).assets;
if (assets.some(a => a.name === path.basename(file) && a.size === size)) console.log(`already on ${REPO} release ${tag}, not uploading again`);
else {
  console.log(`uploading to ${REPO} release ${tag} ...`);
  execFileSync('gh', ['release', 'upload', tag, file, '--repo', REPO, '--clobber'], { stdio: 'inherit' });
}
const url = `https://github.com/${REPO}/releases/download/${tag}/${encodeURIComponent(path.basename(file))}`;
if (uploadOnly) { console.log(`uploaded (not in the catalog yet)
  ${url}`); process.exit(0); }

// 3. catalog row (upsert, so re-publishing the same version replaces it)
const table = launcher ? 'launcher_releases' : 'game_builds';
const row = launcher ? { version, url, sha256, size, notes } : { game, edition, version, url, sha256, size, notes };
const r = await fetch(`${supabaseUrl}/rest/v1/${table}?on_conflict=${launcher ? 'version' : 'game,edition,version'}`, {
  method: 'POST',
  headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify(row),
});
if (!r.ok) throw new Error(`catalog update failed: ${r.status} ${await r.text()}`);
console.log(`published ${launcher ? 'launcher' : `${game}/${edition}`} ${version}\n  ${url}`);
