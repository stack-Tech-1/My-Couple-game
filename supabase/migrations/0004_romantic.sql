-- Twain: romantic features
-- love_notes (sealable letters), memories (private photos + prompts), bucket_items (shared list).
-- Every table: RLS on, room-scoped, rate-limited writes.

-- Rate-limit helper usable from triggers (runs as definer, keyed by the caller's auth.uid()).
create function public.enforce_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.hit_rate_limit(tg_argv[0], tg_argv[1]::integer, tg_argv[2]::integer) then
    raise exception 'rate limited';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Love notes
-- ---------------------------------------------------------------------------
create table public.love_notes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  stationery text not null default 'paper' check (stationery in ('paper', 'wine', 'sage', 'brass')),
  unlock_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  check (author_id <> recipient_id)
);
create index love_notes_recipient_idx on public.love_notes (recipient_id, created_at desc);
alter table public.love_notes enable row level security;

-- Authors read what they wrote. Recipients read a note only once it has unlocked.
create policy "notes: author reads own" on public.love_notes
  for select to authenticated using (author_id = auth.uid());
create policy "notes: recipient reads once unlocked" on public.love_notes
  for select to authenticated
  using (recipient_id = auth.uid() and (unlock_at is null or unlock_at <= now()));

-- Write only as yourself, only to your partner in your room.
create policy "notes: write to partner" on public.love_notes
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.is_room_member(room_id)
    and exists (select 1 from public.room_members m where m.room_id = love_notes.room_id and m.user_id = recipient_id)
    and opened_at is null
  );
-- Authors can delete their own notes. Nobody edits a letter once sent.
create policy "notes: author deletes own" on public.love_notes
  for delete to authenticated using (author_id = auth.uid());

create trigger love_notes_rate before insert on public.love_notes
  for each row execute function public.enforce_rate_limit('love_note', '20', '3600');

-- Sealed envelopes addressed to me: metadata only, never the body.
create function public.sealed_notes()
returns table (id uuid, author_id uuid, stationery text, unlock_at timestamptz, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select n.id, n.author_id, n.stationery, n.unlock_at, n.created_at
  from public.love_notes n
  where n.recipient_id = auth.uid() and n.unlock_at > now()
  order by n.unlock_at;
$$;
grant execute on function public.sealed_notes() to authenticated;

-- Recipient marks a note as opened (only once it has unlocked).
create function public.open_note(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n public.love_notes;
begin
  select * into n from public.love_notes where id = p_id and recipient_id = auth.uid() and (unlock_at is null or unlock_at <= now());
  if not found then raise exception 'not found'; end if;
  if n.opened_at is null then
    update public.love_notes set opened_at = now() where id = p_id;
    insert into public.moments (room_id, kind, actor_id, payload) values (n.room_id, 'note_opened', auth.uid(), '{}'::jsonb);
  end if;
end;
$$;
grant execute on function public.open_note(uuid) to authenticated;

create function public.note_sent_moment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.moments (room_id, kind, actor_id, payload)
  values (new.room_id, case when new.unlock_at is not null and new.unlock_at > now() then 'note_sealed' else 'note_sent' end, new.author_id,
          case when new.unlock_at is not null then jsonb_build_object('unlockAt', new.unlock_at) else '{}'::jsonb end);
  return new;
end;
$$;
create trigger love_notes_moment after insert on public.love_notes
  for each row execute function public.note_sent_moment();

-- ---------------------------------------------------------------------------
-- Memory Lane
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('memories', 'memories', false, 5242880, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;

-- Objects live at memories/<room_id>/<file>. Only that room's members may read or write.
create policy "memories: members read" on storage.objects
  for select to authenticated
  using (bucket_id = 'memories' and public.is_room_member(public.topic_room_id('room:' || (storage.foldername(name))[1])));
create policy "memories: members upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'memories' and public.is_room_member(public.topic_room_id('room:' || (storage.foldername(name))[1])));
create policy "memories: owner deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'memories' and owner_id = auth.uid()::text);

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  path text not null check (char_length(path) <= 200),
  prompt text not null check (char_length(prompt) between 1 and 200),
  taken_on date,
  answer text check (char_length(answer) <= 1000),
  answered_by uuid references auth.users (id) on delete set null,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);
create index memories_room_idx on public.memories (room_id, created_at desc);
alter table public.memories enable row level security;

create policy "memories: members read rows" on public.memories
  for select to authenticated using (public.is_room_member(room_id));
create policy "memories: author adds" on public.memories
  for insert to authenticated
  with check (author_id = auth.uid() and public.is_room_member(room_id) and answer is null and path like room_id::text || '/%');
create policy "memories: author deletes" on public.memories
  for delete to authenticated using (author_id = auth.uid());

create trigger memories_rate before insert on public.memories
  for each row execute function public.enforce_rate_limit('memory', '30', '3600');

-- The partner (not the author) answers the prompt, once.
create function public.answer_memory(p_id uuid, p_answer text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.memories;
begin
  if char_length(trim(p_answer)) not between 1 and 1000 then raise exception 'invalid answer'; end if;
  select * into m from public.memories where id = p_id and public.is_room_member(room_id) and author_id <> auth.uid() and answer is null;
  if not found then raise exception 'not found'; end if;
  update public.memories set answer = trim(p_answer), answered_by = auth.uid(), answered_at = now() where id = p_id;
  insert into public.moments (room_id, kind, actor_id, payload) values (m.room_id, 'memory_answered', auth.uid(), jsonb_build_object('memoryId', m.id));
end;
$$;
grant execute on function public.answer_memory(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Bucket list
-- ---------------------------------------------------------------------------
create table public.bucket_items (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  note text check (char_length(note) <= 500),
  category text not null default 'adventure' check (category in ('adventure', 'travel', 'home', 'food', 'learn', 'someday')),
  created_by uuid references auth.users (id) on delete set null,
  done_at timestamptz,
  done_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index bucket_items_room_idx on public.bucket_items (room_id, done_at nulls first, created_at desc);
alter table public.bucket_items enable row level security;

create policy "bucket: members read" on public.bucket_items for select to authenticated using (public.is_room_member(room_id));
create policy "bucket: members add" on public.bucket_items for insert to authenticated
  with check (public.is_room_member(room_id) and created_by = auth.uid() and done_at is null);
create policy "bucket: members update" on public.bucket_items for update to authenticated
  using (public.is_room_member(room_id)) with check (public.is_room_member(room_id));
create policy "bucket: members delete" on public.bucket_items for delete to authenticated using (public.is_room_member(room_id));

create trigger bucket_items_rate before insert on public.bucket_items
  for each row execute function public.enforce_rate_limit('bucket', '60', '3600');

create function public.bucket_done_moment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.done_at is not null and old.done_at is null then
    insert into public.moments (room_id, kind, actor_id, payload)
    values (new.room_id, 'bucket_done', auth.uid(), jsonb_build_object('title', new.title));
  end if;
  return new;
end;
$$;
create trigger bucket_items_done after update on public.bucket_items
  for each row execute function public.bucket_done_moment();

alter publication supabase_realtime add table public.love_notes, public.memories, public.bucket_items;
