-- Amah: feedback inbox, suggested cards, and the admin user list.

-- ---------------------------------------------------------------------------
-- Feedback: bugs, ideas, complaints. A thread between the person and the team.
-- ---------------------------------------------------------------------------
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('bug', 'idea', 'complaint', 'other')),
  body text not null check (char_length(body) between 3 and 2000),
  screenshot_path text check (screenshot_path is null or char_length(screenshot_path) <= 200),
  -- Page, app version, device: whatever helps reproduce it. Never content.
  meta jsonb not null default '{}'::jsonb check (pg_column_size(meta) < 2000),
  status text not null default 'new' check (status in ('new', 'in_progress', 'done', 'wont_do')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index feedback_status_idx on public.feedback (status, created_at desc);
create index feedback_user_idx on public.feedback (user_id, created_at desc);
alter table public.feedback enable row level security;
create policy "feedback: read own" on public.feedback for select to authenticated using (user_id = auth.uid());
create policy "feedback: send own" on public.feedback
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'new' and admin_note is null
    and (screenshot_path is null or screenshot_path like auth.uid()::text || '/%'));
create trigger feedback_rate before insert on public.feedback
  for each row execute function public.enforce_rate_limit('feedback', '10', '3600');

create table public.feedback_replies (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback (id) on delete cascade,
  from_team boolean not null,
  author_id uuid references auth.users (id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index feedback_replies_idx on public.feedback_replies (feedback_id, created_at);
alter table public.feedback_replies enable row level security;
create policy "replies: read own thread" on public.feedback_replies
  for select to authenticated
  using (exists (select 1 from public.feedback f where f.id = feedback_id and f.user_id = auth.uid()));
create policy "replies: answer own thread" on public.feedback_replies
  for insert to authenticated
  with check (not from_team and author_id = auth.uid()
    and exists (select 1 from public.feedback f where f.id = feedback_id and f.user_id = auth.uid()));
create trigger feedback_replies_rate before insert on public.feedback_replies
  for each row execute function public.enforce_rate_limit('feedback_reply', '30', '3600');

-- When the person last opened their feedback, for the "new reply" dot.
alter table public.profiles add column feedback_seen_at timestamptz;

-- Screenshots: private, in the sender's own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback', 'feedback', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy "feedback files: own folder upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'feedback' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "feedback files: own folder read" on storage.objects
  for select to authenticated
  using (bucket_id = 'feedback' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Suggestions: people propose cards and questions; the team approves them into the decks.
-- ---------------------------------------------------------------------------
create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in (
    'daily_question', 'date_idea', 'this_or_that', 'story_opener', 'how_well', 'deep_question',
    'truth', 'dare', 'hot_seat', 'never'
  )),
  body jsonb not null check (jsonb_typeof(body) = 'object' and pg_column_size(body) < 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  content_item_id uuid references public.content_items (id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index suggestions_status_idx on public.suggestions (status, created_at desc);
alter table public.suggestions enable row level security;
create policy "suggestions: read own" on public.suggestions for select to authenticated using (user_id = auth.uid());
create policy "suggestions: send own" on public.suggestions
  for insert to authenticated with check (user_id = auth.uid() and status = 'pending' and content_item_id is null);
create trigger suggestions_rate before insert on public.suggestions
  for each row execute function public.enforce_rate_limit('suggestion', '20', '3600');

-- ---------------------------------------------------------------------------
-- Admin: every account with its partner. Account facts only, never content. Service role only.
-- ---------------------------------------------------------------------------
create function public.admin_list_users(p_search text default null, p_filter text default 'all', p_limit integer default 50, p_offset integer default 0)
returns table (
  id uuid,
  email text,
  display_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  last_active date,
  banned_until timestamptz,
  is_admin boolean,
  room_id uuid,
  paired_at timestamptz,
  partner_id uuid,
  partner_email text,
  partner_name text,
  total bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with act as (
    select by_user as uid, max(created_at)::date as d from public.game_moves where by_user is not null group by by_user
    union all
    select sender_id, max(created_at)::date from public.chat_messages group by sender_id
    union all
    select user_id, max(created_at)::date from public.daily_answers group by user_id
  ),
  last_act as (select uid, max(d) as d from act group by uid),
  base as (
    select u.id, u.email::text as email, p.display_name, u.created_at, u.last_sign_in_at, la.d as last_active, u.banned_until,
           exists (select 1 from public.app_admins a where a.user_id = u.id) as is_admin,
           m.room_id, r.paired_at,
           pm.user_id as partner_id, pu.email::text as partner_email, pp.display_name as partner_name
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join last_act la on la.uid = u.id
    left join public.room_members m on m.user_id = u.id
    left join public.rooms r on r.id = m.room_id
    left join public.room_members pm on pm.room_id = m.room_id and pm.user_id <> u.id
    left join auth.users pu on pu.id = pm.user_id
    left join public.profiles pp on pp.id = pm.user_id
  ),
  filtered as (
    select * from base
    where (coalesce(trim(p_search), '') = ''
           or email ilike '%' || trim(p_search) || '%'
           or display_name ilike '%' || trim(p_search) || '%'
           or partner_email ilike '%' || trim(p_search) || '%')
      and case coalesce(p_filter, 'all')
            when 'paired' then partner_id is not null
            when 'waiting' then room_id is not null and partner_id is null
            when 'no_room' then room_id is null
            when 'suspended' then banned_until > now()
            when 'admins' then is_admin
            else true
          end
  )
  select f.*, count(*) over () as total
  from filtered f
  order by f.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0);
$$;
revoke execute on function public.admin_list_users(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.admin_list_users(text, text, integer, integer) to service_role;

alter publication supabase_realtime add table public.feedback_replies;
