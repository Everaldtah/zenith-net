-- purge_account_content: a party that would be left with one member dissolves, as when someone leaves it normally.
create or replace function public.purge_account_content(p_uid uuid) returns json
language plpgsql security definer set search_path = public as $$
declare threads_deleted int; posts_blanked int; pid uuid;
begin
  delete from forum_threads t
  where t.author_id = p_uid
    and not exists (select 1 from forum_posts p where p.thread_id = t.id and p.author_id is distinct from p_uid);
  get diagnostics threads_deleted = row_count;

  update forum_posts set body = '[deleted]', deleted = true where author_id = p_uid and not deleted;
  get diagnostics posts_blanked = row_count;

  select party_id into pid from party_members where user_id = p_uid;
  if pid is not null then
    if (select count(*) from party_members where party_id = pid) <= 2 then
      delete from parties where id = pid;
    else
      update parties set leader_id = (
        select user_id from party_members where party_id = pid and user_id <> p_uid order by joined_at limit 1)
      where id = pid and leader_id = p_uid;
    end if;
  end if;

  return json_build_object('threads_deleted', threads_deleted, 'posts_blanked', posts_blanked);
end $$;

revoke execute on function public.purge_account_content(uuid) from public, anon, authenticated;
grant execute on function public.purge_account_content(uuid) to service_role;
