-- Amah: the welcome tour. New people get it automatically the first time they reach their room;
-- people who were already here are asked once whether they'd like it. Either way it shows once.
alter table public.profiles
  add column tour text not null default 'auto' check (tour in ('auto', 'ask', 'done'));

update public.profiles set tour = 'ask' where onboarded_at is not null;
