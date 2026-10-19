-- Twain: personal games
-- 1) Sessions can end "complete" (no winner): story chains, conversation decks.
-- 2) Daily Question: one shared question a day; each answer stays hidden until both have answered.

alter table public.game_sessions drop constraint game_sessions_outcome_check;
alter table public.game_sessions add constraint game_sessions_outcome_check
  check (outcome in ('win', 'tie', 'coop_win', 'coop_loss', 'complete', 'abandoned'));

-- Map the new outcome to a timeline moment.
create or replace function public.commit_game_move(
  p_session uuid, p_expected_version integer, p_by uuid, p_move jsonb,
  p_state jsonb, p_views jsonb, p_status text, p_outcome text, p_winner uuid
)
returns public.game_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.game_sessions;
  uid uuid;
begin
  update public.game_sessions
     set version = version + 1,
         status = p_status,
         outcome = p_outcome,
         winner = p_winner,
         finished_at = case when p_status <> 'active' then now() else null end
   where id = p_session and version = p_expected_version and status = 'active'
  returning * into s;

  if not found then
    return null;
  end if;

  update public.game_secrets set state = p_state where session_id = p_session;

  if p_move is not null then
    insert into public.game_moves (session_id, seq, by_user, move) values (p_session, s.version, p_by, p_move);
  end if;

  foreach uid in array s.players loop
    update public.game_views set version = s.version, view = p_views -> uid::text, updated_at = now()
    where session_id = p_session and user_id = uid;
  end loop;

  if p_status = 'finished' then
    insert into public.moments (room_id, kind, actor_id, payload)
    values (
      s.room_id,
      case p_outcome
        when 'win' then 'game_won'
        when 'tie' then 'game_tied'
        when 'coop_win' then 'coop_cleared'
        when 'coop_loss' then 'coop_missed'
        when 'complete' then 'game_completed'
        else 'game_finished'
      end,
      p_by,
      jsonb_build_object('gameId', s.game_id, 'sessionId', s.id, 'winner', p_winner)
    );
  end if;

  return s;
end;
$$;
revoke execute on function public.commit_game_move(uuid, integer, uuid, jsonb, jsonb, jsonb, text, text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Daily Question
-- ---------------------------------------------------------------------------
create table public.daily_answers (
  room_id uuid not null references public.rooms (id) on delete cascade,
  day date not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  question text not null check (char_length(question) <= 200),
  answer text not null check (char_length(answer) between 1 and 500),
  created_at timestamptz not null default now(),
  primary key (room_id, day, user_id)
);
create index daily_answers_room_day_idx on public.daily_answers (room_id, day desc);

alter table public.daily_answers enable row level security;

-- Security definer so the select policy below doesn't recurse into this table's RLS.
create function public.daily_both_answered(p_room uuid, p_day date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select count(*) = 2 from public.daily_answers where room_id = p_room and day = p_day;
$$;

-- Your own answer always; your partner's only once you've both answered that day.
create policy "daily: read own, or both once both answered" on public.daily_answers
  for select to authenticated
  using (
    user_id = auth.uid()
    or (public.is_room_member(room_id) and public.daily_both_answered(room_id, day))
  );

-- Answer only for yourself, only today (UTC), only in your room. No edits, no deletes.
create policy "daily: answer today" on public.daily_answers
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_room_member(room_id)
    and day = (now() at time zone 'utc')::date
  );

-- Status without revealing content: did my partner answer? what's our streak?
create function public.daily_status(p_room uuid)
returns table (day date, mine boolean, partner boolean, streak integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'utc')::date;
  d date;
  n integer := 0;
begin
  if not public.is_room_member(p_room) then
    raise exception 'not a member';
  end if;

  -- Streak: consecutive days both answered, counting back from today (or yesterday if today isn't done yet).
  d := case when public.daily_both_answered(p_room, today) then today else today - 1 end;
  while public.daily_both_answered(p_room, d) loop
    n := n + 1;
    d := d - 1;
  end loop;

  return query select
    today,
    exists (select 1 from public.daily_answers a where a.room_id = p_room and a.day = today and a.user_id = auth.uid()),
    exists (select 1 from public.daily_answers a where a.room_id = p_room and a.day = today and a.user_id <> auth.uid()),
    n;
end;
$$;
grant execute on function public.daily_status(uuid) to authenticated;
revoke execute on function public.daily_both_answered(uuid, date) from public, anon;
grant execute on function public.daily_both_answered(uuid, date) to authenticated;

-- When the second answer lands, it becomes a shared moment.
create function public.daily_moment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.daily_both_answered(new.room_id, new.day) then
    insert into public.moments (room_id, kind, actor_id, payload)
    values (new.room_id, 'daily_both', new.user_id, jsonb_build_object('day', new.day));
  end if;
  return new;
end;
$$;

create trigger daily_answers_moment after insert on public.daily_answers
  for each row execute function public.daily_moment();

alter publication supabase_realtime add table public.daily_answers;
