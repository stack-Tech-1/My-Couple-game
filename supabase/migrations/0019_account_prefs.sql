-- Amah: the theme is a person's setting, not a room's. It follows them across rooms, sign-outs and
-- phones. New accounts match the phone (auto). Existing people keep a night/auto choice they made in
-- any room; everyone else starts on auto.
alter table public.profiles
  add column theme text not null default 'auto' check (theme in ('day', 'night', 'auto'));

update public.profiles p
set theme = coalesce(
  (select m.theme from public.room_members m where m.user_id = p.id and m.theme <> 'day' order by m.joined_at limit 1),
  'auto'
);

-- Joining another room keeps your sound setting instead of starting from the default.
create function public.room_members_inherit_prefs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prev boolean;
begin
  select sound_enabled into prev from public.room_members where user_id = new.user_id order by joined_at desc limit 1;
  if prev is not null then
    new.sound_enabled := prev;
  end if;
  return new;
end;
$$;
create trigger room_members_inherit_prefs before insert on public.room_members
  for each row execute function public.room_members_inherit_prefs();
