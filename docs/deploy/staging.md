# Staging: a test copy before the live site

`main` is the live site. A push to `main` goes straight to playamah.app.

`staging` is the test copy. A push to `staging` builds a private preview on Vercel, on its own address, using the **test** database. Nothing on playamah.app changes and no real user is touched.

The flow:

1. Work is committed on your computer.
2. It's pushed to `staging`. Vercel builds the preview in a few minutes.
3. You open the preview on your phone and try it.
4. When you're happy, `staging` is merged into `main`, and that goes live.
5. If something breaks on the live site, Vercel can put the previous version back in one click.

---

## One-time setup in Vercel

Do this **before** anything is pushed to `staging`. The point is that a preview must never use the live database or live payments.

Have `.env.test.local` open in your editor: the test values come from there. Never paste keys into a chat or anywhere else; type or copy them straight into Vercel.

### 1. Open the settings

1. Go to **vercel.com**, sign in, and open the Amah project.
2. Click **Settings**, then **Environment Variables** in the left menu.

Every variable shows which environments it applies to: **Production**, **Preview**, **Development**.

### 2. Keep the live values on Production only

For each of these, check the environments. If **Preview** is ticked, click the **⋯** menu, **Edit**, untick **Preview** and **Development**, and **Save**:

| Variable | Why |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | The live database's address |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The live database's public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Full access to the live database |
| `SUPABASE_DB_URL` | The live database itself (if it's there) |
| `NEXT_PUBLIC_SITE_URL` | playamah.app: a preview's links must not point there |
| `PAYSTACK_SECRET_KEY` | Live payments (if it's there) |
| `CRON_SECRET` | The live birthday emails job |
| `EMAIL_LINK_SECRET` | Live unsubscribe links (if it's there) |
| `NEXT_PUBLIC_ANALYTICS_PROVIDER`, `NEXT_PUBLIC_ANALYTICS_DOMAIN` | So test clicks don't count as real visitors (if they're there) |

The email settings (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`) can stay on Preview too: the test copy only has test accounts, so it can only email those.

### 3. Add the test values for Preview

Click **Add New** (or **Add Environment Variable**). For each row: type the name, paste the value from `.env.test.local`, tick **Preview only** (untick Production and Development), and save.

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | the test one from `.env.test.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the test one from `.env.test.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | the test one from `.env.test.local` |
| `TEST_PAYSTACK_SECRET_KEY` | the test one from `.env.test.local` |
| `AMAH_ENV` | `staging` |

Don't add `NEXT_PUBLIC_SITE_URL` for Preview. The app then uses the preview's own address for its links.

When you're done, the list should show each Supabase variable **twice**: once for Production (live) and once for Preview (test).

### 4. Let the test database accept the preview's sign-ins

Signing in sends an email link back to the address you're on, and the database only accepts addresses on its list.

1. Go to **supabase.com** and open the **test** project (the one in `.env.test.local`, not the live one).
2. **Authentication**, then **URL Configuration**.
3. Under **Redirect URLs**, click **Add URL** and add: `https://*.vercel.app/**`
4. Save.

### 5. Keep the preview private

1. Back in Vercel: **Settings**, then **Deployment Protection**.
2. Make sure **Vercel Authentication** is on for preview deployments (it is by default).

Only people signed in to your Vercel team can open the preview. On your phone, sign in to vercel.com once in the browser. To let a friend test it, use **Share** on the deployment page to make a shareable link.

---

## After setup

Tell Claude the setup is done. It pushes `staging`, and Vercel builds the preview.

To find the preview: in Vercel, open the project, then **Deployments**. The newest one marked **Preview** from the `staging` branch has a **Visit** button. The branch address stays the same for every new push to `staging`.

The test database starts with no real accounts, so you sign up there like a new player. To try Plus games on the test copy, ask Claude to give your test account Plus.

### Going live

When the test copy is right: `staging` is merged into `main` and pushed. Before that, the database changes run on the live database (`npm run db:migrate`), and the Fix Am pictures are loaded (`npm run db:seed:fixam`). See the launch routine.

### Undo on the live site

Vercel, **Deployments**, find the last good **Production** deployment, **⋯** menu, **Promote to Production**. That puts it back in seconds. A database change can't be undone this way, which is why database changes are kept additive.
