# Amah

A private game room for two. Partners pair up in a shared room and play 27 games and
activities live from their own phones: head-to-head games, co-op puzzles, personal and
romantic keepsakes, and an opt-in 18+ section.

Built with Next.js 15 (App Router), TypeScript, Tailwind CSS v4 and Supabase (Postgres, Auth,
Realtime, Storage). The product name lives in one place: `APP_NAME` in `src/lib/config.ts`.

---

## Contents

1. [Quick start](#quick-start)
2. [Supabase setup](#supabase-setup)
3. [Environment variables](#environment-variables)
4. [Database migrations](#database-migrations)
5. [Local development](#local-development)
6. [Testing](#testing)
7. [Deploying](#deploying)
8. [How it works](#how-it-works)
9. [Adding a game](#adding-a-game)
10. [Editing content](#editing-content)
11. [Privacy and safety model](#privacy-and-safety-model)
12. [Before a public launch](#before-a-public-launch)

---

## Quick start

```bash
npm install
cp .env.example .env.local      # then fill it in (see below)
npm run db:migrate              # applies supabase/migrations/*.sql
npm run dev                     # http://localhost:3000
```

Requires Node 22+.

If the Supabase keys are missing, the app shows a "not wired up yet" screen instead of crashing.

---

## Supabase setup

1. **Create a project** at [supabase.com](https://supabase.com). Note its region.

2. **API keys**: *Project Settings → API keys*. Copy the project URL, the publishable (anon)
   key, and a secret (service role) key into `.env.local`.

3. **Database connection string** (only used by `npm run db:migrate`):
   *Project Settings → Database → Connection string → **Session pooler***.
   Use the pooler, not the "Direct connection": the direct host is IPv6-only and unreachable
   from many networks. It looks like:
   `postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`

4. **Run the migrations**: `npm run db:migrate`. This creates every table, row-level-security
   policy, function, the private `memories` storage bucket, and the Realtime publication.

5. **Auth providers**: *Authentication → Sign In / Providers*.
   - **Email** is on by default (magic links).
   - **Google** (optional): create an OAuth client in Google Cloud, then paste the client ID
     and secret here. The authorised redirect URI is the one Supabase shows on that page.

6. **Redirect URLs**: *Authentication → URL Configuration*.
   - **Site URL**: your production URL, e.g. `https://amah.example`.
   - **Redirect URLs**: add
     `http://localhost:3000/auth/callback`, `http://localhost:3000/auth/confirm`,
     `https://<your-domain>/auth/callback` and `https://<your-domain>/auth/confirm`.

7. **Magic-link email (recommended)**: *Authentication → Emails → Magic link*. Replace the
   link in the template with:

   ```html
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/room">Sign in to Amah</a>
   ```

   The default template works when the link is opened in the same browser that requested it.
   The token-hash version also works when someone requests the link on their laptop and opens
   it on their phone, which is common.

8. **Email sending**: Supabase's built-in sender is heavily rate-limited and meant for testing,
   and templates can only be edited once custom SMTP is set up (*Authentication → Emails →
   SMTP Settings*). A Gmail address with an app password works to start; use a provider with your
   own domain (e.g. Resend, Postmark) before launch.

9. **Branded emails**: paste these into *Authentication → Emails → Templates* (Source tab):

   | Template | Subject | File |
   | --- | --- | --- |
   | Confirm sign up | `Your Amah room is waiting` | `supabase/templates/confirm-signup.html` |
   | Magic link or OTP | `Your Amah sign-in link` | `supabase/templates/magic-link.html` |
   | Change email address | `Confirm your new email for Amah` | `supabase/templates/change-email.html` |

   They link to `/auth/confirm` with a token hash, so a link requested on one device works on any
   other. Open the files in a browser to preview them. The logo is the static file
   `public/email/amah-mark.png`, referenced by its full URL; if the production domain changes,
   update that URL in all three templates.

No other dashboard setup is needed: tables, policies, storage and realtime all come from the
migrations.

---

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | Publishable key. Safe to expose; every table is protected by RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Secret key. Used for authoritative game state, account deletion and test setup. Never prefix it with `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_SITE_URL` | browser + server | Canonical URL for invite links, Open Graph tags and the sitemap. `http://localhost:3000` locally. |
| `SUPABASE_DB_URL` | your machine / CI | Postgres session-pooler connection string, used only by `npm run db:migrate`. Not needed by the deployed app. |
| `NEXT_PUBLIC_ANALYTICS_PROVIDER` | optional | Empty (off), `console` (logs events) or `plausible`. |
| `NEXT_PUBLIC_ANALYTICS_DOMAIN` | optional | Your Plausible site domain, when the provider is `plausible`. |
| `AMAH_SANDBOX` | optional | `1` enables `/dev/play/<game>` in a production build (used by tests). Leave unset in production. |

`.env.local` is git-ignored. **Never put real keys in `.env.example`**: it is committed.

---

## Database migrations

All schema lives in `supabase/migrations/`, applied in filename order:

| File | What it adds |
| --- | --- |
| `0001_foundation.sql` | Profiles, rooms, membership, invite/pairing functions, moments timeline, rate limiting, Realtime channel authorisation. |
| `0002_game_engine.sql` | Game sessions, hidden server-side state, per-player views, move log, atomic move commits, scoreboard. |
| `0003_personal.sql` | "Complete" outcome; Daily Question with answers sealed until both have answered. |
| `0004_romantic.sql` | Love notes (sealable), Memory Lane (private photo bucket), bucket list, trigger-based rate limits. |
| `0005_after_dark.sql` | 18+ consent model, per-person PIN, custom cards, Fantasy Match (mutual matches only). |
| `0006_discreet_moments.sql` | Keeps After Dark sessions off the shared timeline. |
| `0007_spicy_sessions_readable.sql` | Lets an in-progress After Dark card finish after an opt-out. |
| `0008_chat.sql` | Room chat: `chat_messages`, `chat_reads` (unread and "Seen") and `mark_chat_read`. |
| `0009_chat_media.sql` | Voice notes and stickers: message kinds, `stickers`, the public `stickers` bucket (starter pack) and the private `chat-media` bucket. |
| `0010_admin.sql` | Admin: `app_admins`, `is_admin()`, `app_config` (game switches), `announcements`, and the service-role-only `admin_stats`, `admin_find_user`, `admin_remove_from_room`. |

`npm run db:migrate` records what it has applied in `public._twain_migrations` (the original project name; kept so existing databases stay in sync) and only runs new
files, each in its own transaction. To change the schema, **add a new numbered file**; never edit
one that has already been applied.

You can also paste the files into the Supabase SQL editor in order, or use the Supabase CLI
(`supabase db push`).

---

## Local development

```bash
npm run dev          # Next dev server on :3000
npm run check        # typecheck + lint + unit tests
```

**Game sandbox**: `http://localhost:3000/dev/play/<game-id>` (development only) renders a game
with both seats side by side, running the real game rules locally with no backend. It is the
fastest way to build or debug a game. Game ids are listed in `src/games/catalog.ts`.

**Utility scripts**

- `node scripts/build-words.mjs` regenerates the Word Duel dictionary from the MIT-licensed
  `word-list` package.
- `node scripts/make-grain.mjs` regenerates the paper-texture tiles.

---

## Testing

**Unit tests** (`npm test`, Vitest): game rules, edge cases, win conditions and the privacy of every
game's per-player view. They run in a couple of seconds.

**End-to-end tests** (`npm run e2e`, Playwright) run against a production build and your real
Supabase project. They create throwaway users (`amah-e2e-…@example.com`) and delete them
afterwards. Coverage:

- Pairing, then Connect Four played live in two browsers (with a mid-game refresh).
- Simultaneous Word Duel guesses: every guess lands, and there is exactly one winner.
- Daily Question and a co-op win in two browsers.
- Romantic features end to end, and After Dark end to end (consent, PIN, heat cap, discreet
  mode, skip, opt-out, quick exit).
- Direct-database privacy probes for Daily Question, love notes, photos, After Dark and Fantasy
  Match, run as the real users.
- Accessibility (axe, WCAG 2.1 AA) on every main screen in both themes and on every game board.
- Landing page weight, and offline behaviour of the service worker.

First run: `npx playwright install chromium`.

Handy flags:

```bash
E2E_REUSE=1 npm run e2e        # reuse a server you already started with `next start -p 3100`
E2E_NO_SERVER=1 npx playwright test e2e/daily-privacy.spec.ts   # database-only specs
AMAH_SANDBOX=1 npx next start -p 3100   # lets the per-board accessibility audit run
```

---

## Deploying

### Vercel (primary)

1. Import the repository in Vercel. The framework (Next.js) is detected automatically.
2. Add the environment variables from the table above, for Production and Preview.
   Set `NEXT_PUBLIC_SITE_URL` to the production URL. Don't set `SUPABASE_DB_URL` or
   `AMAH_SANDBOX` there.
3. Deploy, then add the production `…/auth/callback` and `…/auth/confirm` URLs to Supabase's
   redirect list (see [Supabase setup](#supabase-setup)).
4. Run migrations from your machine or CI (`npm run db:migrate`) before deploying any change that
   needs a new one.

**Keep the functions next to the database.** Every move makes several sequential database calls,
so the distance between the server functions and Supabase is paid several times per move.
`vercel.json` pins functions to `dub1` (Dublin) to sit beside a Supabase project in `eu-west-1`
(Ireland). If your project lives elsewhere, change `regions` to the closest Vercel region (for
example `iad1` for `us-east-1`, `sfo1` for `us-west-1`, `sin1` for `ap-southeast-1`).

### Netlify

`netlify.toml` is included. Netlify's Next.js runtime is detected automatically. Add the same
environment variables, deploy, and add the redirect URLs to Supabase. Middleware and server
actions run on Netlify Functions; nothing in the app is Vercel-specific. Set the Functions region
(Site configuration → Functions) to the one closest to your Supabase project.

### Checklist after the first deploy

- Sign in with an email link on the deployed site.
- Pair two accounts and play a game in two browsers.
- Visit `/sitemap.xml`, `/robots.txt` and `/manifest.webmanifest`.
- Try "Add to Home Screen" on a phone (it's installable as a PWA).

---

## How it works

### Folder map

```
src/
  app/                 routes: (marketing) landing + legal, (auth) sign-in, (app) the product
  games/
    catalog.ts         every game's name, category, tagline (the library is built from this)
    logic.ts           server-safe registry: id → pure game logic
    registry.tsx       client registry: id → board component
    _engine/           GameLogic interface, seeded RNG, move runner
    <game>/logic.ts    rules (pure, deterministic, unit-tested)
    <game>/Board.tsx   UI
  content/             every deck, question bank and word list (edit freely)
  components/          room shell, game host, romantic and After Dark features
  design/              design system: tokens are in app/globals.css
  lib/                 Supabase clients, server actions, realtime provider
supabase/migrations/   the whole database
e2e/                   Playwright tests
```

### Authoritative, private game state

- Every session game implements `GameLogic` (`src/games/_engine/types.ts`): `initialState`,
  `validateMove`, `applyMove`, `isOver` and `viewFor`. These are pure and deterministic, use a
  seeded RNG, and are shared by the server and the tests.
- The full state lives in `game_secrets`, which clients cannot read at all. After each move the
  server stores each player's `viewFor(...)` projection in `game_views`, and RLS lets you read
  only your own. Hidden hands, answers and targets never reach the other phone.
- Clients send moves only (`POST /api/sessions/:id/move`). The server validates the move with Zod
  and the game's rules, then commits it atomically with a version check. Simultaneous moves
  retry, so neither is lost.
- Clients get updates over Supabase Realtime and treat each event as a signal to refetch. A
  broadcast "moved" ping and a slow safety poll cover dropped events. Reconnecting or refreshing
  resumes exactly where you were.
- Low-latency extras (drawing strokes, spins, invites) travel on a private Realtime broadcast
  channel that only the room's two members can join.

### Room features

Daily Question, Love Notes, Memory Lane, Date Night, the bucket list and Fantasy Match are
ongoing room features rather than turn-based sessions. They use their own tables, server
actions and RLS (see `src/components/romantic`, `src/components/afterdark` and `src/lib/*`).

**Chat** (`src/components/chat/Chat.tsx`) sits in the room header, so it's one tap away on every
room page and mid-game. The browser writes messages straight to Supabase under RLS, then
broadcasts the saved row on the room channel for instant delivery. Postgres Changes and refetches
on reconnect are the backstop, and messages are deduped by id. In After Dark, a message preview
says "Sent you a message" and never quotes the text.

Voice notes record in the browser (MediaRecorder, up to 3 minutes) and upload to the private
`chat-media` bucket at `<room>/voice/`. Stickers come from two places: the **starter pack** every
couple gets, and each couple's own stickers made from their photos (`<room>/stickers/`, private).
To fill the starter pack from a folder (WhatsApp's sticker folder works as is):

```bash
npm run stickers:import -- "C:\Users\you\Downloads\WhatsApp Stickers"
```

Only use stickers you have the right to share with every user of the app.

### Admin

`/admin` is for the people running Amah. Grant access to an existing account (sign in to the app
once with it first):

```bash
npm run admin:grant -- you@example.com            # add
npm run admin:grant -- you@example.com --revoke   # remove
```

- **Overview:** counts only, over 7, 30 or 90 days. It shows people, paired couples,
  daily/weekly/monthly active people, games started and finished per game, chat volume and
  weekly retention. "Active" means a game move, a chat message or a Daily Question answer that
  day. Nobody's content is read, and After Dark is never counted.
- **Users:** look up one account by exact email, then suspend, restore or delete it.
  Deleting works like self-deletion: the partner keeps the room.
- **Games:** switch a game off (hidden everywhere, and new sessions are refused) or tag it "New".
- **Announcements:** a dismissible banner in every room, for a set number of days.

All admin reads go through `SECURITY DEFINER` functions that only the service role can execute,
and every admin action re-checks `is_admin()` on the server.

---

## Adding a game

1. Add an entry to `GAMES` in `src/games/catalog.ts` (id, name, category, minutes, tagline).
2. Create `src/games/<id>/logic.ts` exporting a `GameLogic` and write `logic.test.ts` next to it.
3. Create `src/games/<id>/Board.tsx`. It receives `GameProps`: `view`, `me`, `sendMove`,
   `clock`, `broadcast` and so on.
4. Register it with one line in `src/games/logic.ts` and one in `src/games/registry.tsx`.
5. Add tile art in `src/games/GameArt.tsx`.
6. Build it in the sandbox (`/dev/play/<id>`), then run `npm run check`.

Registry tests then check that the game is in the catalogue, that it never leaks its RNG seed to
clients, and that the library has no dead entries.

---

## Editing content

Everything players read lives in `src/content/` as plain TypeScript data:

| File | Used by |
| --- | --- |
| `know-me-bank.ts` | Know Me Trivia question bank |
| `words/answers5.ts` | Word Duel answers (each must also be a valid guess; a test enforces this) |
| `draw-words.ts` | Draw & Guess prompts by difficulty |
| `split-clues.ts` | Split Clues puzzles (both halves are needed; tests check structure) |
| `personal.ts` | How Well, This or That, Story Chain openers, Deep Questions, Daily Questions |
| `date-ideas.ts` | Date Night Generator |
| `after-dark.ts` | Truth/Dare, Hot Seat, Never Have I Ever, Spicy Dice faces, Fantasy items |

All content is original. Players can also add their own After Dark cards, which stay private to
their room.

---

## Privacy and safety model

- **RLS on every table.** Room data is readable only by that room's two members, and
  room-scoped writes go through checked policies or `SECURITY DEFINER` functions.
- **Pairing.** Joining retires the invite code, so a room holds exactly two people.
- **Sealed things stay sealed in the database, not just the UI.** Daily answers until both have
  answered; love notes until their unlock time; Never Have I Ever answers until both have tapped.
- **Photos.** Private bucket, room-scoped storage policies, and access only through short-lived
  signed URLs. Images are re-encoded in the browser, which strips EXIF data including GPS.
- **Rate limits** on room creation, joining, moves, notes, photos, list items, custom cards and
  PIN attempts.
- **Account deletion** removes the user's account, everything they wrote and their uploaded
  photos.

**After Dark** (18+), built to the owner's decisions:

- **Consent.** Each person confirms they're 18+ (a checkbox; only the timestamp is stored) and
  opts in separately. A database constraint makes opting in impossible without the
  confirmation. `spicy_unlocked(room)` gates every spicy table and session.
- **Heat.** Capped at the lower of the two limits, set by the server.
- **Skipping.** Any card can be skipped instantly, with no penalty and no record of who skipped.
- **PIN.** Per person, stored as a bcrypt hash. Unlocking lasts 30 idle minutes per browser tab.
- **Discreet mode.** The screen blurs when you switch away, and quick exit (button or Esc twice)
  replaces history. After Dark never appears on the timeline, in presence or in invite text.
- **Opting out mid-game.** The current card finishes, then the session ends neutrally.
- **Fantasy Match.** Picks are owner-only, and only mutual matches are ever returned.
  Yes + Maybe applies only if both partners enabled it. Un-saying a Yes removes the match quietly.
- **Leaving a room.** After Dark data is kept; a new partner must opt in themselves.

---

## Before a public launch

- **Legal pages.** Write the Terms, Privacy Policy and 18+ notice text (`src/app/(marketing)/`).
  Each placeholder is clearly marked "To be written".
- **Email.** Configure custom SMTP in Supabase and the token-hash magic-link template above.
- **Google OAuth.** Configure it if you want it; the button works once the provider is enabled.
- **Analytics.** Choose whether to enable it; it only ever sends event names, never content.
- **Age verification.** Review whether the 18+ checkbox meets the requirements where you launch.
- **Fonts.** Fraunces and Manrope are bundled under the SIL Open Font License; see
  `public/fonts/NOTICE.txt`.
