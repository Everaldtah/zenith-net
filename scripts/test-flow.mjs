// End-to-end check of the database rules with two throwaway accounts (created confirmed via the admin API, so no
// emails are sent; deleted at the end). Run: node scripts/test-flow.mjs
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
const expectError = async (label, p) => { const { error } = await p; check(label, !!error, error ? `(${error.message})` : '(no error!)'); };

const run = crypto.randomBytes(3).toString('hex');
const users = [];
async function makeUser(tag) {
  const email = `zn-test-${run}-${tag}@zenith.test`;
  const password = crypto.randomBytes(12).toString('base64url');
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  users.push(data.user.id);
  const c = createClient(url, anonKey, opts);
  const { error: e2 } = await c.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  return { c, id: data.user.id };
}

try {
  const A = await makeUser('a'), B = await makeUser('b');
  const anon = createClient(url, anonKey, opts);

  // usernames
  await expectError('reserved name refused', A.c.rpc('claim_battletag', { p_username: 'Admin' }));
  await expectError('bad name refused', A.c.rpc('claim_battletag', { p_username: '1abc' }));
  await expectError('no profile yet -> friend request refused', A.c.rpc('send_friend_request', { p_handle: 'Nobody#1234' }));
  const { data: ta } = await A.c.rpc('claim_battletag', { p_username: `TestA${run}`.slice(0, 12) });
  const { data: tb } = await B.c.rpc('claim_battletag', { p_username: `TestB${run}`.slice(0, 12) });
  check('claim_battletag gives Name#1234', !!ta?.tag && !!tb?.tag, `${ta?.username}#${ta?.tag}, ${tb?.username}#${tb?.tag}`);
  await expectError('anon cannot call write functions', anon.rpc('claim_battletag', { p_username: 'Sneaky' }));
  await expectError('cannot insert into profiles directly', A.c.from('profiles').insert({ id: A.id, username: 'Hack', tag: 1111 }));
  const { data: upd } = await A.c.from('profiles').update({ role: 'dev' }).eq('id', A.id).select();
  check('cannot make yourself a developer', !upd?.length);

  // friends
  const { data: sent } = await A.c.rpc('send_friend_request', { p_handle: `${tb.username}#${tb.tag}` });
  check('friend request sent', sent === 'sent');
  const { data: aReqs } = await anon.from('friend_requests').select('*');
  check('strangers cannot see friend requests', (aReqs ?? []).length === 0);
  await B.c.rpc('respond_friend_request', { p_from: A.id, p_accept: true });
  const { data: sa } = await A.c.rpc('my_social');
  check('A sees B as friend', sa?.friends?.some(f => f.id === B.id));

  // presence: friends only
  await B.c.rpc('set_presence', { p_status: 'online', p_game: 'zenith-umbra', p_edition: 'main' });
  const { data: sa2 } = await A.c.rpc('my_social');
  const fb = sa2.friends.find(f => f.id === B.id);
  check('friend presence visible (online, in game)', fb?.online && fb?.game === 'zenith-umbra');
  const { data: anonPres } = await anon.from('presence').select('*');
  check('presence hidden from anonymous', (anonPres ?? []).length === 0);

  // parties
  const { data: pid } = await A.c.rpc('party_invite', { p_user: B.id });
  check('party created by invite', !!pid);
  const { data: sb1 } = await B.c.rpc('my_social');
  check('B sees the invite', sb1.invites.some(i => i.party_id === pid));
  await B.c.rpc('party_accept', { p_party: pid });
  const { data: sb2 } = await B.c.rpc('my_social');
  check('B joined the party', sb2.party?.id === pid && sb2.party.members.length === 2);
  await expectError('member cannot launch for the party', B.c.rpc('party_launch', { p_game: 'zenith-umbra', p_edition: 'main' }));
  await expectError('single-player edition refused for party play', A.c.rpc('party_launch', { p_game: 'nebula-dominion', p_edition: 'rts' }));
  const { data: seq } = await A.c.rpc('party_launch', { p_game: 'nebula-dominion', p_edition: 'iron-descent' });
  const { data: sb3 } = await B.c.rpc('my_social');
  check('Play together bumps launch_seq for members', seq === 1 && sb3.party.launch_seq === 1 && sb3.party.game === 'nebula-dominion');
  await B.c.rpc('party_leave');
  const { data: sa3 } = await A.c.rpc('my_social');
  check('party of one disbands', sa3.party === null);

  // forums
  await expectError('players cannot post in a news board', A.c.rpc('forum_create_thread', { p_board: 'zenith-umbra-news', p_title: 'Fake news', p_body: 'x' }));
  const { data: tid } = await A.c.rpc('forum_create_thread', { p_board: 'zenith-umbra-bugs', p_title: 'Test bug report', p_body: 'Steps:\n1. test', p_game_version: '1.4.0' });
  check('bug report created', !!tid);
  const { data: rid } = await B.c.rpc('forum_reply', { p_thread: tid, p_body: 'Same here' });
  const { data: th } = await anon.from('forum_threads').select('reply_count, status').eq('id', tid).single();
  check('reply counted, readable by anyone', !!rid && th?.reply_count === 1);
  await expectError("cannot edit someone else's post", B.c.rpc('forum_edit_post', { p_post: (await anon.from('forum_posts').select('id').eq('thread_id', tid).eq('is_op', true).single()).data.id, p_body: 'hijack' }));
  await expectError('players cannot change bug status', A.c.rpc('forum_mod_thread', { p_thread: tid, p_status: 'fixed' }));
  for (let i = 0; i < 5; i++) await A.c.rpc('forum_reply', { p_thread: tid, p_body: `flood ${i}` });
  await expectError('flood control stops a 6th post in a minute', A.c.rpc('forum_reply', { p_thread: tid, p_body: 'one too many' }));
  const { data: del } = await A.c.rpc('forum_delete_post', { p_post: (await anon.from('forum_posts').select('id').eq('thread_id', tid).eq('is_op', true).single()).data.id });
  check('author can delete own post', del === 'post');

  // playtime
  await A.c.rpc('report_playtime', { p_game: 'zenith-umbra', p_seconds: 1800 });
  const { data: gs } = await anon.from('game_stats').select('seconds_played').eq('user_id', A.id).single();
  check('play time recorded on public profile', gs?.seconds_played === 1800);
  await admin.from('forum_threads').delete().eq('id', tid);
} catch (e) {
  failures++;
  console.error('ERROR', e.message ?? e);
} finally {
  for (const id of users) await admin.auth.admin.deleteUser(id);
  console.log(`cleaned up ${users.length} test accounts`);
  console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
}
