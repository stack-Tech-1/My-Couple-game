-- Amah: Couple of the Week and Gang of the Week.
-- Every Thursday morning (Lagos) the best weeks are worked out from what rooms did together; the
-- top few are asked whether they'd like to be shown. On Friday morning the highest-placed room
-- that said yes wins and is shown to everyone until the next Friday. No answer counts as no, so
-- it falls to the next room by default. Only rooms that said yes are ever shown to anyone.
-- Additive: new tables and functions only.

create table public.spotlights (
  id uuid primary key default gen_random_uuid(),
  -- The Friday it's announced.
  week date not null,
  kind text not null check (kind in ('couple', 'gang')),
  room_id uuid not null references public.rooms (id) on delete cascade,
  rank smallint not null check (rank between 1 and 10),
  score integer not null check (score >= 0),
  grade text not null check (grade in ('A+', 'A', 'B+', 'B', 'C')),
  -- This week's numbers, as shown: days, games, team-up wins, dailies, level.
  stats jsonb not null default '{}'::jsonb check (pg_column_size(stats) < 2000),
  status text not null default 'asking' check (status in ('asking', 'won', 'passed')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (week, kind, room_id)
);
create index spotlights_week_idx on public.spotlights (week desc, kind, status);
alter table public.spotlights enable row level security;
-- Members see their own room's entries (to answer); winners are read through spotlight_current().
create policy "spotlights: own room" on public.spotlights for select to authenticated using (public.is_room_member(room_id));

create table public.spotlight_answers (
  spotlight_id uuid not null references public.spotlights (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  yes boolean not null,
  answered_at timestamptz not null default now(),
  primary key (spotlight_id, user_id)
);
alter table public.spotlight_answers enable row level security;
create policy "spotlight answers: own" on public.spotlight_answers for select to authenticated using (user_id = auth.uid());

-- "Send them love": one heart per person per winner.
create table public.spotlight_love (
  spotlight_id uuid not null references public.spotlights (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (spotlight_id, user_id)
);
alter table public.spotlight_love enable row level security;

-- Answer for yourself, while it's still being asked. A no can be changed to a yes and back
-- until Friday morning; after it's decided, a yes can still be taken back (the winner is then
-- taken down).
create function public.spotlight_answer(p_spotlight uuid, p_yes boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.spotlights;
begin
  select * into s from public.spotlights where id = p_spotlight;
  if s.id is null or not public.is_room_member(s.room_id) then raise exception 'not yours'; end if;
  if s.status = 'passed' then raise exception 'already decided'; end if;
  if s.status = 'won' and p_yes then raise exception 'already decided'; end if;
  insert into public.spotlight_answers (spotlight_id, user_id, yes) values (p_spotlight, auth.uid(), p_yes)
    on conflict (spotlight_id, user_id) do update set yes = excluded.yes, answered_at = now();
  -- Changing your mind after winning takes it down for everyone.
  if s.status = 'won' and not p_yes then update public.spotlights set status = 'passed', decided_at = now() where id = p_spotlight; end if;
end;
$$;
revoke execute on function public.spotlight_answer(uuid, boolean) from public, anon;
grant execute on function public.spotlight_answer(uuid, boolean) to authenticated;

create function public.spotlight_send_love(p_spotlight uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not exists (select 1 from public.spotlights where id = p_spotlight and status = 'won') then raise exception 'not shown'; end if;
  insert into public.spotlight_love (spotlight_id, user_id) values (p_spotlight, auth.uid()) on conflict do nothing;
  select count(*) into n from public.spotlight_love where spotlight_id = p_spotlight;
  return n;
end;
$$;
revoke execute on function public.spotlight_send_love(uuid) from public, anon;
grant execute on function public.spotlight_send_love(uuid) to authenticated;

-- This week's winners, for everyone: only what the winners agreed to show. Couples: real names
-- (never pet names) and avatars. Gangs: the room's name and how many are in it.
create function public.spotlight_current()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x order by x->>'kind'), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', s.id,
      'week', s.week,
      'kind', s.kind,
      'grade', s.grade,
      'stats', s.stats,
      'room_name', case when s.kind = 'gang' then r.name end,
      'members', (select count(*) from public.room_members m where m.room_id = s.room_id),
      'people', case when s.kind = 'couple' then (
        select jsonb_agg(jsonb_build_object('name', p.display_name, 'motif', p.avatar_key, 'hue', p.avatar_hue) order by m.joined_at)
        from public.room_members m join public.profiles p on p.id = m.user_id where m.room_id = s.room_id) end,
      'love', (select count(*) from public.spotlight_love l where l.spotlight_id = s.id),
      'loved', exists (select 1 from public.spotlight_love l where l.spotlight_id = s.id and l.user_id = auth.uid()),
      'mine', public.is_room_member(s.room_id)
    ) as x
    from public.spotlights s join public.rooms r on r.id = s.room_id
    where s.status = 'won' and s.week = (select max(week) from public.spotlights where status = 'won' and week <= current_date) and s.week > current_date - 7
  ) w;
$$;
revoke execute on function public.spotlight_current() from public, anon;
grant execute on function public.spotlight_current() to authenticated;

-- The week's numbers for every room of one kind, best first (server only). Spicy games never
-- count, and nothing here is shown unless the room says yes.
create or replace function public.spotlight_candidates(p_kind text, p_start timestamptz, p_end timestamptz, p_limit int default 10)
returns table (room_id uuid, members int, days int, games int, coop int, dailies int, active int, score int)
language sql
stable
security definer
set search_path = public
as $$
  with rooms_k as (
    select r.id, (select count(*) from public.room_members m where m.room_id = r.id)::int as n
    from public.rooms r where r.kind = case when p_kind = 'gang' then 'friends' else 'couple' end
  ),
  acts as (
    select s.room_id, m.by_user as uid, (m.created_at at time zone 'Africa/Lagos')::date as d
      from public.game_moves m join public.game_sessions s on s.id = m.session_id
      where m.created_at >= p_start and m.created_at < p_end and m.by_user is not null and not public.is_spicy_game(s.game_id)
    union
    -- Everyone in a finished game played that day, moves or not.
    select g.room_id, unnest(g.players), (g.finished_at at time zone 'Africa/Lagos')::date
      from public.game_sessions g
      where g.status = 'finished' and g.finished_at >= p_start and g.finished_at < p_end and not public.is_spicy_game(g.game_id)
    union
    select c.room_id, c.sender_id, (c.created_at at time zone 'Africa/Lagos')::date from public.chat_messages c where c.created_at >= p_start and c.created_at < p_end
    union
    select a.room_id, a.user_id, a.day from public.daily_answers a where a.day >= (p_start at time zone 'Africa/Lagos')::date and a.day < (p_end at time zone 'Africa/Lagos')::date
  ),
  per_day as (select a.room_id, a.d, count(distinct a.uid) as c from acts a group by a.room_id, a.d),
  days as (select p.room_id, count(*) filter (where p.c >= 2)::int as days from per_day p group by p.room_id),
  active as (select a.room_id, count(distinct a.uid)::int as active from acts a group by a.room_id),
  games as (
    select g.room_id, count(*)::int as games, count(*) filter (where g.outcome = 'coop_win')::int as coop
    from public.game_sessions g
    where g.status = 'finished' and g.finished_at >= p_start and g.finished_at < p_end and not public.is_spicy_game(g.game_id)
    group by g.room_id
  ),
  dailies as (
    select x.room_id, count(*)::int as dailies from (
      select a.room_id, a.day from public.daily_answers a
      where a.day >= (p_start at time zone 'Africa/Lagos')::date and a.day < (p_end at time zone 'Africa/Lagos')::date
      group by a.room_id, a.day having count(*) >= 2
    ) x group by x.room_id
  ),
  scored as (
    select k.id as room_id, k.n as members, coalesce(d.days, 0) as days, coalesce(g.games, 0) as games, coalesce(g.coop, 0) as coop,
      coalesce(q.dailies, 0) as dailies, coalesce(a.active, 0) as active
    from rooms_k k
    left join days d on d.room_id = k.id
    left join games g on g.room_id = k.id
    left join dailies q on q.room_id = k.id
    left join active a on a.room_id = k.id
    where k.n >= 2
  )
  select s.room_id, s.members, s.days, s.games, s.coop, s.dailies, s.active,
    case when p_kind = 'couple'
      then s.days * 10 + least(s.games, 20) * 2 + least(s.coop, 10) * 2 + s.dailies * 3
      else s.days * 8 + least(s.games, 40) * 2 + (s.active * 20 / greatest(s.members, 1))
    end::int as score
  from scored s
  where s.games + s.days > 0
  order by score desc, s.games desc
  limit p_limit;
$$;
revoke execute on function public.spotlight_candidates(text, timestamptz, timestamptz, int) from public, anon, authenticated;
grant execute on function public.spotlight_candidates(text, timestamptz, timestamptz, int) to service_role;
