# Twain

A private game room for two. Next.js 15 + Supabase.

> Full setup and deployment docs land in Phase 8. Quick start for now:

1. `npm install`
2. Create a Supabase project, then run `supabase/migrations/*.sql` in order (SQL editor or `npx supabase db push`).
3. In Supabase Auth: enable Email (magic link) and Google; add `http://localhost:3000/auth/callback` to the redirect URLs.
4. `cp .env.example .env.local` and fill in the keys.
5. `npm run dev`

Checks: `npm run check` (typecheck, lint, unit tests).