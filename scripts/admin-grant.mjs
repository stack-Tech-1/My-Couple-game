// Grants (or with --revoke, removes) admin access for an existing Amah account.
// Usage: npm run admin:grant -- you@example.com [--revoke]
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv(".env.local");

const email = process.argv[2];
const revoke = process.argv.includes("--revoke");
if (!email || !email.includes("@")) {
  console.error("Usage: npm run admin:grant -- you@example.com [--revoke]");
  process.exit(1);
}
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data, error } = await admin.rpc("admin_find_user", { p_email: email });
const user = data?.[0];
if (error || !user) {
  console.error(`No Amah account uses ${email}. Sign in to the app once with it, then run this again.`);
  process.exit(1);
}
const { error: writeErr } = revoke
  ? await admin.from("app_admins").delete().eq("user_id", user.id)
  : await admin.from("app_admins").upsert({ user_id: user.id });
if (writeErr) {
  console.error(writeErr.message);
  process.exit(1);
}
console.log(revoke ? `${email} is no longer an admin.` : `${email} is now an admin. Open /admin.`);
