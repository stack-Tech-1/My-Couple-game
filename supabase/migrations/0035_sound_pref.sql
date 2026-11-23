-- Amah: game sound is a person's setting, like the theme. It works without a room (Solo players
-- had no way to switch it on) and new players start with it on.
alter table public.profiles
  add column sound_enabled boolean not null default true;

-- People already here keep what they chose in a room (sound was off unless switched on there).
-- Anyone with no room never had a switch, so they start on, like a new player.
update public.profiles p
set sound_enabled = coalesce((select bool_or(m.sound_enabled) from public.room_members m where m.user_id = p.id), true);

-- Joining a room takes the person's own sound setting.
create or replace function public.room_members_inherit_prefs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mine boolean;
begin
  select sound_enabled into mine from public.profiles where id = new.user_id;
  if mine is not null then
    new.sound_enabled := mine;
  end if;
  return new;
end;
$$;
