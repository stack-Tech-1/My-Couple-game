-- Quiet hours: no push notifications between these hours, in the person's own time zone.
-- quiet_start null means off. Additive only.
alter table public.profiles add column if not exists quiet_start smallint check (quiet_start between 0 and 23);
alter table public.profiles add column if not exists quiet_end smallint check (quiet_end between 0 and 23);
alter table public.profiles add column if not exists time_zone text check (char_length(time_zone) <= 64);
