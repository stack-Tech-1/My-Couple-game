-- Per-game "how to play" tours: the games whose tour this person has finished or skipped.
-- Everyone starts with none, so existing players see each tour the first time they open a game.
-- Additive only: older app versions never read it.
alter table public.profiles add column if not exists toured_games text[] not null default '{}';
