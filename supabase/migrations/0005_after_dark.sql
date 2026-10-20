-- Twain: After Dark (18+, opt-in)
-- Safety rules (confirmed by the owner):
--   * Each person confirms 18+ (checkbox; only the timestamp is stored) and opts in separately.
--   * Nothing spicy is readable unless BOTH current members have confirmed and opted in.
--   * Heat is capped at the lower of the two members' maximums (enforced when sessions start).
--   * Per-person PIN, stored as a bcrypt hash.
--   * Fantasy picks are owner-only; only mutual matches are ever revealed, and a "No" never is.
--   * Yes+Maybe reveals only when both members enabled that mode.

alter table public.room_members
  add column pin_hash text,
  add column match_mode text not null default 'yes' check (match_mode in ('yes', 'yes_maybe'));

-- You can't be opted in without having confirmed you're 18+.
alter table public.room_members
  add constraint room_members_optin_requires_age check (not spicy_opt_in or age_confirmed_at is not null);

-- Members may only change their own PIN through set_spicy_pin (never write a hash directly).
create function public.room_members_guard()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'authenticated' and new.pin_hash is distinct from old.pin_hash then
    raise exception 'use set_spicy_pin';
  end if;
  return new;
end;
$$;
create trigger room_members_guard before update on public.room_members
  for each row execute function public.room_members_guard();

-- The single gate every spicy policy uses: a full room where both members are confirmed and opted in.
create function public.spicy_unlocked(p_room uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select count(*) = 2 and bool_and(spicy_opt_in and age_confirmed_at is not null)
  from public.room_members where room_id = p_room;
$$;
grant execute on function public.spicy_unlocked(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- PIN
-- ---------------------------------------------------------------------------
create function public.set_spicy_pin(p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_pin !~ '^[0-9]{4,8}$' then raise exception 'PIN must be 4 to 8 digits'; end if;
  if not public.hit_rate_limit('set_pin', 10, 3600) then raise exception 'rate limited'; end if;
  update public.room_members set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 10)) where user_id = auth.uid();
  if not found then raise exception 'no room'; end if;
end;
$$;

create function public.verify_spicy_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  h text;
begin
  if not public.hit_rate_limit('verify_pin', 8, 600) then raise exception 'rate limited'; end if;
  select pin_hash into h from public.room_members where user_id = auth.uid();
  if h is null then return false; end if;
  return h = extensions.crypt(p_pin, h);
end;
$$;

create function public.has_spicy_pin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select pin_hash is not null from public.room_members where user_id = auth.uid();
$$;

grant execute on function public.set_spicy_pin(text), public.verify_spicy_pin(text), public.has_spicy_pin() to authenticated;

-- ---------------------------------------------------------------------------
-- Custom cards: private to the room, only while After Dark is unlocked
-- ---------------------------------------------------------------------------
create table public.custom_cards (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  deck text not null check (deck in ('truth', 'dare', 'hotseat', 'never', 'dice_action', 'dice_where')),
  heat smallint not null check (heat between 1 and 3),
  text text not null check (char_length(text) between 2 and 200),
  created_by uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index custom_cards_room_idx on public.custom_cards (room_id, deck);
alter table public.custom_cards enable row level security;

create policy "custom: members read when unlocked" on public.custom_cards
  for select to authenticated using (public.is_room_member(room_id) and public.spicy_unlocked(room_id));
create policy "custom: members add when unlocked" on public.custom_cards
  for insert to authenticated with check (public.is_room_member(room_id) and public.spicy_unlocked(room_id) and created_by = auth.uid());
create policy "custom: author deletes" on public.custom_cards
  for delete to authenticated using (created_by = auth.uid());

create trigger custom_cards_rate before insert on public.custom_cards
  for each row execute function public.enforce_rate_limit('custom_card', '60', '3600');

-- ---------------------------------------------------------------------------
-- Fantasy Match
-- ---------------------------------------------------------------------------
create table public.fantasy_picks (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null check (char_length(item_id) <= 40),
  pick text not null check (pick in ('yes', 'maybe', 'no')),
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id, item_id)
);
alter table public.fantasy_picks enable row level security;

-- Your own picks only. Nobody, including your partner, can ever read another person's picks.
create policy "fantasy: own picks" on public.fantasy_picks
  for all to authenticated
  using (user_id = auth.uid() and public.is_room_member(room_id) and public.spicy_unlocked(room_id))
  with check (user_id = auth.uid() and public.is_room_member(room_id) and public.spicy_unlocked(room_id));

create trigger fantasy_picks_touch before update on public.fantasy_picks
  for each row execute function public.touch_updated_at();

-- Only mutual matches between the room's CURRENT members. Never reveals a No, a lone Yes,
-- or which of you said Maybe. Computed live, so an un-Yes makes a match vanish quietly.
create function public.fantasy_matches(p_room uuid)
returns table (item_id text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  both_maybe boolean;
begin
  if not public.is_room_member(p_room) or not public.spicy_unlocked(p_room) then
    return;
  end if;
  select bool_and(match_mode = 'yes_maybe') into both_maybe from public.room_members where room_id = p_room;

  return query
    select p.item_id
    from public.fantasy_picks p
    join public.room_members m on m.room_id = p.room_id and m.user_id = p.user_id
    where p.room_id = p_room and p.pick in ('yes', 'maybe')
    group by p.item_id
    having count(*) = 2
       and (count(*) filter (where p.pick = 'yes') = 2
            or (both_maybe and count(*) filter (where p.pick = 'yes') >= 1));
end;
$$;
grant execute on function public.fantasy_matches(uuid) to authenticated;

-- How many items each of you has answered (counts only; never content). For progress UI.
create function public.fantasy_progress(p_room uuid)
returns table (mine integer, partner integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::int from public.fantasy_picks where room_id = p_room and user_id = auth.uid()),
    (select count(*)::int from public.fantasy_picks p join public.room_members m on m.room_id = p.room_id and m.user_id = p.user_id
      where p.room_id = p_room and p.user_id <> auth.uid())
  where public.is_room_member(p_room) and public.spicy_unlocked(p_room);
$$;
grant execute on function public.fantasy_progress(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Spicy game sessions: hide them from the room entirely unless After Dark is unlocked.
-- ---------------------------------------------------------------------------
drop policy "sessions: members read" on public.game_sessions;
create policy "sessions: members read" on public.game_sessions
  for select to authenticated
  using (
    public.is_room_member(room_id)
    and (game_id not in ('truth-or-dare', 'spicy-dice', 'hot-seat', 'never-have-i', 'fantasy-match') or public.spicy_unlocked(room_id))
  );

-- Spicy moments stay out of the shared timeline entirely (discretion), so nothing to add there.
