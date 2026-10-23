-- Birthdays: day and month only, never the year. Readable by roommates through the existing
-- profiles policy, so your partner and friends can celebrate. Additive only.
alter table public.profiles add column if not exists birth_month smallint check (birth_month between 1 and 12);
alter table public.profiles add column if not exists birth_day smallint check (birth_day between 1 and 31);
alter table public.profiles add constraint profiles_birthday_pair check ((birth_month is null) = (birth_day is null));
alter table public.profiles add constraint profiles_birthday_real check (
  birth_month is null or birth_day <= case birth_month when 2 then 29 when 4 then 30 when 6 then 30 when 9 then 30 when 11 then 30 else 31 end
);

-- The daily reminder looks people up by date.
create index if not exists profiles_birthday_idx on public.profiles (birth_month, birth_day) where birth_month is not null;
