// Prints a one-tap sign-in link for the app running on your computer, so you can try it
// without waiting for an email. TEST project only: it refuses to run against the live one.
// Usage: npm run dev:login -- you@example.com [Name]
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const email = (process.argv[2] ?? "").trim().toLowerCase();
const port = process.env.PORT ?? "3100";
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("Usage: npm run dev:login -- you@example.com");
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Run this through npm run dev:login (it loads .env.test.local).");
  process.exit(1);
}
// Never the live database: compare with the live keys in .env.local, if they're here.
const live = fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8").match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*["']?([^"'\s]+)/)?.[1] : null;
if (live && live === url) {
  console.error("This points at the LIVE project. dev:login only works with the test project.");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
// New address: make the account (already confirmed). Existing: just sign in.
const created = await admin.auth.admin.createUser({ email, email_confirm: true });
if (created.error && !/already|registered|exists/i.test(created.error.message)) {
  console.error("Couldn't make the account:", created.error.message);
  process.exit(1);
}
const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
if (error || !data?.properties?.hashed_token) {
  console.error("Couldn't make a sign-in link:", error?.message ?? "no token");
  process.exit(1);
}
console.log(`\nSign in as ${email} (test database). Open this link in the browser where the app is running:\n`);
console.log(`http://localhost:${port}/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink&next=/room\n`);
console.log("The link works once and expires in an hour. Run the command again for a fresh one.");
