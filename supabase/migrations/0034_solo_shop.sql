-- Solo game shops (Mama Put's restaurant upgrades). Additive only.
--
-- Savings are everything a person has taken in at the game (the sum of their saved scores) minus
-- what they've spent. Prices live in the app; buying goes through the server only, which passes
-- the price, so this function is not callable from the browser.

create table if not exists public.solo_shop (
  user_id uuid not null references auth.users (id) on delete cascade,
  game_id text not null,
  area smallint not null check (area between 0 and 20),
  item text not null check (item ~ '^[a-z0-9-]{1,30}$'),
  price integer not null check (price >= 0),
  bought_at timestamptz not null default now(),
  primary key (user_id, game_id, area, item)
);
alter table public.solo_shop enable row level security;
create policy "solo shop: own" on public.solo_shop for select to authenticated using (user_id = auth.uid());

-- Buy one item if the savings cover it. Returns the savings left. One purchase at a time per
-- person and game, so two quick taps can't spend the same naira twice.
create or replace function public.solo_shop_buy(p_user uuid, p_game text, p_area smallint, p_item text, p_price integer)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  earned bigint;
  spent bigint;
begin
  perform pg_advisory_xact_lock(hashtext('solo_shop:' || p_user::text || ':' || p_game));
  select coalesce(sum(score), 0) into earned from public.solo_scores where user_id = p_user and game_id = p_game;
  select coalesce(sum(price), 0) into spent from public.solo_shop where user_id = p_user and game_id = p_game;
  if exists (select 1 from public.solo_shop where user_id = p_user and game_id = p_game and area = p_area and item = p_item) then
    raise exception 'already owned' using errcode = 'P0001';
  end if;
  if earned - spent < p_price then
    raise exception 'not enough savings' using errcode = 'P0001';
  end if;
  insert into public.solo_shop (user_id, game_id, area, item, price) values (p_user, p_game, p_area, p_item, p_price);
  return earned - spent - p_price;
end;
$$;
revoke all on function public.solo_shop_buy(uuid, text, smallint, text, integer) from public, anon, authenticated;
grant execute on function public.solo_shop_buy(uuid, text, smallint, text, integer) to service_role;
