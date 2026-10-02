-- Zenith.net schema v1: catalog, profiles (BattleTag-style handles), friends, presence, parties, play stats, forums.
-- Clients get read access through row level security; every write goes through a SECURITY DEFINER function below
-- that checks auth.uid() itself, so there are no insert/update/delete policies on purpose.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ catalog
create table public.games (
  slug        text primary key check (slug ~ '^[a-z0-9-]{2,40}$'),
  name        text not null,
  tagline     text not null default '',
  description text not null default '',
  genre       text not null default '',
  accent      text not null default '#3b82f6',
  site_url    text,
  sort        int  not null default 0,
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- one game can ship several installable editions (Nebula Dominion: the RTS and the Iron Descent FPS campaign)
create table public.game_editions (
  game    text not null references public.games(slug) on delete cascade,
  edition text not null check (edition ~ '^[a-z0-9-]{2,40}$'),
  name    text not null,
  exe     text not null,                 -- executable inside the install folder
  detect  text[] not null default '{}',  -- folders an earlier, non-launcher install may live in (%VARS% expanded by the launcher)
  online  boolean not null default false,-- can be played together from a launcher party
  sort    int not null default 0,
  primary key (game, edition)
);

create table public.game_builds (
  id         bigint generated always as identity primary key,
  game       text not null,
  edition    text not null,
  version    text not null,
  url        text not null,
  sha256     text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  size       bigint not null check (size > 0),
  notes      text not null default '',
  created_at timestamptz not null default now(),
  foreign key (game, edition) references public.game_editions(game, edition) on delete cascade,
  unique (game, edition, version)
);
create index game_builds_latest on public.game_builds (game, edition, created_at desc);

create table public.launcher_releases (
  version    text primary key,
  url        text not null,
  sha256     text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  size       bigint not null check (size > 0),
  notes      text not null default '',
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ people
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text not null check (username ~ '^[A-Za-z][A-Za-z0-9_]{2,11}$'),
  tag        int  not null check (tag between 1000 and 9999),
  avatar     text not null default 'hayate' check (avatar ~ '^[a-z_]{2,32}$'),
  bio        text not null default '' check (char_length(bio) <= 280),
  role       text not null default 'player' check (role in ('player', 'mod', 'dev')),
  created_at timestamptz not null default now()
);
create unique index profiles_handle on public.profiles (lower(username), tag);

create table public.friend_requests (
  from_id    uuid not null references public.profiles(id) on delete cascade,
  to_id      uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);
create index friend_requests_to on public.friend_requests (to_id);

-- stored in both directions so "my friends" is one index scan
create table public.friendships (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  friend_id  uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);
create index friendships_friend on public.friendships (friend_id);

-- written by the launcher (heartbeat every 2 min); older than 5 min reads as offline
create table public.presence (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  status     text not null default 'offline' check (status in ('online', 'away', 'busy', 'offline')),
  game       text,
  edition    text,
  updated_at timestamptz not null default now()
);

create table public.parties (
  id          uuid primary key default gen_random_uuid(),
  leader_id   uuid not null references public.profiles(id) on delete cascade,
  game        text,
  edition     text,
  launch_seq  int not null default 0,   -- bumped by "Play together"; members' launchers start the game when it changes
  launched_at timestamptz,
  created_at  timestamptz not null default now()
);

create table public.party_members (
  party_id  uuid not null references public.parties(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (party_id, user_id)
);
create unique index party_members_one_party on public.party_members (user_id);

create table public.party_invites (
  party_id   uuid not null references public.parties(id) on delete cascade,
  from_id    uuid not null references public.profiles(id) on delete cascade,
  to_id      uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (party_id, to_id)
);
create index party_invites_to on public.party_invites (to_id);

create table public.game_stats (
  user_id        uuid not null references public.profiles(id) on delete cascade,
  game           text not null references public.games(slug) on delete cascade,
  seconds_played bigint not null default 0,
  sessions       int not null default 0,
  last_played    timestamptz,
  primary key (user_id, game)
);

-- ------------------------------------------------------------------ forums
create table public.forum_boards (
  id          text primary key check (id ~ '^[a-z0-9-]{2,60}$'),
  game        text references public.games(slug) on delete cascade,   -- null = Zenith.net-wide board
  name        text not null,
  description text not null default '',
  kind        text not null default 'discussion' check (kind in ('news', 'discussion', 'bugs', 'suggestions', 'help')),
  dev_only    boolean not null default false,   -- only developers start threads (news); everyone may reply
  sort        int not null default 0
);

create table public.forum_threads (
  id           bigint generated always as identity primary key,
  board_id     text not null references public.forum_boards(id) on delete cascade,
  author_id    uuid references public.profiles(id) on delete set null,
  title        text not null check (char_length(title) between 4 and 120),
  status       text not null default 'open'
               check (status in ('open', 'investigating', 'planned', 'fixed', 'wontfix', 'duplicate', 'answered')),
  game_version text check (char_length(game_version) <= 40),
  pinned       boolean not null default false,
  locked       boolean not null default false,
  reply_count  int not null default 0,
  dev_replied  boolean not null default false,
  last_post_at timestamptz not null default now(),
  last_post_by uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index forum_threads_board on public.forum_threads (board_id, pinned desc, last_post_at desc);
create index forum_threads_author on public.forum_threads (author_id, created_at desc);

create table public.forum_posts (
  id         bigint generated always as identity primary key,
  thread_id  bigint not null references public.forum_threads(id) on delete cascade,
  author_id  uuid references public.profiles(id) on delete set null,
  body       text not null check (char_length(body) between 1 and 10000),
  is_op      boolean not null default false,
  deleted    boolean not null default false,
  created_at timestamptz not null default now(),
  edited_at  timestamptz
);
create index forum_posts_thread on public.forum_posts (thread_id, id);
create index forum_posts_author on public.forum_posts (author_id, created_at desc);

-- ------------------------------------------------------------------ helpers
create function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from friendships where user_id = a and friend_id = b)
$$;

create function public.my_party() returns uuid
language sql stable security definer set search_path = public as $$
  select party_id from party_members where user_id = auth.uid()
$$;

create function public.is_staff(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = uid and role in ('dev', 'mod'))
$$;

create function public.require_profile() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sign in first' using errcode = '28000'; end if;
  if not exists (select 1 from profiles where id = uid) then
    raise exception 'Choose your username first' using errcode = 'P0001';
  end if;
  return uid;
end $$;

-- "Name#1234" -> profile id (null when nobody has it)
create function public.find_handle(p_handle text) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare m text[];
begin
  m := regexp_match(trim(p_handle), '^([A-Za-z][A-Za-z0-9_]{2,11})#([0-9]{4})$');
  if m is null then return null; end if;
  return (select id from profiles where lower(username) = lower(m[1]) and tag = m[2]::int);
end $$;

-- presence older than 5 minutes means the launcher went away without saying so
create function public.live_status(p presence) returns text
language sql stable as $$
  select case when p.user_id is null or p.updated_at < now() - interval '5 minutes' then 'offline' else p.status end
$$;

-- ------------------------------------------------------------------ RLS (read side)
alter table public.games enable row level security;
alter table public.game_editions enable row level security;
alter table public.game_builds enable row level security;
alter table public.launcher_releases enable row level security;
alter table public.profiles enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.presence enable row level security;
alter table public.parties enable row level security;
alter table public.party_members enable row level security;
alter table public.party_invites enable row level security;
alter table public.game_stats enable row level security;
alter table public.forum_boards enable row level security;
alter table public.forum_threads enable row level security;
alter table public.forum_posts enable row level security;

create policy "public read" on public.games for select using (published);
create policy "public read" on public.game_editions for select using (true);
create policy "public read" on public.game_builds for select using (true);
create policy "public read" on public.launcher_releases for select using (true);
create policy "public read" on public.profiles for select using (true);
create policy "public read" on public.game_stats for select using (true);
create policy "public read" on public.forum_boards for select using (true);
create policy "public read" on public.forum_threads for select using (true);
create policy "public read" on public.forum_posts for select using (true);

create policy "own requests" on public.friend_requests for select to authenticated
  using (from_id = auth.uid() or to_id = auth.uid());
create policy "own friendships" on public.friendships for select to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid());
create policy "self and friends" on public.presence for select to authenticated
  using (user_id = auth.uid() or public.are_friends(auth.uid(), user_id));
create policy "members and invitees" on public.parties for select to authenticated
  using (id = public.my_party() or exists (select 1 from party_invites i where i.party_id = id and i.to_id = auth.uid()));
create policy "members and invitees" on public.party_members for select to authenticated
  using (party_id = public.my_party() or exists (select 1 from party_invites i where i.party_id = party_members.party_id and i.to_id = auth.uid()));
create policy "own invites" on public.party_invites for select to authenticated
  using (to_id = auth.uid() or from_id = auth.uid() or party_id = public.my_party());

-- ------------------------------------------------------------------ profile
create function public.claim_battletag(p_username text) returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t int; tries int := 0; cur profiles;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  p_username := trim(p_username);
  if p_username !~ '^[A-Za-z][A-Za-z0-9_]{2,11}$' then
    raise exception 'Usernames are 3-12 letters, numbers or _, starting with a letter';
  end if;
  if lower(p_username) ~ '^(zenith|admin)' or lower(p_username) in
     ('moderator', 'mod', 'mods', 'developer', 'dev', 'devs', 'support', 'official', 'system', 'staff', 'root') then
    raise exception 'That username is reserved';
  end if;
  select * into cur from profiles where id = uid;
  -- keep the number when only the capitalisation changes
  if found and lower(cur.username) = lower(p_username) then
    update profiles set username = p_username where id = uid;
    return json_build_object('username', p_username, 'tag', cur.tag);
  end if;
  loop
    t := 1000 + floor(random() * 9000)::int;
    exit when not exists (select 1 from profiles where lower(username) = lower(p_username) and tag = t);
    tries := tries + 1;
    if tries > 60 then raise exception 'That name is very popular - try another'; end if;
  end loop;
  insert into profiles (id, username, tag) values (uid, p_username, t)
    on conflict (id) do update set username = excluded.username, tag = excluded.tag;
  insert into presence (user_id) values (uid) on conflict do nothing;
  return json_build_object('username', p_username, 'tag', t);
end $$;

create function public.update_profile(p_avatar text, p_bio text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_profile();
begin
  update profiles set
    avatar = coalesce(nullif(trim(p_avatar), ''), avatar),
    bio = coalesce(left(trim(p_bio), 280), bio)
  where id = uid;
end $$;

-- ------------------------------------------------------------------ friends
create function public.send_friend_request(p_handle text) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_profile(); target uuid;
begin
  target := public.find_handle(p_handle);
  if target is null then raise exception 'No player called % (use Name#1234)', p_handle; end if;
  if target = uid then raise exception 'That is you'; end if;
  if public.are_friends(uid, target) then return 'already'; end if;
  -- they already asked me: accept instead of crossing requests
  if exists (select 1 from friend_requests where from_id = target and to_id = uid) then
    perform public.respond_friend_request(target, true);
    return 'accepted';
  end if;
  if (select count(*) from friend_requests where from_id = uid) >= 50 then
    raise exception 'Too many pending requests';
  end if;
  insert into friend_requests (from_id, to_id) values (uid, target) on conflict do nothing;
  return 'sent';
end $$;

create function public.respond_friend_request(p_from uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_profile();
begin
  delete from friend_requests where from_id = p_from and to_id = uid;
  if not found then raise exception 'That request is gone'; end if;
  if p_accept then
    if (select count(*) from friendships where user_id = uid) >= 500 then raise exception 'Friends list is full'; end if;
    insert into friendships (user_id, friend_id) values (uid, p_from), (p_from, uid) on conflict do nothing;
    delete from friend_requests where from_id = uid and to_id = p_from;
  end if;
end $$;

create function public.cancel_friend_request(p_to uuid) returns void
language sql security definer set search_path = public as $$
  delete from friend_requests where from_id = auth.uid() and to_id = p_to
$$;

create function public.remove_friend(p_friend uuid) returns void
language sql security definer set search_path = public as $$
  delete from friendships where (user_id = auth.uid() and friend_id = p_friend) or (user_id = p_friend and friend_id = auth.uid())
$$;

-- ------------------------------------------------------------------ presence + stats
create function public.set_presence(p_status text, p_game text default null, p_edition text default null) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_profile();
begin
  if p_status not in ('online', 'away', 'busy', 'offline') then raise exception 'bad status'; end if;
  insert into presence (user_id, status, game, edition, updated_at) values (uid, p_status, p_game, p_edition, now())
  on conflict (user_id) do update set status = excluded.status, game = excluded.game, edition = excluded.edition, updated_at = now();
end $$;

create function public.report_playtime(p_game text, p_seconds int) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_profile();
begin
  if p_seconds is null or p_seconds < 5 then return; end if;
  insert into game_stats (user_id, game, seconds_played, sessions, last_played)
  values (uid, p_game, least(p_seconds, 86400), 1, now())
  on conflict (user_id, game) do update set
    seconds_played = game_stats.seconds_played + least(p_seconds, 86400),
    sessions = game_stats.sessions + 1, last_played = now();
end $$;

-- ------------------------------------------------------------------ parties
create function public.party_leave() returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); pid uuid; left_count int; p parties;
begin
  pid := public.my_party();
  if pid is null then return; end if;
  delete from party_members where party_id = pid and user_id = uid;
  select count(*) into left_count from party_members where party_id = pid;
  if left_count <= 1 then
    delete from parties where id = pid;           -- a party of one is no party
  else
    select * into p from parties where id = pid;
    if p.leader_id = uid then
      update parties set leader_id = (select user_id from party_members where party_id = pid order by joined_at limit 1) where id = pid;
    end if;
  end if;
end $$;

create function public.party_invite(p_user uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_profile(); pid uuid;
begin
  if not public.are_friends(uid, p_user) then raise exception 'You can only invite friends'; end if;
  pid := public.my_party();
  if pid is null then
    insert into parties (leader_id) values (uid) returning id into pid;
    insert into party_members (party_id, user_id) values (pid, uid);
  end if;
  if exists (select 1 from party_members where party_id = pid and user_id = p_user) then return pid; end if;
  if (select count(*) from party_members where party_id = pid) >= 8 then raise exception 'The party is full (8)'; end if;
  insert into party_invites (party_id, from_id, to_id) values (pid, uid, p_user)
    on conflict (party_id, to_id) do update set created_at = now(), from_id = excluded.from_id;
  return pid;
end $$;

create function public.party_accept(p_party uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_profile();
begin
  if not exists (select 1 from party_invites where party_id = p_party and to_id = uid) then
    raise exception 'That invite expired';
  end if;
  if public.my_party() = p_party then delete from party_invites where party_id = p_party and to_id = uid; return; end if;
  perform public.party_leave();
  if (select count(*) from party_members where party_id = p_party) >= 8 then raise exception 'The party is full (8)'; end if;
  delete from party_invites where party_id = p_party and to_id = uid;
  insert into party_members (party_id, user_id) values (p_party, uid);
end $$;

create function public.party_decline(p_party uuid) returns void
language sql security definer set search_path = public as $$
  delete from party_invites where party_id = p_party and to_id = auth.uid()
$$;

create function public.party_kick(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); pid uuid := public.my_party();
begin
  if pid is null or not exists (select 1 from parties where id = pid and leader_id = uid) then raise exception 'Only the party leader can do that'; end if;
  if p_user = uid then perform public.party_leave(); return; end if;
  delete from party_members where party_id = pid and user_id = p_user;
  if (select count(*) from party_members where party_id = pid) <= 1 then delete from parties where id = pid; end if;
end $$;

create function public.party_launch(p_game text, p_edition text) returns int
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); pid uuid := public.my_party(); seq int;
begin
  if pid is null or not exists (select 1 from parties where id = pid and leader_id = uid) then raise exception 'Only the party leader can do that'; end if;
  if not exists (select 1 from game_editions where game = p_game and edition = p_edition and online) then
    raise exception 'That game has no party play';
  end if;
  update parties set game = p_game, edition = p_edition, launch_seq = launch_seq + 1, launched_at = now()
    where id = pid returning launch_seq into seq;
  return seq;
end $$;

-- everything the launcher's friends panel needs, in one call
create function public.my_social() returns json
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); pid uuid := public.my_party();
begin
  if uid is null then return null; end if;
  return json_build_object(
    'me', (select row_to_json(x) from (select id, username, tag, avatar, bio, role from profiles where id = uid) x),
    'friends', coalesce((select json_agg(x order by x.online desc, lower(x.username)) from (
        select p.id, p.username, p.tag, p.avatar, public.live_status(pr) as status,
               case when public.live_status(pr) = 'offline' then null else pr.game end as game,
               case when public.live_status(pr) = 'offline' then null else pr.edition end as edition,
               pr.updated_at, public.live_status(pr) <> 'offline' as online
        from friendships f join profiles p on p.id = f.friend_id left join presence pr on pr.user_id = p.id
        where f.user_id = uid) x), '[]'::json),
    'incoming', coalesce((select json_agg(x order by x.created_at desc) from (
        select p.id, p.username, p.tag, p.avatar, r.created_at
        from friend_requests r join profiles p on p.id = r.from_id where r.to_id = uid) x), '[]'::json),
    'outgoing', coalesce((select json_agg(x order by x.created_at desc) from (
        select p.id, p.username, p.tag, p.avatar, r.created_at
        from friend_requests r join profiles p on p.id = r.to_id where r.from_id = uid) x), '[]'::json),
    'party', (select json_build_object(
        'id', pa.id, 'leader_id', pa.leader_id, 'game', pa.game, 'edition', pa.edition,
        'launch_seq', pa.launch_seq, 'launched_at', pa.launched_at,
        'members', (select json_agg(m order by m.joined_at) from (
            select p.id, p.username, p.tag, p.avatar, pm.joined_at, public.live_status(pr) as status, pr.game
            from party_members pm join profiles p on p.id = pm.user_id left join presence pr on pr.user_id = p.id
            where pm.party_id = pa.id) m),
        'pending', coalesce((select json_agg(i) from (
            select p.id, p.username, p.tag, p.avatar from party_invites pi join profiles p on p.id = pi.to_id
            where pi.party_id = pa.id) i), '[]'::json))
      from parties pa where pa.id = pid),
    'invites', coalesce((select json_agg(x order by x.created_at desc) from (
        select pi.party_id, pi.created_at, p.id as from_id, p.username, p.tag, p.avatar,
               (select count(*) from party_members where party_id = pi.party_id) as size
        from party_invites pi join profiles p on p.id = pi.from_id
        where pi.to_id = uid and pi.created_at > now() - interval '30 minutes') x), '[]'::json)
  );
end $$;

-- ------------------------------------------------------------------ forums
-- flood control lives here, so it holds whether a post comes from the website, the launcher or the raw API
create function public.forum_throttle(uid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.is_staff(uid) then return; end if;
  if (select count(*) from forum_posts where author_id = uid and created_at > now() - interval '1 minute') >= 5 then
    raise exception 'Slow down - you can post again in a minute';
  end if;
  if (select count(*) from forum_posts where author_id = uid and created_at > now() - interval '1 day') >= 200 then
    raise exception 'Daily post limit reached';
  end if;
end $$;

create function public.forum_create_thread(p_board text, p_title text, p_body text, p_game_version text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_profile(); b forum_boards; tid bigint;
begin
  select * into b from forum_boards where id = p_board;
  if not found then raise exception 'No such board'; end if;
  if b.dev_only and not public.is_staff(uid) then raise exception 'Only developers post new threads here'; end if;
  perform public.forum_throttle(uid);
  insert into forum_threads (board_id, author_id, title, game_version, last_post_by, dev_replied)
    values (p_board, uid, trim(p_title), nullif(trim(coalesce(p_game_version, '')), ''), uid, public.is_staff(uid))
    returning id into tid;
  insert into forum_posts (thread_id, author_id, body, is_op) values (tid, uid, trim(p_body), true);
  return tid;
end $$;

create function public.forum_reply(p_thread bigint, p_body text) returns bigint
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_profile(); t forum_threads; pid bigint; staff boolean := public.is_staff(uid);
begin
  select * into t from forum_threads where id = p_thread;
  if not found then raise exception 'That thread is gone'; end if;
  if t.locked and not staff then raise exception 'This thread is locked'; end if;
  perform public.forum_throttle(uid);
  insert into forum_posts (thread_id, author_id, body) values (p_thread, uid, trim(p_body)) returning id into pid;
  update forum_threads set reply_count = reply_count + 1, last_post_at = now(), last_post_by = uid,
    dev_replied = dev_replied or staff
  where id = p_thread;
  return pid;
end $$;

create function public.forum_edit_post(p_post bigint, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_profile(); p forum_posts;
begin
  select * into p from forum_posts where id = p_post;
  if not found or p.deleted then raise exception 'That post is gone'; end if;
  if p.author_id is distinct from uid and not public.is_staff(uid) then raise exception 'You can only edit your own posts'; end if;
  update forum_posts set body = trim(p_body), edited_at = now() where id = p_post;
end $$;

-- returns 'thread' when the whole thread went away, 'post' otherwise
create function public.forum_delete_post(p_post bigint) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_profile(); p forum_posts; staff boolean := public.is_staff(uid); replies int;
begin
  select * into p from forum_posts where id = p_post;
  if not found or p.deleted then raise exception 'That post is gone'; end if;
  if p.author_id is distinct from uid and not staff then raise exception 'You can only delete your own posts'; end if;
  if p.is_op then
    select reply_count into replies from forum_threads where id = p.thread_id;
    if staff or replies = 0 then delete from forum_threads where id = p.thread_id; return 'thread'; end if;
  end if;
  update forum_posts set deleted = true, body = '[deleted]' where id = p_post;
  return 'post';
end $$;

create function public.forum_mod_thread(p_thread bigint, p_status text default null, p_pinned boolean default null, p_locked boolean default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_profile();
begin
  if not public.is_staff(uid) then raise exception 'Developers only'; end if;
  update forum_threads set
    status = coalesce(p_status, status), pinned = coalesce(p_pinned, pinned), locked = coalesce(p_locked, locked)
  where id = p_thread;
end $$;

-- ------------------------------------------------------------------ grants
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
-- read-only helpers the anon role's RLS checks call
grant execute on function public.are_friends(uuid, uuid), public.my_party(), public.live_status(presence) to anon;

-- ------------------------------------------------------------------ realtime (the launcher refetches my_social on any change)
alter publication supabase_realtime add table
  public.presence, public.friend_requests, public.friendships, public.parties, public.party_members, public.party_invites;

-- ------------------------------------------------------------------ forum index numbers
create view public.forum_board_stats with (security_invoker = true) as
  select b.id, count(t.id)::int as threads, coalesce(sum(t.reply_count + 1), 0)::int as posts, max(t.last_post_at) as last_post_at
  from public.forum_boards b left join public.forum_threads t on t.board_id = b.id
  group by b.id;
grant select on public.forum_board_stats to anon, authenticated;
