-- Amah: editable content, email announcements and starter-sticker uploads from the admin.

-- ---------------------------------------------------------------------------
-- Content: additions on top of the built-in decks, and built-ins switched off.
-- Server-side only (service role): games and the Daily Question read them when a game starts
-- or a day begins, so no client ever queries these tables.
-- ---------------------------------------------------------------------------
create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'daily_question', 'date_idea', 'this_or_that', 'story_opener', 'how_well', 'deep_question',
    'truth', 'dare', 'hot_seat', 'never'
  )),
  body jsonb not null check (jsonb_typeof(body) = 'object' and pg_column_size(body) < 4000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index content_items_kind_idx on public.content_items (kind, created_at);
alter table public.content_items enable row level security;

-- `key` identifies a built-in item by a hash of its content (see src/lib/content/catalog.ts).
create table public.content_hidden (
  kind text not null,
  key text not null check (char_length(key) <= 80),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (kind, key)
);
alter table public.content_hidden enable row level security;
-- no policies on either: service role only.

-- ---------------------------------------------------------------------------
-- Email announcements
-- ---------------------------------------------------------------------------
alter table public.profiles add column announcement_emails boolean not null default true;

alter table public.announcements
  add column emailed_at timestamptz,
  add column emailed_count integer not null default 0;

-- Everyone who should get an announcement email: confirmed, not suspended, not opted out.
create function public.admin_email_recipients()
returns table (id uuid, email text, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.email::text, coalesce(nullif(p.display_name, ''), 'there')
  from auth.users u
  join public.profiles p on p.id = u.id
  where u.email is not null
    and u.email_confirmed_at is not null
    and (u.banned_until is null or u.banned_until < now())
    and p.announcement_emails
  order by u.created_at;
$$;
revoke execute on function public.admin_email_recipients() from public, anon, authenticated;
grant execute on function public.admin_email_recipients() to service_role;

-- ---------------------------------------------------------------------------
-- Starter stickers: admins upload straight from the browser into the public bucket.
-- ---------------------------------------------------------------------------
create policy "stickers bucket: admins upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'stickers' and public.is_admin() and (storage.foldername(name))[1] = 'starter');
create policy "stickers bucket: admins delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'stickers' and public.is_admin());
