-- Owner decision: if a partner opts out mid-game, the current card finishes first.
-- That needs the session to stay readable to its two members after the lock; the server ends it
-- on the next move. Discretion on shared surfaces (dashboard, timeline) is handled separately.
drop policy "sessions: members read" on public.game_sessions;
create policy "sessions: members read" on public.game_sessions
  for select to authenticated using (public.is_room_member(room_id));