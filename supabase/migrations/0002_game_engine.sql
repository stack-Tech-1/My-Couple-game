-- Twain: game engine
-- Authoritative state lives in game_secrets (no client access at all).
-- Each player gets a per-player projection in game_views (RLS: own rows only).
-- Moves are committed atomically by commit_game_move(), called by the server
-- with the service role after validating the move with the shared game logic.

create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  game_id text not null check (char_length(game_id) <= 40),
  status text not null default 'active' check (status in ('active', 'finished', 'abandoned')),
  players uuid[] not null check (array_length(players, 1) = 2),
  created_by uuid references auth.users (id) on delete set null,
  config jsonb not null default '{}'::jsonb,
  version integer not null default 0,
  -- result
  winner uuid references auth.users (id) on delete set null,
  outcome text check (outcome in ('win', 'tie', 'coop_win', 'coop_loss', 'abandoned')),
  rematch_of uuid references public.game_sessions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);
create index game_sessions_room_idx on public.game_sessions (room_id, status, created_at desc);

create trigger game_sessions_touch before update on public.game_sessions
  for each row execute function public.touch_updated_at();

create table public.game_secrets (
  session_id uuid primary key references public.game_sessions (id) on delete cascade,
  seed text not null,
  state jsonb not null
);

create table public.game_views (
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  version integer not null,
  view jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create table public.game_moves (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  seq integer not null,
  by_user uuid references auth.users (id) on delete set null,
  move jsonb not null,
  created_at timestamptz not null default now(),
  unique (session_id, seq)
);

alter table public.game_sessions enable row level security;
alter table public.game_secrets enable row level security;
alter table public.game_views enable row level security;
alter table public.game_moves enable row level security;

-- Sessions: metadata is visible to both room members. No direct writes.
create policy "sessions: members read" on public.game_sessions
  for select to authenticated using (public.is_room_member(room_id));

-- Views: you only ever see your own projection.
create policy "views: own only" on public.game_views
  for select to authenticated using (user_id = auth.uid());

-- game_secrets and game_moves: no policies => no client access.

alter publication supabase_realtime add table public.game_sessions, public.game_views;
-- Needed so filtered postgres_changes on game_views carry the full row.
alter table public.game_views replica identity full;

-- ---------------------------------------------------------------------------
-- Server-only functions (service role). Never granted to clients.
-- ---------------------------------------------------------------------------

create function public.server_rate_limit(uid uuid, action text, max_hits integer, window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  k text := uid::text || ':' || action;
  allowed boolean;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (k, now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => window_seconds) then now() else r.window_start end
  returning hits <= max_hits into allowed;
  return allowed;
end;
$$;

-- Creates a session with its initial state and both views in one transaction.
create function public.create_game_session(
  p_room uuid, p_game text, p_players uuid[], p_created_by uuid, p_config jsonb,
  p_seed text, p_state jsonb, p_views jsonb, p_rematch_of uuid
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
  -- one live session per game per room: starting fresh retires the old one
  update public.game_sessions set status = 'abandoned', outcome = 'abandoned', finished_at = now()
  where room_id = p_room and game_id = p_game and status = 'active';

  insert into public.game_sessions (room_id, game_id, players, created_by, config, rematch_of)
  values (p_room, p_game, p_players, p_created_by, p_config, p_rematch_of)
  returning * into s;

  insert into public.game_secrets (session_id, seed, state) values (s.id, p_seed, p_state);

  foreach uid in array p_players loop
    insert into public.game_views (session_id, user_id, version, view)
    values (s.id, uid, 0, p_views -> uid::text);
  end loop;

  return s;
end;
$$;

-- Commits one validated move. Optimistic concurrency on version: returns null on conflict.
create function public.commit_game_move(
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
      case p_outcome when 'win' then 'game_won' when 'tie' then 'game_tied' when 'coop_win' then 'coop_cleared' else 'game_finished' end,
      p_by,
      jsonb_build_object('gameId', s.game_id, 'sessionId', s.id, 'winner', p_winner)
    );
  end if;

  return s;
end;
$$;

-- Lifetime head-to-head for a room: wins per member, ties, plus a per-game breakdown.
create function public.room_scoreboard(p_room uuid)
returns table (game_id text, user_id uuid, wins bigint, ties bigint, played bigint)
language sql
stable
security definer
set search_path = public
as $$
  select g.game_id, m.user_id,
         count(*) filter (where g.outcome = 'win' and g.winner = m.user_id) as wins,
         count(*) filter (where g.outcome = 'tie') as ties,
         count(*) as played
  from public.game_sessions g
  join public.room_members m on m.room_id = g.room_id and m.user_id = any (g.players)
  where g.room_id = p_room
    and g.status = 'finished'
    and g.outcome in ('win', 'tie')
    and public.is_room_member(p_room)
  group by g.game_id, m.user_id;
$$;

revoke execute on function public.server_rate_limit(uuid, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.create_game_session(uuid, text, uuid[], uuid, jsonb, text, jsonb, jsonb, uuid) from public, anon, authenticated;
revoke execute on function public.commit_game_move(uuid, integer, uuid, jsonb, jsonb, jsonb, text, text, uuid) from public, anon, authenticated;
grant execute on function public.room_scoreboard(uuid) to authenticated;
