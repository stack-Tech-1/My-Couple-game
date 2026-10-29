-- Amah Plus: per-person seats, Paystack payments, free trials, and why-people-leave totals.
-- Additive: new tables and functions, plus checks on inserts that only bite once Plus is live.
--
-- Plus is OFF until app_config 'plus' holds {"launched_at": "<timestamp>"} in the past. Until then
-- has_plus() is true for everyone, so nothing changes for anybody.

-- ---------------------------------------------------------------------------
-- Is Plus live, and does this person have it?
-- ---------------------------------------------------------------------------
create function public.plus_live()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select (value->>'launched_at')::timestamptz <= now() from public.app_config where key = 'plus'), false);
$$;

-- ---------------------------------------------------------------------------
-- Purchases: one row per Paystack payment (first payment and each renewal)
-- ---------------------------------------------------------------------------
create table public.plus_purchases (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique check (char_length(reference) between 6 and 100),
  payer_id uuid references auth.users (id) on delete set null,
  room_id uuid references public.rooms (id) on delete set null,
  plan text not null check (plan in ('single', 'couple', 'group3', 'group5', 'group8', 'gift')),
  period text not null check (period in ('month', 'year')),
  -- card = a Paystack subscription that renews; pass = paid once (transfer, USSD or card); admin = given by hand.
  method text not null check (method in ('card', 'pass', 'admin')),
  seats integer not null check (seats between 1 and 8),
  amount_kobo integer not null check (amount_kobo >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded', 'disputed')),
  -- Who gets a seat straight away when it's paid (couple: both; gift: the friend; group: the payer, if picked).
  recipients uuid[] not null default '{}',
  renews_from uuid references public.plus_purchases (id) on delete set null,
  period_end timestamptz,
  paystack_customer text,
  paystack_plan text,
  paystack_subscription text,
  channel text,
  card_brand text,
  card_last4 text,
  cancelled_at timestamptz,
  receipt_sent_at timestamptz,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  refunded_at timestamptz
);
create index plus_purchases_payer_idx on public.plus_purchases (payer_id, created_at desc);
create index plus_purchases_sub_idx on public.plus_purchases (paystack_customer, paystack_plan);
alter table public.plus_purchases enable row level security;
create policy "plus purchases: payer reads" on public.plus_purchases for select to authenticated using (payer_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Seats: one person's Plus for a stretch of time
-- ---------------------------------------------------------------------------
create table public.plus_seats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  purchase_id uuid references public.plus_purchases (id) on delete set null,
  source text not null check (source in ('trial', 'paid', 'gift', 'early', 'admin')),
  given_by uuid references auth.users (id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index plus_seats_user_idx on public.plus_seats (user_id, ends_at desc);
create index plus_seats_purchase_idx on public.plus_seats (purchase_id);
alter table public.plus_seats enable row level security;
create policy "plus seats: own" on public.plus_seats for select to authenticated using (user_id = auth.uid());

create function public.has_plus(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not public.plus_live() or exists (
    select 1 from public.plus_seats s
    where s.user_id = uid and s.revoked_at is null and s.starts_at <= now() and s.ends_at > now()
  );
$$;

-- When this person's Plus runs out (null when they don't have it).
create function public.plus_until(uid uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select max(ends_at) from public.plus_seats
  where user_id = uid and revoked_at is null and ends_at > now();
$$;

-- Adds time to someone's Plus, starting when their current Plus ends (or now).
create function public.plus_stack_seat(p_user uuid, p_purchase uuid, p_source text, p_length interval, p_given_by uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  start_at timestamptz;
  end_at timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 26));
  select greatest(now(), coalesce(max(ends_at), now())) into start_at
    from public.plus_seats where user_id = p_user and revoked_at is null and ends_at > now();
  end_at := start_at + p_length;
  insert into public.plus_seats (user_id, purchase_id, source, given_by, starts_at, ends_at)
    values (p_user, p_purchase, p_source, p_given_by, start_at, end_at);
  return end_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- Paying: mark a purchase paid and hand out its seats. Safe to call twice (the redirect back
-- from Paystack and the webhook both call it); only the first call does anything.
-- ---------------------------------------------------------------------------
create function public.plus_fulfil(p_reference text, p_amount integer, p_info jsonb)
returns public.plus_purchases
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.plus_purchases;
  prev public.plus_purchases;
  len interval;
  ends timestamptz;
  latest timestamptz;
  u uuid;
begin
  select * into p from public.plus_purchases where reference = p_reference for update;
  if not found then raise exception 'unknown purchase'; end if;
  if p.status <> 'pending' then return p; end if;
  if p_amount < p.amount_kobo then raise exception 'amount too low'; end if;

  len := case p.period when 'year' then interval '1 year' else interval '1 month' end;
  update public.plus_purchases set
    status = 'paid',
    paid_at = now(),
    channel = coalesce(p_info->>'channel', channel),
    card_brand = coalesce(p_info->>'card_brand', card_brand),
    card_last4 = coalesce(p_info->>'card_last4', card_last4),
    paystack_customer = coalesce(p_info->>'customer', paystack_customer),
    paystack_plan = coalesce(p_info->>'plan', paystack_plan),
    paystack_subscription = coalesce(p_info->>'subscription', paystack_subscription)
  where id = p.id;

  if p.renews_from is not null then
    -- A renewal: everyone who held a seat from the last payment keeps going.
    select * into prev from public.plus_purchases where id = p.renews_from;
    for u in select distinct user_id from public.plus_seats where purchase_id = p.renews_from and revoked_at is null loop
      latest := public.plus_stack_seat(u, p.id, 'paid', len, p.payer_id);
    end loop;
    ends := greatest(coalesce(prev.period_end, now()), now()) + len;
  elsif p.plan in ('group3', 'group5', 'group8') then
    -- A group: seats all end on the same day, whenever they're handed out.
    ends := now() + len;
    foreach u in array p.recipients loop
      insert into public.plus_seats (user_id, purchase_id, source, given_by, starts_at, ends_at)
        values (u, p.id, 'paid', p.payer_id, now(), ends);
    end loop;
  else
    -- One person, a couple, or a gift: time is added after any Plus they already have.
    ends := now() + len;
    foreach u in array p.recipients loop
      latest := public.plus_stack_seat(u, p.id, case when p.plan = 'gift' then 'gift' else 'paid' end, len, p.payer_id);
      ends := greatest(ends, latest);
    end loop;
  end if;

  update public.plus_purchases set period_end = ends where id = p.id returning * into p;
  return p;
end;
$$;

-- Group plans: hand a waiting seat to someone in the room. The seat ends with the plan.
create function public.plus_give_seat(p_purchase uuid, p_payer uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.plus_purchases;
  given integer;
begin
  select * into p from public.plus_purchases where id = p_purchase for update;
  if not found or p.payer_id is distinct from p_payer then raise exception 'not your seats'; end if;
  if p.status <> 'paid' or p.plan not in ('group3', 'group5', 'group8') or p.period_end <= now() then raise exception 'no seats left'; end if;
  if not exists (select 1 from public.room_members where room_id = p.room_id and user_id = p_user) then raise exception 'not in this room'; end if;
  if exists (select 1 from public.plus_seats where purchase_id = p.id and user_id = p_user and revoked_at is null) then raise exception 'already given'; end if;
  select count(*) into given from public.plus_seats where purchase_id = p.id and revoked_at is null;
  if given >= p.seats then raise exception 'no seats left'; end if;
  insert into public.plus_seats (user_id, purchase_id, source, given_by, starts_at, ends_at)
    values (p_user, p.id, 'paid', p_payer, now(), p.period_end);
end;
$$;

-- ---------------------------------------------------------------------------
-- Free trials: once per person. The email key is a hash of the cleaned-up address, kept even
-- after the account is deleted, so a fresh account with the same email doesn't get another.
-- ---------------------------------------------------------------------------
create table public.plus_trials (
  email_key text primary key check (char_length(email_key) = 64),
  user_id uuid references auth.users (id) on delete set null,
  device_key text check (char_length(device_key) <= 64),
  started_at timestamptz not null default now()
);
create index plus_trials_user_idx on public.plus_trials (user_id);
create index plus_trials_device_idx on public.plus_trials (device_key);
alter table public.plus_trials enable row level security;

-- Paystack plan codes we've created (one per plan and period), so we never make duplicates.
create table public.plus_paystack_plans (
  key text primary key check (char_length(key) <= 40),
  plan_code text not null,
  created_at timestamptz not null default now()
);
alter table public.plus_paystack_plans enable row level security;

-- Reminders already sent, so the daily job never sends one twice.
create table public.plus_reminders (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('ends_soon', 'ends_today', 'trial_ending')),
  ends_on date not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, ends_on)
);
alter table public.plus_reminders enable row level security;

-- Why people leave a partner or a room. No user id: only totals are ever shown.
create table public.leave_reasons (
  id bigint generated always as identity primary key,
  room_kind text not null check (room_kind in ('couple', 'friends')),
  reason text not null check (reason in ('break', 'not_using', 'cost', 'broken', 'breakup', 'unsafe', 'rather_not')),
  created_at timestamptz not null default now()
);
alter table public.leave_reasons enable row level security;

-- ---------------------------------------------------------------------------
-- What free accounts can't do once Plus is live. Checked in the database, so it holds
-- whichever way a row is written.
-- ---------------------------------------------------------------------------
create function public.plus_chat_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind in ('voice', 'sticker') and not public.has_plus(new.sender_id) then
    raise exception 'plus required: chat media';
  end if;
  return new;
end;
$$;
create trigger plus_chat_check before insert on public.chat_messages
  for each row execute function public.plus_chat_check();

create function public.plus_note_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.unlock_at is not null and new.unlock_at > now() and not public.has_plus(new.author_id) and (
    select count(*) from public.love_notes
    where author_id = new.author_id and unlock_at > now() and opened_at is null
  ) >= 3 then
    raise exception 'plus limit: sealed notes';
  end if;
  return new;
end;
$$;
create trigger plus_note_check before insert on public.love_notes
  for each row execute function public.plus_note_check();

create function public.plus_memory_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_plus(new.author_id) and (select count(*) from public.memories where room_id = new.room_id) >= 5 then
    raise exception 'plus limit: photos';
  end if;
  return new;
end;
$$;
create trigger plus_memory_check before insert on public.memories
  for each row execute function public.plus_memory_check();

-- Free accounts get one friend room; Plus gets up to five (the existing limit).
create function public.plus_friend_room_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select kind from public.rooms where id = new.room_id) = 'friends'
     and not public.has_plus(new.user_id)
     and (select count(*) from public.room_members m join public.rooms r on r.id = m.room_id
          where m.user_id = new.user_id and r.kind = 'friends') >= 1 then
    raise exception 'plus required: friend rooms';
  end if;
  return new;
end;
$$;
create trigger plus_friend_room_check before insert on public.room_members
  for each row execute function public.plus_friend_room_check();

-- ---------------------------------------------------------------------------
-- Launch day: everyone who joined before it gets a free month, once.
-- ---------------------------------------------------------------------------
create function public.plus_grant_early(p_cutoff timestamptz)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  insert into public.plus_seats (user_id, source, starts_at, ends_at)
  select u.id, 'early', p_cutoff, p_cutoff + interval '1 month'
  from auth.users u
  where u.created_at < p_cutoff
    and not exists (select 1 from public.plus_seats s where s.user_id = u.id and s.source = 'early');
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Only the server (service role) runs the money and seat functions.
revoke execute on function public.plus_stack_seat(uuid, uuid, text, interval, uuid) from public, anon, authenticated;
revoke execute on function public.plus_fulfil(text, integer, jsonb) from public, anon, authenticated;
revoke execute on function public.plus_give_seat(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.plus_grant_early(timestamptz) from public, anon, authenticated;
grant execute on function public.plus_stack_seat(uuid, uuid, text, interval, uuid) to service_role;
grant execute on function public.plus_fulfil(text, integer, jsonb) to service_role;
grant execute on function public.plus_give_seat(uuid, uuid, uuid) to service_role;
grant execute on function public.plus_grant_early(timestamptz) to service_role;
grant execute on function public.has_plus(uuid) to authenticated, service_role;
grant execute on function public.plus_until(uuid) to authenticated, service_role;
grant execute on function public.plus_live() to anon, authenticated, service_role;
