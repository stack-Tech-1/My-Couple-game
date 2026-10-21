-- Amah: push notifications and nudges.

-- Server-side secrets that live with the data (e.g. the VAPID key pair for web push).
-- No policies: only the service role reads or writes them.
create table public.app_secrets (
  key text primary key check (key ~ '^[a-z_]{1,40}$'),
  value text not null,
  created_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;

-- One row per device that allowed notifications.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  device text check (device is null or char_length(device) <= 120),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy "push: read own" on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy "push: add own" on public.push_subscriptions for insert to authenticated with check (user_id = auth.uid());
create policy "push: remove own" on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

-- What each person wants to hear about.
alter table public.profiles add column push_prefs jsonb not null
  default '{"invites": true, "turns": true, "messages": true, "daily": true, "nudges": true, "notes": true}'::jsonb;

-- "Is this person looking at Amah right now?" A heartbeat while the app is open and visible, so
-- notifications skip people who would see the thing anyway.
create table public.user_presence (
  user_id uuid primary key references auth.users (id) on delete cascade,
  seen_at timestamptz not null default now()
);
alter table public.user_presence enable row level security;
create policy "presence: write own" on public.user_presence for insert to authenticated with check (user_id = auth.uid());
create policy "presence: update own" on public.user_presence for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "presence: read own" on public.user_presence for select to authenticated using (user_id = auth.uid());

-- "Thinking of you" nudges. Kept for counts (weekly recap) and rate limiting.
create table public.nudges (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms (id) on delete cascade,
  from_user uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index nudges_room_idx on public.nudges (room_id, created_at desc);
alter table public.nudges enable row level security;
create policy "nudges: members read" on public.nudges for select to authenticated using (public.is_room_member(room_id));
create policy "nudges: send own" on public.nudges for insert to authenticated with check (from_user = auth.uid() and public.is_room_member(room_id));
create trigger nudges_rate before insert on public.nudges
  for each row execute function public.enforce_rate_limit('nudge', '30', '3600');
