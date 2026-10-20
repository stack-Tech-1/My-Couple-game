-- Amah: voice notes and stickers in the chat.
--
-- Stickers come from two places:
--   * the starter pack (room_id is null): shared with every couple, stored in the public
--     `stickers` bucket, added only with the service role (import script / admin);
--   * a couple's own stickers (room_id set): private to the room, stored in `chat-media`.
-- Voice notes live in `chat-media` at <room_id>/voice/<file>. Both are kept indefinitely.

-- ---------------------------------------------------------------------------
-- Messages gain a kind
-- ---------------------------------------------------------------------------
alter table public.chat_messages alter column body drop not null;
alter table public.chat_messages drop constraint chat_messages_body_check;
alter table public.chat_messages add column kind text not null default 'text' check (kind in ('text', 'sticker', 'voice'));
alter table public.chat_messages add column media jsonb;

alter table public.chat_messages add constraint chat_messages_shape check (
  case kind
    when 'text' then body is not null and char_length(body) between 1 and 2000 and media is null
    when 'sticker' then body is null and jsonb_typeof(media) = 'object'
      and media ? 'sticker_id' and media ? 'path' and media->>'scope' in ('starter', 'room')
      and (media->>'scope' = 'starter' or media->>'path' like room_id::text || '/stickers/%')
    when 'voice' then body is null and jsonb_typeof(media) = 'object'
      and media->>'path' like room_id::text || '/voice/%'
      and (media->>'duration')::numeric between 0.3 and 180
    else false
  end
);

-- ---------------------------------------------------------------------------
-- Stickers
-- ---------------------------------------------------------------------------
create table public.stickers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms (id) on delete cascade,
  path text not null,
  animated boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  unique (path)
);
create index stickers_room_idx on public.stickers (room_id, created_at desc);
alter table public.stickers enable row level security;

create policy "stickers: starter pack and own room" on public.stickers
  for select to authenticated using (room_id is null or public.is_room_member(room_id));
create policy "stickers: add to own room" on public.stickers
  for insert to authenticated
  with check (room_id is not null and public.is_room_member(room_id) and created_by = auth.uid() and path like room_id::text || '/stickers/%');
create policy "stickers: remove from own room" on public.stickers
  for delete to authenticated using (room_id is not null and public.is_room_member(room_id));

create trigger stickers_rate before insert on public.stickers
  for each row execute function public.enforce_rate_limit('sticker', '60', '3600');

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('stickers', 'stickers', true, 1048576, array['image/webp', 'image/png', 'image/gif'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media', 'chat-media', false, 10485760,
  array['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/aac', 'image/webp', 'image/png', 'image/gif'])
on conflict (id) do nothing;

-- chat-media/<room_id>/... : only that room's members may read or write.
create policy "chat media: members read" on storage.objects
  for select to authenticated
  using (bucket_id = 'chat-media' and public.is_room_member(public.topic_room_id('room:' || (storage.foldername(name))[1])));
create policy "chat media: members upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-media'
    and public.is_room_member(public.topic_room_id('room:' || (storage.foldername(name))[1]))
    and (storage.foldername(name))[2] in ('voice', 'stickers')
  );
create policy "chat media: owner deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'chat-media' and owner_id = auth.uid()::text);

alter publication supabase_realtime add table public.stickers;
