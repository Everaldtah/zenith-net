// Reads the Supabase / Postgres credentials that `vercel env pull` wrote to web/.env.local.
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');

export function loadEnv() {
  const env = { ...process.env };
  for (const f of ['web/.env.local', 'web/.env.production.local', '.env']) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/.exec(line);
      if (m && env[m[1]] === undefined) env[m[1]] = m[2];
    }
  }
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL,
    serviceKey: env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY,
    anonKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    pg: env.POSTGRES_URL_NON_POOLING ?? env.POSTGRES_URL ?? env.DATABASE_URL,
  };
}
