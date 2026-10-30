-- Amah Solo: single-player games, scores, today's word, challenges and Fix Am pictures.
-- Additive: new tables, two new profile columns. Gameplay runs on the phone; the server only
-- hands out a start ticket and saves the finished score.

-- "Just me for now" and the one-time "Still waiting for your person?" question.
alter table public.profiles add column if not exists solo_home boolean not null default false;
alter table public.profiles add column if not exists waiting_prompt_at timestamptz;

-- Do I share any room with this person?
create function public.shares_room_with(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select uid = auth.uid() or exists (
    select 1 from public.room_members a join public.room_members b on b.room_id = a.room_id
    where a.user_id = auth.uid() and b.user_id = uid
  );
$$;
grant execute on function public.shares_room_with(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Runs (start tickets) and scores
-- ---------------------------------------------------------------------------
create table public.solo_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  game_id text not null check (char_length(game_id) between 1 and 40),
  mode text not null default 'normal' check (char_length(mode) between 1 and 20),
  seed text not null check (char_length(seed) between 1 and 80),
  challenge_id uuid,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index solo_runs_user_idx on public.solo_runs (user_id, started_at desc);
alter table public.solo_runs enable row level security;

create table public.solo_scores (
  id uuid primary key default gen_random_uuid(),
  run_id uuid unique references public.solo_runs (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  game_id text not null check (char_length(game_id) between 1 and 40),
  mode text not null default 'normal' check (char_length(mode) between 1 and 20),
  seed text not null default '' check (char_length(seed) <= 80),
  score integer not null check (score >= 0),
  duration_ms integer not null check (duration_ms >= 0),
  meta jsonb not null default '{}'::jsonb check (pg_column_size(meta) < 2000),
  created_at timestamptz not null default now()
);
create index solo_scores_game_idx on public.solo_scores (game_id, mode, user_id, score desc);
create index solo_scores_user_idx on public.solo_scores (user_id, created_at desc);
alter table public.solo_scores enable row level security;
-- Your own scores, and the scores of people you share a room with (for the room boards).
create policy "solo scores: own and roommates" on public.solo_scores for select to authenticated using (public.shares_room_with(user_id));

-- ---------------------------------------------------------------------------
-- Today's word: guesses are judged on the server, so the answer never reaches the phone early.
-- ---------------------------------------------------------------------------
create table public.solo_word_plays (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  guesses text[] not null default '{}' check (cardinality(guesses) <= 6),
  marks text[] not null default '{}' check (cardinality(marks) <= 6),
  solved boolean not null default false,
  finished_at timestamptz,
  started_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.solo_word_plays enable row level security;
create policy "word plays: own" on public.solo_word_plays for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Challenges: "Beat my 2,400". To someone in your rooms, or as a link that brings someone new
-- into one of your friend rooms (never a couple room).
-- ---------------------------------------------------------------------------
create table public.solo_challenges (
  id uuid primary key default gen_random_uuid(),
  token text not null unique check (char_length(token) between 10 and 40),
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid references auth.users (id) on delete cascade,
  room_id uuid references public.rooms (id) on delete set null,
  game_id text not null check (char_length(game_id) between 1 and 40),
  mode text not null default 'normal',
  seed text not null default '',
  target integer not null check (target >= 0),
  from_score_id uuid references public.solo_scores (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'won', 'lost', 'expired')),
  accepted_by uuid references auth.users (id) on delete set null,
  result_score integer,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  finished_at timestamptz
);
create index solo_challenges_to_idx on public.solo_challenges (to_user, status);
create index solo_challenges_from_idx on public.solo_challenges (from_user, created_at desc);
alter table public.solo_challenges enable row level security;
create policy "challenges: the people in it" on public.solo_challenges for select to authenticated
  using (from_user = auth.uid() or to_user = auth.uid() or accepted_by = auth.uid());

-- Someone new arriving by a challenge link joins the sender's chosen friend room, exactly as an
-- invite code would let them (the usual limits apply). Never a couple room. Server only.
create function public.solo_join_challenge_room(p_room uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rooms;
begin
  select * into r from public.rooms where id = p_room for update;
  if not found or r.kind <> 'friends' then raise exception 'invite not found'; end if;
  if exists (select 1 from public.room_members where room_id = r.id and user_id = p_user) then return; end if;
  if exists (
    select 1 from public.room_members m join public.blocks b
      on (b.blocker_id = m.user_id and b.blocked_id = p_user) or (b.blocker_id = p_user and b.blocked_id = m.user_id)
    where m.room_id = r.id
  ) then
    raise exception 'invite not found';
  end if;
  insert into public.room_members (room_id, user_id) values (r.id, p_user);
  update public.rooms set paired_at = coalesce(paired_at, now()) where id = r.id;
  insert into public.moments (room_id, kind, actor_id, payload) values (r.id, 'joined', p_user, '{}'::jsonb);
end;
$$;
revoke execute on function public.solo_join_challenge_room(uuid, uuid) from public, anon, authenticated;
grant execute on function public.solo_join_challenge_room(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Fix Am pictures, managed from the admin. Live ones are readable by anyone signed in.
-- ---------------------------------------------------------------------------
create table public.fixam_pictures (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  place text not null default '' check (char_length(place) <= 80),
  note text not null default '' check (char_length(note) <= 200),
  link text check (link is null or (char_length(link) <= 300 and link ~ '^https://')),
  own_photo boolean not null default false,
  credit text check (credit is null or char_length(credit) <= 200),
  path text not null check (char_length(path) <= 200),
  live boolean not null default false,
  sort integer not null default 0,
  feature_on date unique,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (own_photo or credit is not null)
);
alter table public.fixam_pictures enable row level security;
create policy "fixam: live pictures" on public.fixam_pictures for select to authenticated using (live);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fixam', 'fixam', true, 3145728, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Today's word counts towards a couple's streak and level: a day you both finish it is a
-- shared day, and each one earns XP like a Daily Question answered together.
-- ---------------------------------------------------------------------------
create or replace function public.room_activity(p_room uuid, p_since date)
returns table (uid uuid, d date)
language sql
stable
security definer
set search_path = public
as $$
  select m.by_user, m.created_at::date from public.game_moves m join public.game_sessions s on s.id = m.session_id
    where s.room_id = p_room and m.by_user is not null and m.created_at >= p_since
  union
  select sender_id, created_at::date from public.chat_messages where room_id = p_room and created_at >= p_since
  union
  select user_id, day from public.daily_answers where room_id = p_room and day >= p_since
  union
  select from_user, created_at::date from public.nudges where room_id = p_room and created_at >= p_since
  union
  select author_id, created_at::date from public.love_notes where room_id = p_room and created_at >= p_since
  union
  select author_id, created_at::date from public.memories where room_id = p_room and created_at >= p_since
  union
  select w.user_id, w.day from public.solo_word_plays w join public.room_members rm on rm.user_id = w.user_id
    where rm.room_id = p_room and w.finished_at is not null and w.day >= p_since;
$$;

create or replace function public.room_progress(p_room uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_room_member(p_room) then raise exception 'not a member'; end if;

  with members as (select user_id from public.room_members where room_id = p_room),
  act as (select * from public.room_activity(p_room, (now() - interval '2 years')::date)),
  -- A shared day: both members did something.
  shared as (
    select d from act where uid in (select user_id from members) group by d having count(distinct uid) >= 2
  ),
  runs as (select d, d - (row_number() over (order by d))::int as grp from shared),
  streaks as (select min(d) as start_d, max(d) as end_d, count(*) as len from runs group by grp),
  sessions as (select * from public.game_sessions where room_id = p_room and status = 'finished'),
  dailies as (select day from public.daily_answers where room_id = p_room group by day having count(*) >= 2),
  words as (
    select w.day from public.solo_word_plays w
    where w.user_id in (select user_id from members) and w.finished_at is not null
    group by w.day having count(*) >= 2
  )
  select jsonb_build_object(
    'streak', coalesce((select len from streaks where end_d >= current_date - 1 order by end_d desc limit 1), 0),
    'best_streak', coalesce((select max(len) from streaks), 0),
    'shared_days', (select count(*) from shared),
    'games', (select count(*) from sessions),
    'kinds', (select count(distinct game_id) from sessions where not public.is_spicy_game(game_id)),
    'coop_wins', (select count(*) from sessions where outcome = 'coop_win'),
    'wins', coalesce((select jsonb_object_agg(winner, n) from (select winner, count(*) n from sessions where winner is not null group by winner) w), '{}'::jsonb),
    'whot_wins', coalesce((select max(n) from (select count(*) n from sessions where game_id = 'whot' and winner is not null group by winner) w), 0),
    'dailies', (select count(*) from dailies),
    'words', (select count(*) from words),
    'messages', (select count(*) from public.chat_messages where room_id = p_room),
    'voice', (select count(*) from public.chat_messages where room_id = p_room and kind = 'voice'),
    'nudges', (select count(*) from public.nudges where room_id = p_room),
    'notes', (select count(*) from public.love_notes where room_id = p_room),
    'memories', (select count(*) from public.memories where room_id = p_room),
    'bucket_done', (select count(*) from public.bucket_items where room_id = p_room and done_at is not null)
  ) into result;
  return result;
end;
$$;
