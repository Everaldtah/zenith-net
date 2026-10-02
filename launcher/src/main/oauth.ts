// "Continue with Google" for a desktop app: Google refuses sign-in inside embedded windows, so the sign-in page opens in
// the user's normal browser and Supabase redirects back to this one-shot loopback server with a PKCE code. The code is
// useless without the verifier the launcher kept, so nothing else on the PC can use it.
import { shell } from 'electron';
import http from 'node:http';

export const OAUTH_PORT = 47520;
export const OAUTH_REDIRECT = `http://127.0.0.1:${OAUTH_PORT}/auth/callback`;

let active: { server: http.Server; fail: (e: Error) => void } | null = null;

const page = (ok: boolean, msg: string) => `<!doctype html><meta charset="utf-8"><title>Zenith.net</title>
<style>body{margin:0;height:100vh;display:grid;place-items:center;background:#07090f;color:#e8ebf3;font:16px system-ui,sans-serif}
.c{max-width:420px;padding:36px;border:1px solid #212a3c;border-radius:14px;background:#0d1119;text-align:center}
h1{font-size:22px;margin:16px 0 8px}p{color:#8b94a9;margin:0}</style>
<div class="c"><svg width="48" height="48" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5fb0ff"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs><circle cx="16" cy="16" r="14.5" fill="none" stroke="url(#g)" stroke-width="2"/><path d="M16 3.5 19 13l9.5 3-9.5 3-3 9.5-3-9.5L3.5 16 13 13z" fill="url(#g)"/></svg>
<h1>${ok ? 'You’re signed in' : 'Sign-in didn’t finish'}</h1><p>${msg}</p></div>
${ok ? '<script>setTimeout(()=>window.close(),1500)</script>' : ''}`;

const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

export function cancelOAuth() {
  active?.fail(new Error('cancelled'));
}

/** Opens `authUrl` in the default browser and resolves with the ?code= Supabase sends back. */
export function waitForCode(authUrl: string, timeoutMs = 5 * 60_000): Promise<string> {
  cancelOAuth();
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err: Error | null, code?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      setTimeout(() => server.close(), 500);
      active = null;
      if (err) reject(err); else resolve(code!);
    };
    const server = http.createServer((req, res) => {
      const u = new URL(req.url ?? '/', OAUTH_REDIRECT);
      if (u.pathname !== '/auth/callback') { res.writeHead(404).end(); return; }
      const code = u.searchParams.get('code');
      const err = u.searchParams.get('error_description') ?? u.searchParams.get('error');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(page(!!code, code ? 'You can close this tab and go back to the Zenith.net launcher.' : esc(err ?? 'Please try again from the launcher.')));
      finish(code ? null : new Error(err ?? 'Sign-in was cancelled'), code ?? undefined);
    });
    const timer = setTimeout(() => finish(new Error('Sign-in timed out. Please try again.')), timeoutMs);
    active = { server, fail: e => finish(e) };
    server.once('error', () => finish(new Error(`Couldn't start Google sign-in: port ${OAUTH_PORT} is in use by another program.`)));
    server.listen(OAUTH_PORT, '127.0.0.1', () => { shell.openExternal(authUrl).catch(e => finish(e)); });
  });
}
