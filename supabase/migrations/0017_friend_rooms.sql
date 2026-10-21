-- Amah: friend rooms.
-- Two kinds of room. A couple room holds exactly two people and has everything (After Dark,
-- notes, moods...). A friend room holds up to 8, has an owner, and only gets games and chat.
-- Each person: at most one couple room and at most five friend rooms.
-- Every existing room becomes a couple room, with no change in behaviour.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.rooms
  add column kind text not null default 'couple' check (kind in ('couple', 'friends')),
  add column owner_id uuid references auth.users (id) on delete set null;
update public.rooms set owner_id = created_by;

-- One person may now be in several rooms.
alter table public.room_members drop constraint if exists room_members_user_id_key;
create index if not exists room_members_user_idx on public.room_members (user_id);

-- The room you opened last, so login can take you straight back there.
alter table public.profiles add column last_room_id uuid references public.rooms (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Limits, enforced on every insert into room_members (whichever function does it)
-- ---------------------------------------------------------------------------
create function public.room_members_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  k text;
  n integer;
begin
  -- Lock the room (serialises joins) and the person (serialises their joins elsewhere).
  select kind into k from public.rooms where id = new.room_id for update;
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 17));
  select count(*) into n from public.room_members where room_id = new.room_id;
  if n >= (case k when 'couple' then 2 else 8 end) then raise exception 'room is full'; end if;
  if k = 'couple' and exists (
    select 1 from public.room_members m join public.rooms r on r.id = m.room_id
    where m.user_id = new.user_id and r.kind = 'couple'
  ) then
    raise exception 'already in a couple room';
  end if;
  if k = 'friends' and (
    select count(*) from public.room_members m join public.rooms r on r.id = m.room_id
    where m.user_id = new.user_id and r.kind = 'friends'
  ) >= 5 then
    raise exception 'friend room limit';
  end if;
  return new;
end;
$$;
create trigger room_members_limits before insert on public.room_members
  for each row execute function public.room_members_limits();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- "My room" now means my couple room (After Dark, PIN, partner features).
create or replace function public.my_room_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.room_id from public.room_members m join public.rooms r on r.id = m.room_id
  where m.user_id = auth.uid() and r.kind = 'couple'
  limit 1;
$$;

create function public.room_kind(p_room uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select kind from public.rooms where id = p_room;
$$;
grant execute on function public.room_kind(uuid) to authenticated;

-- You can read the profile of anyone you share a room with.
drop policy "profiles: read self and partner" on public.profiles;
create policy "profiles: read self and roommates" on public.profiles
  for select to authenticated
  using (id = auth.uid() or exists (
    select 1 from public.room_members m where m.user_id = profiles.id and public.is_room_member(m.room_id)
  ));

-- ---------------------------------------------------------------------------
-- Couple-only data: refused in friend rooms at the database
-- ---------------------------------------------------------------------------
create function public.couple_room_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select kind from public.rooms where id = new.room_id) is distinct from 'couple' then
    raise exception 'only in a couple room';
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['daily_answers', 'love_notes', 'memories', 'bucket_items', 'nudges', 'countdowns', 'moods',
                           'room_challenges', 'custom_cards', 'fantasy_picks'] loop
    execute format('create trigger %I before insert on public.%I for each row execute function public.couple_room_only()', t || '_couple_only', t);
  end loop;
end;
$$;

-- After Dark only ever unlocks in a couple room.
create or replace function public.spicy_unlocked(p_room uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (select kind from public.rooms where id = p_room) = 'couple'
     and count(*) = 2 and bool_and(spicy_opt_in and age_confirmed_at is not null)
  from public.room_members where room_id = p_room;
$$;

-- The PIN lives on your couple-room membership.
create or replace function public.set_spicy_pin(p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_pin !~ '^[0-9]{4,8}$' then raise exception 'PIN must be 4 to 8 digits'; end if;
  if not public.hit_rate_limit('set_pin', 10, 3600) then raise exception 'rate limited'; end if;
  update public.room_members set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 10))
  where user_id = auth.uid() and room_id = public.my_room_id();
  if not found then raise exception 'no room'; end if;
end;
$$;

create or replace function public.verify_spicy_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  h text;
begin
  if not public.hit_rate_limit('verify_pin', 8, 600) then raise exception 'rate limited'; end if;
  select pin_hash into h from public.room_members where user_id = auth.uid() and room_id = public.my_room_id();
  if h is null then return false; end if;
  return h = extensions.crypt(p_pin, h);
end;
$$;

create or replace function public.has_spicy_pin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select pin_hash is not null from public.room_members where user_id = auth.uid() and room_id = public.my_room_id();
$$;

-- ---------------------------------------------------------------------------
-- Room fields: kind and owner are read-only to members. In a friend room only the owner renames,
-- and the couple-only anniversary can't be set.
-- ---------------------------------------------------------------------------
create or replace function public.rooms_guard()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'authenticated' then
    if new.invite_code is distinct from old.invite_code or
       new.created_by is distinct from old.created_by or
       new.paired_at is distinct from old.paired_at or
       new.kind is distinct from old.kind or
       new.owner_id is distinct from old.owner_id then
      raise exception 'pairing fields are read-only';
    end if;
    if old.kind = 'friends' and new.name is distinct from old.name and auth.uid() is distinct from old.owner_id then
      raise exception 'only the owner can rename the room';
    end if;
    if old.kind = 'friends' and new.together_since is distinct from old.together_since then
      raise exception 'only in a couple room';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Creating, joining, leaving
-- ---------------------------------------------------------------------------
drop function public.create_room(text);
create function public.create_room(room_name text default null, p_kind text default 'couple')
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rooms;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_kind not in ('couple', 'friends') then raise exception 'unknown room kind'; end if;
  if not public.hit_rate_limit('create_room', 10, 3600) then raise exception 'rate limited'; end if;

  insert into public.rooms (name, invite_code, created_by, owner_id, kind)
  values (coalesce(nullif(trim(room_name), ''), case p_kind when 'couple' then 'Our room' else 'Our crew' end),
          public.gen_invite_code(), auth.uid(), auth.uid(), p_kind)
  returning * into r;

  -- The limits trigger raises if this would be a second couple room or a sixth friend room.
  insert into public.room_members (room_id, user_id) values (r.id, auth.uid());
  return r;
end;
$$;

drop function public.peek_invite(text);
create function public.peek_invite(code text)
returns table (room_id uuid, room_name text, inviter_name text, is_full boolean, kind text, member_count integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not public.hit_rate_limit('peek_invite', 30, 600) then raise exception 'rate limited'; end if;
  return query
    select r.id, r.name, coalesce(p.display_name, ''),
           (select count(*) from public.room_members m where m.room_id = r.id) >= (case r.kind when 'couple' then 2 else 8 end),
           r.kind,
           (select count(*)::int from public.room_members m where m.room_id = r.id)
    from public.rooms r
    left join public.profiles p on p.id = coalesce(r.owner_id, r.created_by)
    where r.invite_code = upper(trim(code));
end;
$$;

create or replace function public.join_room(code text)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rooms;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not public.hit_rate_limit('join_room', 10, 600) then raise exception 'rate limited'; end if;

  select * into r from public.rooms where invite_code = upper(trim(code)) for update;
  if not found then raise exception 'invite not found'; end if;

  if exists (select 1 from public.room_members where user_id = auth.uid() and room_id = r.id) then
    return r; -- already here, idempotent
  end if;

  if r.kind = 'couple' then
    -- A block either way means the invite "doesn't exist": a blocked person learns nothing.
    if exists (
      select 1 from public.room_members m join public.blocks b
        on (b.blocker_id = m.user_id and b.blocked_id = auth.uid()) or (b.blocker_id = auth.uid() and b.blocked_id = m.user_id)
      where m.room_id = r.id
    ) then
      raise exception 'invite not found';
    end if;
    insert into public.room_members (room_id, user_id) values (r.id, auth.uid());
    -- Pairing locks the room to these two people: the invite code is retired.
    update public.rooms set paired_at = now(), invite_code = null where id = r.id returning * into r;
    insert into public.moments (room_id, kind, actor_id, payload) values (r.id, 'paired', auth.uid(), '{}'::jsonb);
  else
    -- Friend rooms keep their code so the owner can keep inviting (up to 8).
    insert into public.room_members (room_id, user_id) values (r.id, auth.uid());
    update public.rooms set paired_at = coalesce(paired_at, now()) where id = r.id returning * into r;
    insert into public.moments (room_id, kind, actor_id, payload) values (r.id, 'joined', auth.uid(), '{}'::jsonb);
  end if;
  return r;
end;
$$;

-- Removes one member from one room, with each kind's clean-up. Internal: callers check permissions.
create function public.remove_room_member(p_room uuid, p_user uuid, p_next_owner uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rooms;
  heir uuid;
begin
  select * into r from public.rooms where id = p_room for update;
  if not found then return; end if;
  delete from public.room_members where room_id = p_room and user_id = p_user;
  if not found then return; end if;

  if not exists (select 1 from public.room_members where room_id = p_room) then
    delete from public.rooms where id = p_room;
    return;
  end if;

  if r.kind = 'couple' then
    -- The remaining partner must re-consent with anyone new, and gets a fresh code.
    update public.room_members set spicy_opt_in = false where room_id = p_room;
    update public.rooms set paired_at = null, invite_code = public.gen_invite_code() where id = p_room;
  elsif r.owner_id = p_user then
    -- The owner's pick if they made one (and that person is still here), else the longest-standing member.
    select user_id into heir from public.room_members where room_id = p_room and user_id = p_next_owner;
    if heir is null then
      select user_id into heir from public.room_members where room_id = p_room order by joined_at, user_id limit 1;
    end if;
    update public.rooms set owner_id = heir where id = p_room;
  end if;
end;
$$;
revoke execute on function public.remove_room_member(uuid, uuid, uuid) from public, anon, authenticated;

-- Leave a room. Without a room id: your couple room (what the app always did).
drop function public.leave_room();
create function public.leave_room(p_room uuid default null, p_next_owner uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid := coalesce(p_room, public.my_room_id());
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if rid is null or not public.is_room_member(rid) then return; end if;
  perform public.remove_room_member(rid, auth.uid(), p_next_owner);
end;
$$;

-- Friend room owner: remove someone.
create function public.kick_room_member(p_room uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rooms;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into r from public.rooms where id = p_room;
  if not found or r.kind <> 'friends' or r.owner_id is distinct from auth.uid() then raise exception 'only the owner can do that'; end if;
  if p_user = auth.uid() then raise exception 'leave the room instead'; end if;
  perform public.remove_room_member(p_room, p_user, null);
end;
$$;

-- Friend room owner: hand the room to another member.
create function public.transfer_room_owner(p_room uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rooms;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into r from public.rooms where id = p_room for update;
  if not found or r.kind <> 'friends' or r.owner_id is distinct from auth.uid() then raise exception 'only the owner can do that'; end if;
  if not exists (select 1 from public.room_members where room_id = p_room and user_id = p_user) then raise exception 'not a member'; end if;
  update public.rooms set owner_id = p_user where id = p_room;
end;
$$;

-- A new invite code. Couple room: only while waiting for a partner. Friend room: the owner, any time.
drop function public.regenerate_invite();
create function public.regenerate_invite(p_room uuid default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid := coalesce(p_room, public.my_room_id());
  r public.rooms;
  code text;
begin
  if rid is null or not public.is_room_member(rid) then raise exception 'no room'; end if;
  select * into r from public.rooms where id = rid;
  if r.kind = 'couple' and r.paired_at is not null then raise exception 'room already paired'; end if;
  if r.kind = 'friends' and r.owner_id is distinct from auth.uid() then raise exception 'only the owner can do that'; end if;
  code := public.gen_invite_code();
  update public.rooms set invite_code = code where id = rid;
  return code;
end;
$$;

grant execute on function
  public.create_room(text, text), public.peek_invite(text), public.join_room(text), public.leave_room(uuid, uuid),
  public.kick_room_member(uuid, uuid), public.transfer_room_owner(uuid, uuid), public.regenerate_invite(uuid)
to authenticated;
revoke execute on function public.kick_room_member(uuid, uuid), public.transfer_room_owner(uuid, uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- Games: starting a game only retires live games of the same kind that share a player, so two
-- pairs in a friend room can play the same game at once. (In a couple room that's always both.)
-- ---------------------------------------------------------------------------
create or replace function public.create_game_session(
  p_room uuid, p_game text, p_players uuid[], p_created_by uuid, p_config jsonb,
  p_seed text, p_state jsonb, p_views jsonb, p_rematch_of uuid
)
returns public.game_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.game_sessions;
  uid uuid;
begin
  update public.game_sessions set status = 'abandoned', outcome = 'abandoned', finished_at = now()
  where room_id = p_room and game_id = p_game and status = 'active' and players && p_players;

  insert into public.game_sessions (room_id, game_id, players, created_by, config, rematch_of)
  values (p_room, p_game, p_players, p_created_by, p_config, p_rematch_of)
  returning * into s;

  insert into public.game_secrets (session_id, seed, state) values (s.id, p_seed, p_state);

  foreach uid in array p_players loop
    insert into public.game_views (session_id, user_id, version, view)
    values (s.id, uid, 0, p_views -> uid::text);
  end loop;

  return s;
end;
$$;

-- ---------------------------------------------------------------------------
-- Safety
-- ---------------------------------------------------------------------------
-- Report someone in a room. Without a room: your couple room and your partner (as before).
drop function public.file_report(text, text, uuid);
create function public.file_report(p_reason text, p_details text default null, p_message uuid default null, p_room uuid default null, p_reported uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid := coalesce(p_room, public.my_room_id());
  who uuid;
  snap jsonb;
  new_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not public.hit_rate_limit('report', 10, 3600) then raise exception 'rate limited'; end if;
  if rid is null or not public.is_room_member(rid) then raise exception 'no room'; end if;
  if p_reported is not null then
    select user_id into who from public.room_members where room_id = rid and user_id = p_reported and user_id <> auth.uid();
  elsif p_message is not null then
    select sender_id into who from public.chat_messages where id = p_message and room_id = rid and sender_id <> auth.uid();
  elsif public.room_kind(rid) = 'couple' then
    select user_id into who from public.room_members where room_id = rid and user_id <> auth.uid();
  end if;
  if who is null then raise exception 'no partner'; end if;

  if p_message is not null then
    select jsonb_build_object('id', id, 'kind', kind, 'body', body, 'media', media, 'created_at', created_at)
      into snap from public.chat_messages
      where id = p_message and room_id = rid and sender_id = who;
    if snap is null then raise exception 'message not found'; end if;
  end if;

  insert into public.reports (reporter_id, reported_id, room_id, message_id, message_snapshot, reason, details)
  values (auth.uid(), who, rid, p_message, snap, p_reason, nullif(trim(coalesce(p_details, '')), ''))
  returning id into new_id;
  return new_id;
end;
$$;
revoke execute on function public.file_report(text, text, uuid, uuid, uuid) from public, anon;
grant execute on function public.file_report(text, text, uuid, uuid, uuid) to authenticated;

-- Blocking your partner still means leaving your couple room.
create or replace function public.block_partner()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid := public.my_room_id();
  partner uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if rid is null then raise exception 'no room'; end if;
  select user_id into partner from public.room_members where room_id = rid and user_id <> auth.uid();
  if partner is null then raise exception 'no partner'; end if;
  insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), partner) on conflict do nothing;
  perform public.leave_room(rid);
end;
$$;

-- Blocking someone in a friend room hides them from you; nobody has to leave.
create function public.block_member(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_user = auth.uid() then raise exception 'not allowed'; end if;
  if not exists (
    select 1 from public.room_members a join public.room_members b on b.room_id = a.room_id
    where a.user_id = auth.uid() and b.user_id = p_user
  ) then
    raise exception 'not a member';
  end if;
  insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), p_user) on conflict do nothing;
end;
$$;
create function public.unblock_member(p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.blocks where blocker_id = auth.uid() and blocked_id = p_user;
$$;
revoke execute on function public.block_member(uuid), public.unblock_member(uuid) from public, anon;
grant execute on function public.block_member(uuid), public.unblock_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
-- Remove someone from every room they're in (before deleting an account). Returns their couple room.
create or replace function public.admin_remove_from_room(p_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  couple uuid;
  rid uuid;
begin
  select m.room_id into couple from public.room_members m join public.rooms r on r.id = m.room_id
  where m.user_id = p_user and r.kind = 'couple';
  for rid in select room_id from public.room_members where user_id = p_user loop
    perform public.remove_room_member(rid, p_user, null);
  end loop;
  return couple;
end;
$$;

drop function public.admin_find_user(text);
create function public.admin_find_user(p_email text)
returns table (
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  banned_until timestamptz,
  display_name text,
  room_id uuid,
  paired boolean,
  is_admin boolean,
  friend_rooms integer
)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.email::text, u.created_at, u.last_sign_in_at, u.banned_until, p.display_name,
         r.id, (r.paired_at is not null), exists (select 1 from public.app_admins a where a.user_id = u.id),
         (select count(*)::int from public.room_members fm join public.rooms fr on fr.id = fm.room_id where fm.user_id = u.id and fr.kind = 'friends')
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.rooms r on r.kind = 'couple' and exists (select 1 from public.room_members m where m.room_id = r.id and m.user_id = u.id)
  where lower(u.email) = lower(trim(p_email))
  limit 1;
$$;
revoke execute on function public.admin_find_user(text) from public, anon, authenticated;
grant execute on function public.admin_find_user(text) to service_role;

drop function public.admin_list_users(text, text, integer, integer);
create function public.admin_list_users(p_search text default null, p_filter text default 'all', p_limit integer default 50, p_offset integer default 0)
returns table (
  id uuid,
  email text,
  display_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  last_active date,
  banned_until timestamptz,
  is_admin boolean,
  room_id uuid,
  paired_at timestamptz,
  partner_id uuid,
  partner_email text,
  partner_name text,
  friend_rooms integer,
  total bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with act as (
    select by_user as uid, max(created_at)::date as d from public.game_moves where by_user is not null group by by_user
    union all
    select sender_id, max(created_at)::date from public.chat_messages group by sender_id
    union all
    select user_id, max(created_at)::date from public.daily_answers group by user_id
  ),
  last_act as (select uid, max(d) as d from act group by uid),
  couple as (
    select m.user_id, m.room_id, r.paired_at from public.room_members m join public.rooms r on r.id = m.room_id where r.kind = 'couple'
  ),
  friends as (
    select m.user_id, count(*)::int as n from public.room_members m join public.rooms r on r.id = m.room_id where r.kind = 'friends' group by m.user_id
  ),
  base as (
    select u.id, u.email::text as email, p.display_name, u.created_at, u.last_sign_in_at, la.d as last_active, u.banned_until,
           exists (select 1 from public.app_admins a where a.user_id = u.id) as is_admin,
           c.room_id, c.paired_at,
           pm.user_id as partner_id, pu.email::text as partner_email, pp.display_name as partner_name,
           coalesce(f.n, 0) as friend_rooms
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join last_act la on la.uid = u.id
    left join couple c on c.user_id = u.id
    left join public.room_members pm on pm.room_id = c.room_id and pm.user_id <> u.id
    left join auth.users pu on pu.id = pm.user_id
    left join public.profiles pp on pp.id = pm.user_id
    left join friends f on f.user_id = u.id
  ),
  filtered as (
    select * from base
    where (coalesce(trim(p_search), '') = ''
           or email ilike '%' || trim(p_search) || '%'
           or display_name ilike '%' || trim(p_search) || '%'
           or partner_email ilike '%' || trim(p_search) || '%')
      and case coalesce(p_filter, 'all')
            when 'paired' then partner_id is not null
            when 'waiting' then room_id is not null and partner_id is null
            when 'no_room' then room_id is null and friend_rooms = 0
            when 'friends' then friend_rooms > 0
            when 'suspended' then banned_until > now()
            when 'admins' then is_admin
            else true
          end
  )
  select f.*, count(*) over () as total
  from filtered f
  order by f.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0);
$$;
revoke execute on function public.admin_list_users(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.admin_list_users(text, text, integer, integer) to service_role;

-- admin_stats: rooms split by kind; "active couples" counts couple rooms only.
create or replace function public.admin_stats(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  days integer := least(greatest(coalesce(p_days, 30), 7), 120);
  since date := current_date - (days - 1);
  result jsonb;
begin
  with act as (
    select by_user as uid, created_at::date as d from public.game_moves
      where created_at >= current_date - 150 and by_user is not null
    union
    select sender_id, created_at::date from public.chat_messages where created_at >= current_date - 150
    union
    select user_id, created_at::date from public.daily_answers where created_at >= current_date - 150
  ),
  series as (select generate_series(since, current_date, interval '1 day')::date as d),
  daily as (
    select s.d,
      (select count(*) from auth.users u where u.created_at::date = s.d) as signups,
      (select count(distinct uid) from act a where a.d = s.d) as active,
      (select count(*) from public.game_sessions g where g.created_at::date = s.d and not public.is_spicy_game(g.game_id)) as games,
      (select count(*) from public.chat_messages m where m.created_at::date = s.d) as messages
    from series s
  ),
  games as (
    select game_id,
      count(*) as started,
      count(*) filter (where status = 'finished' and outcome is distinct from 'abandoned') as finished
    from public.game_sessions
    where created_at::date >= since and not public.is_spicy_game(game_id)
    group by game_id
  ),
  cohorts as (
    select date_trunc('week', u.created_at)::date as wk, u.id as uid from auth.users u
    where u.created_at >= date_trunc('week', now()) - interval '7 weeks'
  ),
  cohort_sizes as (select wk, count(*) as size from cohorts group by wk),
  retention as (
    select r.wk, r.size,
      (select jsonb_agg(
         case when r.wk + (k * 7) > current_date then null
         else round(100.0 * (select count(distinct c2.uid) from cohorts c2 join act a on a.uid = c2.uid
                              where c2.wk = r.wk and a.d >= r.wk + (k * 7) and a.d < r.wk + ((k + 1) * 7)) / r.size)
         end order by k)
       from generate_series(1, 4) k) as weeks
    from cohort_sizes r
  )
  select jsonb_build_object(
    'days', days,
    'generated_at', now(),
    'totals', jsonb_build_object(
      'users', (select count(*) from auth.users),
      'onboarded', (select count(*) from public.profiles where onboarded_at is not null),
      'suspended', (select count(*) from auth.users where banned_until > now()),
      'rooms', (select count(*) from public.rooms where kind = 'couple'),
      'paired_rooms', (select count(*) from public.rooms where kind = 'couple' and paired_at is not null),
      'friend_rooms', (select count(*) from public.rooms where kind = 'friends'),
      'friend_members', (select count(*) from public.room_members m join public.rooms r on r.id = m.room_id where r.kind = 'friends'),
      'new_users', (select count(*) from auth.users where created_at::date >= since),
      'active_users', (select count(distinct uid) from act where d >= since),
      'dau', (select count(distinct uid) from act where d = current_date),
      'wau', (select count(distinct uid) from act where d > current_date - 7),
      'mau', (select count(distinct uid) from act where d > current_date - 30),
      'active_couples', (select count(distinct m.room_id) from act a join public.room_members m on m.user_id = a.uid
                          join public.rooms r on r.id = m.room_id and r.kind = 'couple' where a.d >= since),
      'active_friend_rooms', (select count(distinct m.room_id) from act a join public.room_members m on m.user_id = a.uid
                          join public.rooms r on r.id = m.room_id and r.kind = 'friends' where a.d >= since),
      'games', (select coalesce(sum(started), 0) from games),
      'messages', (select count(*) from public.chat_messages where created_at::date >= since),
      'voice_notes', (select count(*) from public.chat_messages where kind = 'voice' and created_at::date >= since),
      'stickers', (select count(*) from public.chat_messages where kind = 'sticker' and created_at::date >= since)
    ),
    'daily', (select jsonb_agg(jsonb_build_object('d', d, 'signups', signups, 'active', active, 'games', games, 'messages', messages) order by d) from daily),
    'games', coalesce((select jsonb_agg(jsonb_build_object('game_id', game_id, 'started', started, 'finished', finished) order by started desc) from games), '[]'::jsonb),
    'retention', coalesce((select jsonb_agg(jsonb_build_object('week', wk, 'size', size, 'weeks', weeks) order by wk desc) from retention), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;
