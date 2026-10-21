-- Amah: couple progress (streaks, levels, badges) and the weekly recap.
-- Computed from activity that already exists; nothing new is tracked. Members only.

-- Days (UTC) each member did something together-ish: moved in a game, chatted, answered the
-- Daily Question, sent a nudge, a note or a photo.
create function public.room_activity(p_room uuid, p_since date)
returns table (uid uuid, d date)
language sql
stable
security definer
set search_path = public
as $$
  select m.by_user, m.created_at::date from public.game_moves m join public.game_sessions s on s.id = m.session_id
    where s.room_id = p_room and m.by_user is not null and m.created_at >= p_since
  union
  select sender_id, created_at::date from public.chat_messages where room_id = p_room and created_at >= p_since
  union
  select user_id, day from public.daily_answers where room_id = p_room and day >= p_since
  union
  select from_user, created_at::date from public.nudges where room_id = p_room and created_at >= p_since
  union
  select author_id, created_at::date from public.love_notes where room_id = p_room and created_at >= p_since
  union
  select author_id, created_at::date from public.memories where room_id = p_room and created_at >= p_since;
$$;
revoke execute on function public.room_activity(uuid, date) from public, anon, authenticated;

create function public.room_progress(p_room uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_room_member(p_room) then raise exception 'not a member'; end if;

  with members as (select user_id from public.room_members where room_id = p_room),
  act as (select * from public.room_activity(p_room, (now() - interval '2 years')::date)),
  -- A shared day: both members did something.
  shared as (
    select d from act where uid in (select user_id from members) group by d having count(distinct uid) >= 2
  ),
  runs as (select d, d - (row_number() over (order by d))::int as grp from shared),
  streaks as (select min(d) as start_d, max(d) as end_d, count(*) as len from runs group by grp),
  sessions as (select * from public.game_sessions where room_id = p_room and status = 'finished'),
  dailies as (select day from public.daily_answers where room_id = p_room group by day having count(*) >= 2)
  select jsonb_build_object(
    'streak', coalesce((select len from streaks where end_d >= current_date - 1 order by end_d desc limit 1), 0),
    'best_streak', coalesce((select max(len) from streaks), 0),
    'shared_days', (select count(*) from shared),
    'games', (select count(*) from sessions),
    'kinds', (select count(distinct game_id) from sessions where not public.is_spicy_game(game_id)),
    'coop_wins', (select count(*) from sessions where outcome = 'coop_win'),
    'wins', coalesce((select jsonb_object_agg(winner, n) from (select winner, count(*) n from sessions where winner is not null group by winner) w), '{}'::jsonb),
    'whot_wins', coalesce((select max(n) from (select count(*) n from sessions where game_id = 'whot' and winner is not null group by winner) w), 0),
    'dailies', (select count(*) from dailies),
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

-- One week (Monday to Sunday) for the recap card. After Dark is left out on purpose: the recap
-- sits on the shared home screen.
create function public.room_week(p_room uuid, p_start date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
  p_end date := p_start + 7;
begin
  if not public.is_room_member(p_room) then raise exception 'not a member'; end if;
  with sessions as (
    select * from public.game_sessions
    where room_id = p_room and status = 'finished' and not public.is_spicy_game(game_id)
      and coalesce(finished_at, updated_at) >= p_start and coalesce(finished_at, updated_at) < p_end
  ),
  act as (select * from public.room_activity(p_room, p_start) where d < p_end),
  members as (select user_id from public.room_members where room_id = p_room)
  select jsonb_build_object(
    'start', p_start,
    'games', (select count(*) from sessions),
    'wins', coalesce((select jsonb_object_agg(winner, n) from (select winner, count(*) n from sessions where winner is not null group by winner) w), '{}'::jsonb),
    'top_game', (select game_id from sessions group by game_id order by count(*) desc, max(created_at) desc limit 1),
    'dailies', (select count(*) from (select day from public.daily_answers where room_id = p_room and day >= p_start and day < p_end group by day having count(*) >= 2) x),
    'messages', (select count(*) from public.chat_messages where room_id = p_room and created_at >= p_start and created_at < p_end),
    'voice', (select count(*) from public.chat_messages where room_id = p_room and kind = 'voice' and created_at >= p_start and created_at < p_end),
    'nudges', (select count(*) from public.nudges where room_id = p_room and created_at >= p_start and created_at < p_end),
    'shared_days', (select count(*) from (select d from act where uid in (select user_id from members) group by d having count(distinct uid) >= 2) s)
  ) into result;
  return result;
end;
$$;
revoke execute on function public.room_week(uuid, date) from public, anon;
grant execute on function public.room_week(uuid, date) to authenticated;
