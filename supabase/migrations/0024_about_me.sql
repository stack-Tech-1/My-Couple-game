-- About me: a few favourites people choose to share with their rooms (food, song, happy place, a
-- line about themselves). Readable by roommates through the existing profiles policy. Additive only.
alter table public.profiles add column if not exists about jsonb not null default '{}'::jsonb;
alter table public.profiles add constraint profiles_about_small check (pg_column_size(about) < 2048);
