-- Amah: group games. A session may now have 2 to 8 players (friend rooms hold up to 8).
-- Couple rooms still only ever start 2-player sessions; the server decides who plays.

do $$
declare
  c text;
begin
  for c in
    select con.conname from pg_constraint con
    where con.conrelid = 'public.game_sessions'::regclass and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%array_length(players%'
  loop
    execute format('alter table public.game_sessions drop constraint %I', c);
  end loop;
end;
$$;

alter table public.game_sessions
  add constraint game_sessions_players_count check (array_length(players, 1) between 2 and 8);
