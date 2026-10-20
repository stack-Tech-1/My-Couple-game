-- Amah: room chat
-- One running conversation per room, available on the room page and during games.
-- Messages are room-scoped; read state lives in its own table so marking a chat as read never
-- touches room_members (whose changes refresh both partners' pages).

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index chat_messages_room_idx on public.chat_messages (room_id, created_at desc);
alter table public.chat_messages enable row level security;

create policy "chat: members read" on public.chat_messages
  for select to authenticated using (public.is_room_member(room_id));
-- Write only as yourself, only into your own room. Nobody edits a message once sent.
create policy "chat: members write" on public.chat_messages
  for insert to authenticated
  with check (sender_id = auth.uid() and public.is_room_member(room_id));
create policy "chat: sender deletes own" on public.chat_messages
  for delete to authenticated using (sender_id = auth.uid());

create trigger chat_messages_rate before insert on public.chat_messages
  for each row execute function public.enforce_rate_limit('chat', '60', '60');

-- Last time each member looked at the chat. Powers the unread badge and the partner's "Seen".
create table public.chat_reads (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
alter table public.chat_reads enable row level security;
create policy "chat reads: members read" on public.chat_reads
  for select to authenticated using (public.is_room_member(room_id));
-- no write policies: only mark_chat_read touches it.

create function public.mark_chat_read(p_room uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  t timestamptz := now();
begin
  if not public.is_room_member(p_room) then
    raise exception 'not a member';
  end if;
  insert into public.chat_reads (room_id, user_id, read_at) values (p_room, auth.uid(), t)
  on conflict (room_id, user_id) do update set read_at = greatest(chat_reads.read_at, excluded.read_at);
  return t;
end;
$$;
revoke execute on function public.mark_chat_read(uuid) from public, anon;
grant execute on function public.mark_chat_read(uuid) to authenticated;

alter publication supabase_realtime add table public.chat_messages, public.chat_reads;
