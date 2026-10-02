// Applies supabase/migrations/*.sql in name order, once each (tracked in zn_meta.migrations).
//   npm run migrate
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { ROOT, loadEnv } from './env.mjs';

const { pg: url } = loadEnv();
if (!url) throw new Error('No POSTGRES_URL_NON_POOLING: run `npx vercel env pull .env.local` in web/ first');
const client = new pg.Client({ connectionString: url.replace(/[?&]sslmode=[^&]*/, ''), ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query('create schema if not exists zn_meta; create table if not exists zn_meta.migrations (name text primary key, applied_at timestamptz not null default now())');
const done = new Set((await client.query('select name from zn_meta.migrations')).rows.map(r => r.name));
const dir = path.join(ROOT, 'supabase', 'migrations');
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
  if (done.has(f)) continue;
  process.stdout.write(`applying ${f} ... `);
  try {
    await client.query('begin');
    await client.query(fs.readFileSync(path.join(dir, f), 'utf8'));
    await client.query('insert into zn_meta.migrations (name) values ($1)', [f]);
    await client.query('commit');
    console.log('ok');
  } catch (e) {
    await client.query('rollback');
    console.log('FAILED');
    console.error(e.message, e.position ? `(at char ${e.position})` : '');
    process.exitCode = 1;
    break;
  }
}
await client.end();
