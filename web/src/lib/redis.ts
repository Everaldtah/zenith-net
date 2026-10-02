import 'server-only';
import { Redis as UpstashRedis } from '@upstash/redis';
import { createClient } from 'redis';

// Redis holds short-lived and high-churn data: rate-limit windows and download counters.
// Works with either provider the Vercel Marketplace hands out: Upstash (REST) or Redis Cloud (REDIS_URL, TCP).
// With neither configured, limits allow everything and counters read 0, so local dev needs no Redis.

interface Kv {
  incrExpire(key: string, ttl: number): Promise<number>;
  incr(key: string): Promise<number>;
  mget(keys: string[]): Promise<(string | null)[]>;
}

const REST_URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const TCP_URL = process.env.REDIS_URL ?? process.env.KV_URL;

let kv: Promise<Kv | null> | null = null;

function connect(): Promise<Kv | null> {
  if (REST_URL && REST_TOKEN) {
    const r = new UpstashRedis({ url: REST_URL, token: REST_TOKEN });
    return Promise.resolve({
      async incrExpire(key, ttl) {
        const [n] = await r.pipeline().incr(key).expire(key, ttl, 'NX').exec<[number, number]>();
        return n;
      },
      incr: key => r.incr(key),
      mget: async keys => (keys.length ? (await r.mget<(string | number | null)[]>(...keys)).map(v => (v == null ? null : String(v))) : []),
    });
  }
  if (TCP_URL) {
    const c = createClient({ url: TCP_URL, socket: { connectTimeout: 3000, reconnectStrategy: n => Math.min(n * 200, 2000) } });
    c.on('error', e => console.error('[redis]', e.message));
    return c.connect().then(
      () => ({
        async incrExpire(key, ttl) {
          const [n] = await c.multi().incr(key).expire(key, ttl, 'NX').exec();
          return Number(n);
        },
        incr: key => c.incr(key),
        mget: keys => (keys.length ? c.mGet(keys) : Promise.resolve([])),
      }),
      e => { console.error('[redis] connect failed:', e.message); kv = null; return null; },
    );
  }
  return Promise.resolve(null);
}

async function client() {
  kv ??= connect();
  return kv;
}

/** Fixed-window limiter: at most `max` hits per `windowSec` for this key. Fails open if Redis is down. */
export async function rateLimit(name: string, id: string, max: number, windowSec: number) {
  try {
    const r = await client();
    if (!r) return { ok: true, remaining: max };
    const slot = Math.floor(Date.now() / 1000 / windowSec);
    const n = await r.incrExpire(`rl:${name}:${id}:${slot}`, windowSec + 5);
    return { ok: n <= max, remaining: Math.max(0, max - n) };
  } catch (e) {
    console.error('[redis] rateLimit', (e as Error).message);
    return { ok: true, remaining: max };
  }
}

export async function bump(key: string) {
  try { await (await client())?.incr(key); } catch (e) { console.error('[redis] incr', (e as Error).message); }
}

export async function counters(keys: string[]): Promise<number[]> {
  try {
    const r = await client();
    if (!r) return keys.map(() => 0);
    return (await r.mget(keys)).map(v => Number(v ?? 0));
  } catch {
    return keys.map(() => 0);
  }
}
