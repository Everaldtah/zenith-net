// Account deletion rules against the real database, with throwaway accounts: node scripts/test-delete.mjs
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import { loadEnv } from './env.mjs';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const { url, serviceKey, anonKey } = loadEnv();
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
let failures = 0;
const check = (label, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`); if (!ok) failures++; };

const run = crypto.randomBytes(3).toString('hex');
const ids = [];
async function makeUser(tag) {
  const email = `zn-del-${run}-${tag}@zenith.test`, password = crypto.randomBytes(12).toString('base64url');
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  ids.push(data.user.id);
  const c = createClient(url, anonKey, opts);
  await c.auth.signInWithPassword({ email, password });
  const { data: t } = await c.rpc('claim_battletag', { p_username: `Del${tag}${run}`.slice(0, 12) });
  return { c, id: data.user.id, handle: `${t.username}#${t.tag}` };
}

try {
  const A = await makeUser('a'), B = await makeUser('b');
  await A.c.rpc('send_friend_request', { p_handle: B.handle });
  await B.c.rpc('respond_friend_request', { p_from: A.id, p_accept: true });
  const { data: pid } = await A.c.rpc('party_invite', { p_user: B.id });
  await B.c.rpc('party_accept', { p_party: pid });
  const { data: lonely } = await A.c.rpc('forum_create_thread', { p_board: 'zenith-umbra-general', p_title: 'Nobody answers this', p_body: 'echo' });
  const { data: busy } = await A.c.rpc('forum_create_thread', { p_board: 'zenith-umbra-bugs', p_title: 'Someone answers this', p_body: 'my bug' });
  await B.c.rpc('forum_reply', { p_thread: busy, p_body: 'same here' });
  const { data: bThread } = await B.c.rpc('forum_create_thread', { p_board: 'zenith-umbra-general', p_title: "B's thread", p_body: 'hello' });
  await A.c.rpc('forum_reply', { p_thread: bThread, p_body: 'A replies' });

  const { error: denied } = await B.c.rpc('purge_account_content', { p_uid: A.id });
  check('signed-in players cannot call the purge', !!denied, denied ? `(${denied.message})` : '');

  // what the website's server action does
  const { data: purged, error: pe } = await admin.rpc('purge_account_content', { p_uid: A.id });
  check('purge ran', !pe, JSON.stringify(purged ?? pe?.message));
  const { error: de } = await admin.auth.admin.deleteUser(A.id);
  check('auth user deleted', !de, de?.message ?? '');
  ids.splice(ids.indexOf(A.id), 1);

  const q = (t) => admin.from(t);
  check('profile gone', !(await q('profiles').select('id').eq('id', A.id)).data.length);
  check('thread nobody answered is deleted', !(await q('forum_threads').select('id').eq('id', lonely)).data.length);
  const { data: bt } = await q('forum_threads').select('author_id').eq('id', busy).single();
  check('thread with replies stays, name taken off', bt && bt.author_id === null);
  const { data: busyPosts } = await q('forum_posts').select('body, author_id, is_op').eq('thread_id', busy).order('id');
  check("A's opening post blanked", busyPosts[0].body === '[deleted]' && busyPosts[0].author_id === null);
  check("B's reply untouched", busyPosts[1].body === 'same here' && busyPosts[1].author_id === B.id);
  const { data: bPosts } = await q('forum_posts').select('body, author_id').eq('thread_id', bThread).order('id');
  check("A's reply in B's thread blanked", bPosts[1].body === '[deleted]' && bPosts[1].author_id === null);
  const { data: sb } = await B.c.rpc('my_social');
  check("B's friend list no longer has A", !sb.friends.some(f => f.id === A.id));
  check('two-person party dissolved', sb.party === null);
  await q('forum_threads').delete().in('id', [busy, bThread]);
} catch (e) {
  failures++;
  console.error('ERROR', e.message ?? e);
} finally {
  for (const id of ids) await admin.auth.admin.deleteUser(id);
  console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
}
