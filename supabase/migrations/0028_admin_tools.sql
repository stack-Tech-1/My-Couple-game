-- Admin tools for the launch: an activity log, health checks, today's word by day, and
-- announcements aimed at a group. Additive only. All server-side (no policies: service role only).

-- Every admin action, who did it and when. Never deleted from the app.
create table public.admin_audit (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users (id) on delete set null,
  admin_email text,
  action text not null check (char_length(action) between 1 and 60),
  target text check (char_length(target) <= 200),
  detail jsonb not null default '{}'::jsonb check (pg_column_size(detail) < 4000),
  created_at timestamptz not null default now()
);
create index admin_audit_time_idx on public.admin_audit (created_at desc);
alter table public.admin_audit enable row level security;

-- The last time each background job or webhook ran, and its last failure.
create table public.app_health (
  key text primary key check (char_length(key) <= 60),
  last_ok_at timestamptz,
  last_error_at timestamptz,
  last_error text check (char_length(last_error) <= 500),
  detail text check (char_length(detail) <= 500),
  updated_at timestamptz not null default now()
);
alter table public.app_health enable row level security;

-- Today's word, set by hand for a day (otherwise the built-in list decides).
create table public.solo_word_days (
  day date primary key,
  word text not null check (word ~ '^[a-z]{5}$'),
  naija boolean not null default false,
  hint text check (char_length(hint) <= 80),
  set_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.solo_word_days enable row level security;

-- Announcements for everyone, or one group.
alter table public.announcements add column if not exists audience text not null default 'all'
  check (audience in ('all', 'free', 'plus', 'waiting'));
