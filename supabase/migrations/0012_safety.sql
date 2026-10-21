-- Amah: consent records, reports and blocks.

-- ---------------------------------------------------------------------------
-- Consent: who confirmed they're 18+ and accepted which version of the Terms/Privacy Policy.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column adult_confirmed_at timestamptz,
  add column terms_version text check (terms_version is null or char_length(terms_version) <= 20),
  add column terms_accepted_at timestamptz;

-- ---------------------------------------------------------------------------
-- Reports: a member reports their partner (optionally one message). The message is copied at
-- report time, so the admin sees exactly what was reported even if it's later deleted.
-- ---------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users (id) on delete set null,
  reported_id uuid references auth.users (id) on delete set null,
  room_id uuid references public.rooms (id) on delete set null,
  message_id uuid,
  message_snapshot jsonb,
  reason text not null check (reason in ('harassment', 'pressure', 'intimate_images', 'underage', 'spam', 'other')),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'new' check (status in ('new', 'reviewing', 'resolved', 'dismissed')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 2000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index reports_status_idx on public.reports (status, created_at desc);
alter table public.reports enable row level security;
-- Reporters can see their own reports; everything else is service role (admin) only.
-- Reports are filed only through file_report(), which validates and rate-limits.
create policy "reports: reporter reads own" on public.reports for select to authenticated using (reporter_id = auth.uid());

/**
 * File a report about your partner. Validates membership server-side and snapshots the message
 * (only a message from the reported person, in this room).
 */
create function public.file_report(p_reason text, p_details text default null, p_message uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
  partner uuid;
  snap jsonb;
  new_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not public.hit_rate_limit('report', 10, 3600) then raise exception 'rate limited'; end if;
  select room_id into rid from public.room_members where user_id = auth.uid();
  if rid is null then raise exception 'no room'; end if;
  select user_id into partner from public.room_members where room_id = rid and user_id <> auth.uid();
  if partner is null then raise exception 'no partner'; end if;

  if p_message is not null then
    select jsonb_build_object('id', id, 'kind', kind, 'body', body, 'media', media, 'created_at', created_at)
      into snap from public.chat_messages
      where id = p_message and room_id = rid and sender_id = partner;
    if snap is null then raise exception 'message not found'; end if;
  end if;

  insert into public.reports (reporter_id, reported_id, room_id, message_id, message_snapshot, reason, details)
  values (auth.uid(), partner, rid, p_message, snap, p_reason, nullif(trim(coalesce(p_details, '')), ''))
  returning id into new_id;
  return new_id;
end;
$$;
revoke execute on function public.file_report(text, text, uuid) from public, anon;
grant execute on function public.file_report(text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Blocks: blocking your partner removes you from the room (they keep it) and stops the two of
-- you ever pairing again, in either direction.
-- ---------------------------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
create policy "blocks: read own" on public.blocks for select to authenticated using (blocker_id = auth.uid());

create function public.block_partner()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
  partner uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select room_id into rid from public.room_members where user_id = auth.uid();
  if rid is null then raise exception 'no room'; end if;
  select user_id into partner from public.room_members where room_id = rid and user_id <> auth.uid();
  if partner is null then raise exception 'no partner'; end if;
  insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), partner) on conflict do nothing;
  perform public.leave_room();
end;
$$;
revoke execute on function public.block_partner() from public, anon;
grant execute on function public.block_partner() to authenticated;

-- join_room again, now refusing a pairing either person has blocked. The joiner is told the
-- invite wasn't found: a blocked person learns nothing.
create or replace function public.join_room(code text)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rooms;
  member_count integer;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not public.hit_rate_limit('join_room', 10, 600) then raise exception 'rate limited'; end if;

  select * into r from public.rooms where invite_code = upper(trim(code)) for update;
  if not found then raise exception 'invite not found'; end if;

  if exists (select 1 from public.room_members where user_id = auth.uid() and room_id = r.id) then
    return r; -- already here, idempotent
  end if;
  if exists (select 1 from public.room_members where user_id = auth.uid()) then
    raise exception 'already in a room';
  end if;

  if exists (
    select 1 from public.room_members m join public.blocks b
      on (b.blocker_id = m.user_id and b.blocked_id = auth.uid()) or (b.blocker_id = auth.uid() and b.blocked_id = m.user_id)
    where m.room_id = r.id
  ) then
    raise exception 'invite not found';
  end if;

  select count(*) into member_count from public.room_members where room_id = r.id;
  if member_count >= 2 then raise exception 'room is full'; end if;

  insert into public.room_members (room_id, user_id) values (r.id, auth.uid());

  -- Pairing locks the room to these two people: the invite code is retired.
  update public.rooms set paired_at = now(), invite_code = null where id = r.id returning * into r;

  insert into public.moments (room_id, kind, actor_id, payload)
  values (r.id, 'paired', auth.uid(), '{}'::jsonb);

  return r;
end;
$$;
