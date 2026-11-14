-- Amah: the Amah team has Plus free, and so does each admin's partner in their couple room
-- (friend rooms don't share it). One call instead of three, so every page stays quick.
-- Additive: a new function only.

create function public.staff_plus(p_users uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select u from unnest(p_users) as u
  where exists (select 1 from public.app_admins a where a.user_id = u)
     or exists (
       select 1
       from public.room_members m
       join public.rooms r on r.id = m.room_id and r.kind = 'couple'
       join public.room_members m2 on m2.room_id = m.room_id
       join public.app_admins a on a.user_id = m2.user_id
       where m.user_id = u
     );
$$;
revoke execute on function public.staff_plus(uuid[]) from public, anon, authenticated;
grant execute on function public.staff_plus(uuid[]) to service_role;
