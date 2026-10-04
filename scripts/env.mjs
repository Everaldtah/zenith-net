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

/** Cloudflare R2 settings from the git-ignored .env.auth. Never log the returned object. */
export function loadR2() {
  const env = { ...process.env };
  const p = path.join(ROOT, '.env.auth');
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/.exec(line);
      if (m && env[m[1]] === undefined) env[m[1]] = m[2];
    }
  }
  const r2 = {
    endpoint: env.R2_S3_ENDPOINT, bucket: env.R2_BUCKET, accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY, publicUrl: (env.R2_PUBLIC_URL ?? '').replace(/\/$/, ''),
  };
  for (const [k, v] of Object.entries(r2)) if (!v) throw new Error(`R2 setting missing in .env.auth: ${k}`);
  return r2;
}
