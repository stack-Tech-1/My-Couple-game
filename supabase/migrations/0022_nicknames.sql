-- Pet names: what I call the people I share a room with. Private to the person who wrote them:
-- nobody else, including the person nicknamed, can read them. Additive only.
create table public.nicknames (
  owner_id uuid not null references auth.users (id) on delete cascade,
  target_id uuid not null references auth.users (id) on delete cascade,
  nickname text not null check (char_length(btrim(nickname)) between 1 and 32),
  updated_at timestamptz not null default now(),
  primary key (owner_id, target_id),
  check (owner_id <> target_id)
);

alter table public.nicknames enable row level security;

create policy "nicknames: read my own" on public.nicknames
  for select to authenticated using (owner_id = auth.uid());

-- Only for someone you're in a room with right now.
create policy "nicknames: add for a roommate" on public.nicknames
  for insert to authenticated
  with check (owner_id = auth.uid() and exists (
    select 1 from public.room_members m where m.user_id = target_id and public.is_room_member(m.room_id)
  ));

create policy "nicknames: change my own" on public.nicknames
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and exists (
    select 1 from public.room_members m where m.user_id = target_id and public.is_room_member(m.room_id)
  ));

create policy "nicknames: remove my own" on public.nicknames
  for delete to authenticated using (owner_id = auth.uid());
