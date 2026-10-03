-- Self-service account deletion: called by the website's server (service role) right before it deletes the auth user.
-- Threads nobody else replied to go away; everything else the person wrote is blanked, and the auth-user delete then
-- detaches their name (author_id -> null). Profile, friends, requests, presence, parties and play time cascade.

create function public.purge_account_content(p_uid uuid) returns json
language plpgsql security definer set search_path = public as $$
declare threads_deleted int; posts_blanked int;
begin
  delete from forum_threads t
  where t.author_id = p_uid
    and not exists (select 1 from forum_posts p where p.thread_id = t.id and p.author_id is distinct from p_uid);
  get diagnostics threads_deleted = row_count;

  update forum_posts set body = '[deleted]', deleted = true where author_id = p_uid and not deleted;
  get diagnostics posts_blanked = row_count;

  -- leaving a party properly hands leadership on instead of dissolving everyone's party
  if exists (select 1 from party_members where user_id = p_uid) then
    update parties pa set leader_id = (
      select pm.user_id from party_members pm where pm.party_id = pa.id and pm.user_id <> p_uid order by pm.joined_at limit 1)
    where pa.leader_id = p_uid
      and exists (select 1 from party_members pm where pm.party_id = pa.id and pm.user_id <> p_uid);
  end if;

  return json_build_object('threads_deleted', threads_deleted, 'posts_blanked', posts_blanked);
end $$;

revoke execute on function public.purge_account_content(uuid) from public, anon, authenticated;
grant execute on function public.purge_account_content(uuid) to service_role;
