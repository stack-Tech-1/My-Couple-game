-- Amah: coming back every day.
--  1. Forgiving streaks: one missed day a week (Monday to Sunday) is a rest day, not a break.
--     The streak keeps going; a second miss in the same week ends it.
--  2. This week's days for the Today card: together, rest, missed, today, still to come.
-- Additive: room_progress (last changed in 0027) is replaced with the same fields plus
-- `rest_used` and `week`; nothing new is stored.

create or replace function public.room_streaks(p_room uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  d date;
  first_d date;
  today date := current_date;
  monday date := current_date - ((extract(isodow from current_date))::int - 1);
  len int := 0;
  best int := 0;
  rested date[] := '{}';   -- the Monday of each week whose rest day is used
  wk date;
  week jsonb := '[]'::jsonb;
  status text;
  shared_days date[];
begin
  select array_agg(x.d order by x.d) into shared_days from (
    select a.d from public.room_activity(p_room, (now() - interval '2 years')::date) a
    where a.uid in (select user_id from public.room_members where room_id = p_room)
    group by a.d having count(distinct a.uid) >= 2
  ) x;
  first_d := coalesce(shared_days[1], today);
  d := first_d;
  while d <= today loop
    wk := d - ((extract(isodow from d))::int - 1);
    if d = any(shared_days) then
      len := len + 1;
      status := 'together';
    elsif d = today then
      status := 'today';                       -- the day isn't over yet
    elsif len > 0 and not (wk = any(rested)) then
      rested := rested || wk;                  -- this week's rest day
      status := 'rest';
    else
      len := 0;
      status := 'missed';
    end if;
    best := greatest(best, len);
    if d >= monday then week := week || jsonb_build_object('day', d, 'status', status); end if;
    d := d + 1;
  end loop;
  -- Days of this week before the first shared day, and the days still to come.
  d := monday;
  while d < first_d and d <= today loop
    week := week || jsonb_build_object('day', d, 'status', case when d = today then 'today' else 'missed' end);
    d := d + 1;
  end loop;
  d := today + 1;
  while d < monday + 7 loop
    week := week || jsonb_build_object('day', d, 'status', 'later');
    d := d + 1;
  end loop;
  return jsonb_build_object(
    'streak', len,
    'best_streak', best,
    'rest_used', monday = any(rested),
    'week', (select jsonb_agg(e order by (e->>'day')::date) from jsonb_array_elements(week) e)
  );
end;
$$;
revoke execute on function public.room_streaks(uuid) from public, anon, authenticated;

create or replace function public.room_progress(p_room uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
  streaks jsonb;
begin
  if not public.is_room_member(p_room) then raise exception 'not a member'; end if;
  streaks := public.room_streaks(p_room);

  with members as (select user_id from public.room_members where room_id = p_room),
  act as (select * from public.room_activity(p_room, (now() - interval '2 years')::date)),
  shared as (
    select d from act where uid in (select user_id from members) group by d having count(distinct uid) >= 2
  ),
  sessions as (select * from public.game_sessions where room_id = p_room and status = 'finished'),
  dailies as (select day from public.daily_answers where room_id = p_room group by day having count(*) >= 2),
  words as (
    select w.day from public.solo_word_plays w
    where w.user_id in (select user_id from members) and w.finished_at is not null
    group by w.day having count(*) >= 2
  )
  select jsonb_build_object(
    'streak', (streaks->>'streak')::int,
    'best_streak', (streaks->>'best_streak')::int,
    'rest_used', (streaks->>'rest_used')::boolean,
    'week', streaks->'week',
    'shared_days', (select count(*) from shared),
    'games', (select count(*) from sessions),
    'kinds', (select count(distinct game_id) from sessions where not public.is_spicy_game(game_id)),
    'coop_wins', (select count(*) from sessions where outcome = 'coop_win'),
    'wins', coalesce((select jsonb_object_agg(winner, n) from (select winner, count(*) n from sessions where winner is not null group by winner) w), '{}'::jsonb),
    'whot_wins', coalesce((select max(n) from (select count(*) n from sessions where game_id = 'whot' and winner is not null group by winner) w), 0),
    'dailies', (select count(*) from dailies),
    'words', (select count(*) from words),
    'messages', (select count(*) from public.chat_messages where room_id = p_room),
    'voice', (select count(*) from public.chat_messages where room_id = p_room and kind = 'voice'),
    'nudges', (select count(*) from public.nudges where room_id = p_room),
    'notes', (select count(*) from public.love_notes where room_id = p_room),
    'memories', (select count(*) from public.memories where room_id = p_room),
    'bucket_done', (select count(*) from public.bucket_items where room_id = p_room and done_at is not null)
  ) into result;
  return result;
end;
$$;
revoke execute on function public.room_progress(uuid) from public, anon;
grant execute on function public.room_progress(uuid) to authenticated;
