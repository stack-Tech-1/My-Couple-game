-- Amah: anniversary and countdowns, mood check-ins, and 30-day challenges. All room-scoped.

-- When the couple got together (members set it; the partner sees it change live).
alter table public.rooms add column together_since date check (together_since is null or together_since >= date '1950-01-01');

-- ---------------------------------------------------------------------------
-- Countdowns: "3 days until we see each other".
-- ---------------------------------------------------------------------------
create table public.countdowns (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  on_date date not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index countdowns_room_idx on public.countdowns (room_id, on_date);
alter table public.countdowns enable row level security;
create policy "countdowns: members read" on public.countdowns for select to authenticated using (public.is_room_member(room_id));
create policy "countdowns: members add" on public.countdowns for insert to authenticated with check (public.is_room_member(room_id) and created_by = auth.uid());
create policy "countdowns: members remove" on public.countdowns for delete to authenticated using (public.is_room_member(room_id));
create trigger countdowns_rate before insert on public.countdowns
  for each row execute function public.enforce_rate_limit('countdown', '30', '3600');

-- ---------------------------------------------------------------------------
-- Mood check-in: one per person per day, visible to the partner.
-- ---------------------------------------------------------------------------
create table public.moods (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default ((now() at time zone 'utc')::date),
  mood text not null check (mood in ('great', 'happy', 'loved', 'calm', 'tired', 'stressed', 'sad', 'missing_you')),
  note text check (note is null or char_length(note) <= 140),
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id, day)
);
alter table public.moods enable row level security;
create policy "moods: members read" on public.moods for select to authenticated using (public.is_room_member(room_id));
create policy "moods: own insert" on public.moods for insert to authenticated with check (user_id = auth.uid() and public.is_room_member(room_id));
create policy "moods: own update" on public.moods for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_room_member(room_id));

-- ---------------------------------------------------------------------------
-- 30-day challenges: one running per room; each partner ticks each day.
-- ---------------------------------------------------------------------------
create table public.room_challenges (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  challenge_id text not null check (char_length(challenge_id) <= 40),
  started_on date not null default ((now() at time zone 'utc')::date),
  started_by uuid references auth.users (id) on delete set null,
  ended_at timestamptz
);
create unique index room_challenges_one_running on public.room_challenges (room_id) where ended_at is null;
alter table public.room_challenges enable row level security;
create policy "challenges: members read" on public.room_challenges for select to authenticated using (public.is_room_member(room_id));
create policy "challenges: members start" on public.room_challenges for insert to authenticated with check (public.is_room_member(room_id) and started_by = auth.uid() and ended_at is null);
create policy "challenges: members end" on public.room_challenges for update to authenticated using (public.is_room_member(room_id)) with check (public.is_room_member(room_id));

create table public.challenge_checks (
  room_challenge_id uuid not null references public.room_challenges (id) on delete cascade,
  day smallint not null check (day between 1 and 30),
  user_id uuid not null references auth.users (id) on delete cascade,
  done_at timestamptz not null default now(),
  primary key (room_challenge_id, day, user_id)
);
alter table public.challenge_checks enable row level security;
create policy "checks: members read" on public.challenge_checks
  for select to authenticated
  using (exists (select 1 from public.room_challenges c where c.id = room_challenge_id and public.is_room_member(c.room_id)));
-- Tick your own box, only for a day that has already unlocked.
create policy "checks: own tick" on public.challenge_checks
  for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from public.room_challenges c
    where c.id = room_challenge_id and public.is_room_member(c.room_id) and c.ended_at is null
      and day <= ((now() at time zone 'utc')::date - c.started_on) + 1));
create policy "checks: own untick" on public.challenge_checks for delete to authenticated using (user_id = auth.uid());

alter publication supabase_realtime add table public.moods, public.countdowns, public.challenge_checks;
