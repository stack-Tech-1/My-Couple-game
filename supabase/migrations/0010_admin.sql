-- Amah: admin.
--
-- The admin sees NUMBERS ONLY: counts and rates, never anyone's messages, notes, answers,
-- photos, voice notes or After Dark activity. Every admin read goes through a function that only
-- the service role may call; the app checks is_admin() for the signed-in user first.

create table public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
-- no policies: only is_admin() and the service role read it.

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- App-wide switches (read by everyone, written only by the service role)
-- ---------------------------------------------------------------------------
create table public.app_config (
  key text primary key check (key ~ '^[a-z_]{1,40}$'),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
alter table public.app_config enable row level security;
create policy "config: everyone reads" on public.app_config for select to anon, authenticated using (true);

-- games.off: hidden and unplayable. games.new: wears a "New" tag in the library.
insert into public.app_config (key, value) values ('games', '{"off": [], "new": []}');

-- ---------------------------------------------------------------------------
-- Announcements (banner in every room while live)
-- ---------------------------------------------------------------------------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (char_length(body) between 1 and 600),
  tone text not null default 'info' check (tone in ('info', 'celebrate', 'heads_up')),
  link_url text check (link_url is null or link_url ~ '^(https://|/)'),
  link_label text check (link_label is null or char_length(link_label) between 1 and 30),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index announcements_live_idx on public.announcements (starts_at desc);
alter table public.announcements enable row level security;
create policy "announcements: live ones" on public.announcements
  for select to authenticated using (starts_at <= now() and (ends_at is null or ends_at > now()));

-- ---------------------------------------------------------------------------
-- Analytics (service role only)
-- ---------------------------------------------------------------------------
-- "Active" = made a game move, sent a chat message or answered the Daily Question that day (UTC).
create function public.admin_stats(p_days integer default 30)
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
    -- Share of each sign-up week's users who were active 1, 2, 3 and 4 weeks later (null = not yet).
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
      'rooms', (select count(*) from public.rooms),
      'paired_rooms', (select count(*) from public.rooms where paired_at is not null),
      'new_users', (select count(*) from auth.users where created_at::date >= since),
      'active_users', (select count(distinct uid) from act where d >= since),
      'dau', (select count(distinct uid) from act where d = current_date),
      'wau', (select count(distinct uid) from act where d > current_date - 7),
      'mau', (select count(distinct uid) from act where d > current_date - 30),
      'active_couples', (select count(distinct m.room_id) from act a join public.room_members m on m.user_id = a.uid where a.d >= since),
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
revoke execute on function public.admin_stats(integer) from public, anon, authenticated;
grant execute on function public.admin_stats(integer) to service_role;

-- Look one account up by exact email, for support. No content, only account facts.
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
  is_admin boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.email::text, u.created_at, u.last_sign_in_at, u.banned_until, p.display_name,
         m.room_id, (r.paired_at is not null), exists (select 1 from public.app_admins a where a.user_id = u.id)
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.room_members m on m.user_id = u.id
  left join public.rooms r on r.id = m.room_id
  where lower(u.email) = lower(trim(p_email))
  limit 1;
$$;
revoke execute on function public.admin_find_user(text) from public, anon, authenticated;
grant execute on function public.admin_find_user(text) to service_role;

-- Remove someone from their room on their behalf (used before deleting an account), with the
-- same partner-side reset leave_room() does.
create function public.admin_remove_from_room(p_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
begin
  select room_id into rid from public.room_members where user_id = p_user;
  if rid is null then return null; end if;
  delete from public.room_members where room_id = rid and user_id = p_user;
  if not exists (select 1 from public.room_members where room_id = rid) then
    delete from public.rooms where id = rid;
  else
    update public.room_members set spicy_opt_in = false where room_id = rid;
    update public.rooms set paired_at = null, invite_code = public.gen_invite_code() where id = rid;
  end if;
  return rid;
end;
$$;
revoke execute on function public.admin_remove_from_room(uuid) from public, anon, authenticated;
grant execute on function public.admin_remove_from_room(uuid) to service_role;

alter publication supabase_realtime add table public.app_config, public.announcements;
