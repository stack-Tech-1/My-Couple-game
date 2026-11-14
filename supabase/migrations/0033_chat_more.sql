-- Amah: the chat grows up (no photos or videos, by design).
--  - Reply to a message, @tag people (friend rooms), polls (friend rooms).
--  - React with an emoji (one each), edit your own text for 15 minutes, delete for everyone.
--  - Pin one message for the room; save one to your Moments (couples).
-- Additive: new columns default to "nothing", new tables, and functions for every change, so a
-- message is still only ever written by its sender and read by its room.

-- ---------------------------------------------------------------------------
-- Messages: replies, mentions, polls, edits and deletions
-- ---------------------------------------------------------------------------
alter table public.chat_messages add column reply_to uuid references public.chat_messages (id) on delete set null;
alter table public.chat_messages add column mentions uuid[] not null default '{}' check (cardinality(mentions) <= 8);
alter table public.chat_messages add column poll jsonb;
alter table public.chat_messages add column edited_at timestamptz;
alter table public.chat_messages add column deleted_at timestamptz;

alter table public.chat_messages drop constraint chat_messages_kind_check;
alter table public.chat_messages add constraint chat_messages_kind_check check (kind in ('text', 'sticker', 'voice', 'poll'));
alter table public.chat_messages drop constraint chat_messages_shape;
alter table public.chat_messages add constraint chat_messages_shape check (
  case
    -- Deleted for everyone: the row stays (so replies still point somewhere), the content goes.
    when deleted_at is not null then body is null and media is null and poll is null
    when kind = 'text' then body is not null and char_length(body) between 1 and 2000 and media is null and poll is null
    when kind = 'sticker' then body is null and poll is null and jsonb_typeof(media) = 'object'
      and media ? 'sticker_id' and media ? 'path' and media->>'scope' in ('starter', 'room')
      and (media->>'scope' = 'starter' or media->>'path' like room_id::text || '/stickers/%')
    when kind = 'voice' then body is null and poll is null and jsonb_typeof(media) = 'object'
      and media->>'path' like room_id::text || '/voice/%'
      and (media->>'duration')::numeric between 0.3 and 180
    -- A poll: the question in body, 2 to 6 short options.
    when kind = 'poll' then body is not null and char_length(body) between 1 and 200 and media is null
      and jsonb_typeof(poll->'options') = 'array' and jsonb_array_length(poll->'options') between 2 and 6
      and pg_column_size(poll) < 1500
    else false
  end
);

-- On the way in: a reply points into the same room, mentions are people in the room, polls only
-- in friend rooms, and nobody arrives already edited or deleted.
create function public.chat_check_new()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.edited_at is not null or new.deleted_at is not null then raise exception 'not allowed'; end if;
  if new.reply_to is not null and not exists (select 1 from public.chat_messages m where m.id = new.reply_to and m.room_id = new.room_id) then
    raise exception 'reply to another room';
  end if;
  if cardinality(new.mentions) > 0 and exists (
    select 1 from unnest(new.mentions) u where not exists (select 1 from public.room_members rm where rm.room_id = new.room_id and rm.user_id = u)
  ) then
    raise exception 'mention outside the room';
  end if;
  if new.kind = 'poll' and not exists (select 1 from public.rooms r where r.id = new.room_id and r.kind = 'friends') then
    raise exception 'polls are for friend rooms';
  end if;
  return new;
end;
$$;
create trigger chat_messages_check_new before insert on public.chat_messages
  for each row execute function public.chat_check_new();

-- Edit your own text, within 15 minutes of sending it.
create function public.chat_edit(p_message uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.chat_messages;
begin
  select * into m from public.chat_messages where id = p_message;
  if m.id is null or m.sender_id <> auth.uid() then raise exception 'not yours'; end if;
  if m.kind <> 'text' or m.deleted_at is not null then raise exception 'cannot edit'; end if;
  if m.created_at < now() - interval '15 minutes' then raise exception 'too late to edit'; end if;
  if p_body is null or char_length(btrim(p_body)) not between 1 and 2000 then raise exception 'empty'; end if;
  update public.chat_messages set body = btrim(p_body), edited_at = now() where id = p_message;
end;
$$;
revoke execute on function public.chat_edit(uuid, text) from public, anon;
grant execute on function public.chat_edit(uuid, text) to authenticated;

-- Delete for everyone: your own messages, any time.
create function public.chat_delete_for_all(p_message uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.chat_messages;
begin
  select * into m from public.chat_messages where id = p_message;
  if m.id is null or m.sender_id <> auth.uid() then raise exception 'not yours'; end if;
  update public.chat_messages set body = null, media = null, poll = null, mentions = '{}', deleted_at = now() where id = p_message and deleted_at is null;
  delete from public.chat_reactions where message_id = p_message;
  update public.rooms set pinned_message_id = null where id = m.room_id and pinned_message_id = p_message;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reactions: one emoji per person per message
-- ---------------------------------------------------------------------------
create table public.chat_reactions (
  message_id uuid not null references public.chat_messages (id) on delete cascade,
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index chat_reactions_room_idx on public.chat_reactions (room_id);
alter table public.chat_reactions enable row level security;
create policy "chat reactions: members read" on public.chat_reactions for select to authenticated using (public.is_room_member(room_id));

revoke execute on function public.chat_delete_for_all(uuid) from public, anon;
grant execute on function public.chat_delete_for_all(uuid) to authenticated;

-- React (or change your reaction); null takes it away.
create function public.chat_react(p_message uuid, p_emoji text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
begin
  select room_id into rid from public.chat_messages where id = p_message and deleted_at is null;
  if rid is null or not public.is_room_member(rid) then raise exception 'not yours'; end if;
  if p_emoji is null then
    delete from public.chat_reactions where message_id = p_message and user_id = auth.uid();
  else
    insert into public.chat_reactions (message_id, room_id, user_id, emoji) values (p_message, rid, auth.uid(), p_emoji)
      on conflict (message_id, user_id) do update set emoji = excluded.emoji, created_at = now();
  end if;
end;
$$;
revoke execute on function public.chat_react(uuid, text) from public, anon;
grant execute on function public.chat_react(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Polls (friend rooms): one vote each, changeable
-- ---------------------------------------------------------------------------
create table public.chat_poll_votes (
  message_id uuid not null references public.chat_messages (id) on delete cascade,
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  option smallint not null check (option between 0 and 5),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index chat_poll_votes_room_idx on public.chat_poll_votes (room_id);
alter table public.chat_poll_votes enable row level security;
create policy "chat poll votes: members read" on public.chat_poll_votes for select to authenticated using (public.is_room_member(room_id));

create function public.chat_vote(p_message uuid, p_option int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.chat_messages;
begin
  select * into m from public.chat_messages where id = p_message;
  if m.id is null or m.kind <> 'poll' or m.deleted_at is not null or not public.is_room_member(m.room_id) then raise exception 'not a poll'; end if;
  if p_option < 0 or p_option >= jsonb_array_length(m.poll->'options') then raise exception 'no such option'; end if;
  insert into public.chat_poll_votes (message_id, room_id, user_id, option) values (p_message, m.room_id, auth.uid(), p_option)
    on conflict (message_id, user_id) do update set option = excluded.option, created_at = now();
end;
$$;
revoke execute on function public.chat_vote(uuid, int) from public, anon;
grant execute on function public.chat_vote(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Pinned message (one per room) and saving a message to Moments (couples)
-- ---------------------------------------------------------------------------
alter table public.rooms add column pinned_message_id uuid references public.chat_messages (id) on delete set null;

create function public.chat_pin(p_room uuid, p_message uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_room_member(p_room) then raise exception 'not a member'; end if;
  if p_message is not null and not exists (select 1 from public.chat_messages where id = p_message and room_id = p_room and deleted_at is null) then
    raise exception 'not in this room';
  end if;
  update public.rooms set pinned_message_id = p_message where id = p_room;
end;
$$;
revoke execute on function public.chat_pin(uuid, uuid) from public, anon;
grant execute on function public.chat_pin(uuid, uuid) to authenticated;

create function public.chat_save_moment(p_message uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.chat_messages;
begin
  select * into m from public.chat_messages where id = p_message;
  if m.id is null or m.deleted_at is not null or m.kind <> 'text' or not public.is_room_member(m.room_id) then raise exception 'cannot save'; end if;
  if not exists (select 1 from public.rooms where id = m.room_id and kind = 'couple') then raise exception 'couples only'; end if;
  if exists (select 1 from public.moments where room_id = m.room_id and kind = 'chat_saved' and payload->>'message_id' = p_message::text) then return; end if;
  insert into public.moments (room_id, kind, actor_id, payload)
    values (m.room_id, 'chat_saved', auth.uid(), jsonb_build_object('message_id', p_message, 'from', m.sender_id, 'text', left(m.body, 200)));
end;
$$;
revoke execute on function public.chat_save_moment(uuid) from public, anon;
grant execute on function public.chat_save_moment(uuid) to authenticated;

alter publication supabase_realtime add table public.chat_reactions, public.chat_poll_votes;
