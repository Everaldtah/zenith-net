# Zenith.net

An independent game platform: a website with accounts, friends and per-game forums, and a Windows launcher that
installs, updates and launches games and lets friends party up and play together.

| Part | Where | Stack |
|---|---|---|
| Website + API | `web/` → Vercel (`zenith-net`) | Next.js 16, Tailwind 4 |
| Launcher | `launcher/` → `ZenithNet-Setup.exe` on GitHub Releases | Electron 38, React 19, Vite |
| Database | `supabase/migrations/` | Supabase Postgres (auth, row level security, realtime) |
| Short-lived data | Redis from the Vercel Marketplace | rate limits, download counters |
| Game builds | GitHub Releases of this repo, one tag per build | the games' own NSIS installers |

## How the pieces talk

- **Accounts**: Supabase Auth. Google sign-in, or email + password confirmed with a 6-digit code. After the first
  sign-in everyone picks a username and gets a tag like `Name#1234` (`claim_battletag`).
- **Website**: cookie session (`@supabase/ssr`). Forum writes are server actions that call database functions.
- **Launcher**: its own Supabase session. Google sign-in opens the system browser and returns through
  `http://127.0.0.1:47520/auth/callback` (PKCE). The Forums tab is the website in a `<webview>`, signed in through
  `/api/launcher/handoff`, which mints a one-time link for that web view.
- **Writes** all go through `SECURITY DEFINER` functions in `0001_init.sql` that check `auth.uid()` themselves.
  Tables only have read policies.
- **Friends / presence / parties**: the launcher calls `my_social()` and refetches when Supabase Realtime reports a
  change. A heartbeat every 2 minutes keeps presence fresh; older than 5 minutes reads as offline.
- **Play together**: the party leader calls `party_launch(game, edition)`, which bumps `launch_seq`. Every member's
  launcher sees the bump and starts the game with
  `--zenith-user=Name#1234 --zenith-party=<party id>:<seq> --zenith-role=host|member`.
  A game that supports it uses the party id to put everyone in the same lobby (Nebula Dominion: Iron Descent does:
  the host invites party members and they accept automatically).

## Publishing a build

```bash
cd web && npx vercel env pull .env.local && cd ..     # once: credentials for the scripts
node scripts/publish.mjs --game nebula-dominion --edition rts --version 1.0.1 --file path/to/NebulaDominion-Setup.exe --notes-file notes.md
node scripts/publish.mjs --launcher --version 1.0.1 --file launcher/out/installer/ZenithNet-Setup.exe
```

The installer goes to a GitHub release (`<game>-<edition>-v<version>`), its SHA-256 and size go into
`game_builds`, and launchers offer the update within ten minutes. Installers must be electron-builder NSIS
installers (they're run as `Setup.exe /S /D=<folder>`). GitHub allows up to 2 GiB per file. Bigger builds go to
Cloudflare R2: `publish.mjs` only needs a different URL.

**A new game** needs a migration that adds its `games` + `game_editions` rows and forum boards (copy
`0002_seed.sql`), plus art in `web/public/games/<slug>/`: `banner.webp` 1280×560, `card.webp` 640×360,
`icon.webp` 128×128.

## Developing

```bash
npm run migrate                     # apply supabase/migrations to the linked database
cd web && npm run dev               # http://localhost:3000
cd launcher && npm run dev          # builds dist/ and opens Electron against VITE_SITE_URL
cd launcher && npm run dist         # out/installer/ZenithNet-Setup.exe
```

`launcher/.env` needs `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_SITE_URL`. All three are public
values that ship inside the app.

## One-time auth settings (Supabase dashboard → Authentication)

- **URL configuration**: Site URL = the website; redirect URLs = `https://<site>/**` and
  `http://127.0.0.1:47520/auth/callback`.
- **Email templates → Confirm signup**: include `{{ .Token }}` so people get a 6-digit code.
- **SMTP**: Supabase's built-in mailer only delivers to the project team's own addresses. Add an SMTP sender
  before opening registration to the public (a Gmail app password works).
- **Google provider**: a Google Cloud OAuth client (web application) with the redirect URI
  `https://<project>.supabase.co/auth/v1/callback`.
