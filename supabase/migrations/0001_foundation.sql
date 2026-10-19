-- Twain: foundation schema
-- profiles, rooms, room_members, moments, rate limiting, realtime authorization.
-- Every table has RLS enabled. Writes that need cross-row checks go through
-- SECURITY DEFINER functions with explicit auth.uid() checks.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 32),
  avatar_key text not null default 'fig' check (char_length(avatar_key) <= 24),
  avatar_hue smallint not null default 12 check (avatar_hue between 0 and 359),
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Auto-create a profile row for each new auth user.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(split_part(new.raw_user_meta_data ->> 'full_name', ' ', 1), ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- rooms + members
-- A room holds at most two members. A user belongs to at most one room.
-- ---------------------------------------------------------------------------
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our room' check (char_length(name) between 1 and 40),
  invite_code text unique check (invite_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  created_by uuid references auth.users (id) on delete set null,
  paired_at timestamptz,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger rooms_touch before update on public.rooms
  for each row execute function public.touch_updated_at();

create table public.room_members (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  -- personal, per-member preferences
  theme text not null default 'day' check (theme in ('day', 'night', 'auto')),
  sound_enabled boolean not null default false,
  -- spicy section safety state (phase 6 uses these)
  age_confirmed_at timestamptz,
  spicy_opt_in boolean not null default false,
  max_heat smallint not null default 1 check (max_heat between 1 and 3),
  primary key (room_id, user_id),
  unique (user_id)
);

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;

create index room_members_room_idx on public.room_members (room_id);

-- Membership check used by every room-scoped policy.
create function public.is_room_member(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_members m
    where m.room_id = rid and m.user_id = auth.uid()
  );
$$;

create function public.my_room_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select room_id from public.room_members where user_id = auth.uid();
$$;

-- profiles: you can read yourself and your partner; write only yourself.
create policy "profiles: read self and partner" on public.profiles
  for select to authenticated
  using (id = auth.uid() or exists (
    select 1 from public.room_members m
    where m.user_id = profiles.id and m.room_id = public.my_room_id()
  ));

create policy "profiles: update self" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- rooms: members read; members update name/settings. Creation and pairing via functions.
create policy "rooms: members read" on public.rooms
  for select to authenticated using (public.is_room_member(id));

create policy "rooms: members update" on public.rooms
  for update to authenticated
  using (public.is_room_member(id)) with check (public.is_room_member(id));

-- Members may not rewrite pairing fields directly.
create function public.rooms_guard()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'authenticated' and (
    new.invite_code is distinct from old.invite_code or
    new.created_by is distinct from old.created_by or
    new.paired_at is distinct from old.paired_at
  ) then
    raise exception 'pairing fields are read-only';
  end if;
  return new;
end;
$$;

create trigger rooms_guard before update on public.rooms
  for each row execute function public.rooms_guard();

-- room_members: read both rows of your room; update only your own row.
create policy "members: read own room" on public.room_members
  for select to authenticated using (public.is_room_member(room_id));

create policy "members: update self" on public.room_members
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- rate limiting (fixed window, keyed by user + action)
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits integer not null
);
alter table public.rate_limits enable row level security;
-- no policies: only SECURITY DEFINER functions touch it.

create function public.hit_rate_limit(action text, max_hits integer, window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  k text := coalesce(auth.uid()::text, 'anon') || ':' || action;
  allowed boolean;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (k, now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => window_seconds) then now() else r.window_start end
  returning hits <= max_hits into allowed;
  return allowed;
end;
$$;

-- ---------------------------------------------------------------------------
-- pairing functions
-- ---------------------------------------------------------------------------
create function public.gen_invite_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.rooms where invite_code = code);
  end loop;
  return code;
end;
$$;

create function public.create_room(room_name text default 'Our room')
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rooms;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not public.hit_rate_limit('create_room', 5, 3600) then raise exception 'rate limited'; end if;
  if exists (select 1 from public.room_members where user_id = auth.uid()) then
    raise exception 'already in a room';
  end if;

  insert into public.rooms (name, invite_code, created_by)
  values (coalesce(nullif(trim(room_name), ''), 'Our room'), public.gen_invite_code(), auth.uid())
  returning * into r;

  insert into public.room_members (room_id, user_id) values (r.id, auth.uid());
  return r;
end;
$$;

-- Returns minimal info so the join screen can greet the inviter by name.
create function public.peek_invite(code text)
returns table (room_id uuid, room_name text, inviter_name text, is_full boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not public.hit_rate_limit('peek_invite', 30, 600) then raise exception 'rate limited'; end if;
  return query
    select r.id, r.name, coalesce(p.display_name, ''),
           (select count(*) from public.room_members m where m.room_id = r.id) >= 2
    from public.rooms r
    left join public.profiles p on p.id = r.created_by
    where r.invite_code = upper(trim(code));
end;
$$;

create function public.join_room(code text)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rooms;
  member_count integer;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not public.hit_rate_limit('join_room', 10, 600) then raise exception 'rate limited'; end if;

  select * into r from public.rooms where invite_code = upper(trim(code)) for update;
  if not found then raise exception 'invite not found'; end if;

  if exists (select 1 from public.room_members where user_id = auth.uid() and room_id = r.id) then
    return r; -- already here, idempotent
  end if;
  if exists (select 1 from public.room_members where user_id = auth.uid()) then
    raise exception 'already in a room';
  end if;

  select count(*) into member_count from public.room_members where room_id = r.id;
  if member_count >= 2 then raise exception 'room is full'; end if;

  insert into public.room_members (room_id, user_id) values (r.id, auth.uid());

  -- Pairing locks the room to these two people: the invite code is retired.
  update public.rooms set paired_at = now(), invite_code = null where id = r.id returning * into r;

  insert into public.moments (room_id, kind, actor_id, payload)
  values (r.id, 'paired', auth.uid(), '{}'::jsonb);

  return r;
end;
$$;

-- Leaving: the leaver's membership is removed. Spicy/private data is removed for
-- both members (phase 6 adds those tables to this function). If the room is
-- left empty it is deleted entirely. The remaining member keeps shared history
-- and gets a fresh invite code.
create function public.leave_room()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select room_id into rid from public.room_members where user_id = auth.uid();
  if rid is null then return; end if;

  delete from public.room_members where room_id = rid and user_id = auth.uid();

  if not exists (select 1 from public.room_members where room_id = rid) then
    delete from public.rooms where id = rid;
  else
    -- Reset safety opt-ins for the remaining member: a new pairing must re-consent.
    update public.room_members set spicy_opt_in = false where room_id = rid;
    update public.rooms set paired_at = null, invite_code = public.gen_invite_code() where id = rid;
  end if;
end;
$$;

create function public.regenerate_invite()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid := public.my_room_id();
  code text;
begin
  if rid is null then raise exception 'no room'; end if;
  if (select paired_at from public.rooms where id = rid) is not null then
    raise exception 'room already paired';
  end if;
  code := public.gen_invite_code();
  update public.rooms set invite_code = code where id = rid;
  return code;
end;
$$;

-- ---------------------------------------------------------------------------
-- moments: the shared timeline
-- ---------------------------------------------------------------------------
create table public.moments (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms (id) on delete cascade,
  kind text not null check (char_length(kind) <= 32),
  actor_id uuid references auth.users (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index moments_room_idx on public.moments (room_id, created_at desc);

alter table public.moments enable row level security;

create policy "moments: members read" on public.moments
  for select to authenticated using (public.is_room_member(room_id));
-- inserts happen from SECURITY DEFINER functions and the server.

-- ---------------------------------------------------------------------------
-- realtime authorization: private channels named room:<uuid>[:suffix]
-- ---------------------------------------------------------------------------
create function public.topic_room_id(topic text)
returns uuid
language plpgsql
immutable
as $$
declare
  part text := split_part(topic, ':', 2);
begin
  if split_part(topic, ':', 1) <> 'room' then return null; end if;
  return part::uuid;
exception when others then
  return null;
end;
$$;

create policy "realtime: room members receive" on realtime.messages
  for select to authenticated
  using (public.is_room_member(public.topic_room_id(realtime.topic())));

create policy "realtime: room members send" on realtime.messages
  for insert to authenticated
  with check (public.is_room_member(public.topic_room_id(realtime.topic())));

-- Postgres-changes subscriptions for the room home.
alter publication supabase_realtime add table public.room_members, public.rooms, public.moments;

grant execute on function
  public.create_room(text), public.join_room(text), public.peek_invite(text),
  public.leave_room(), public.regenerate_invite(), public.is_room_member(uuid), public.my_room_id()
to authenticated;
revoke execute on function public.hit_rate_limit(text, integer, integer) from anon, authenticated, public;
