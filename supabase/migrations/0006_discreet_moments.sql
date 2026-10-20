-- Discretion: After Dark sessions never write to the shared timeline.
create or replace function public.is_spicy_game(p_game text)
returns boolean
language sql
immutable
as $$
  select p_game in ('truth-or-dare', 'spicy-dice', 'hot-seat', 'never-have-i', 'fantasy-match');
$$;

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

  if p_status = 'finished' and not public.is_spicy_game(s.game_id) then
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
