// Creates the web-push (VAPID) key pair once per project and stores it in app_secrets.
// Usage: npm run push:keys  (live, .env.local)   |   node scripts/push-keys.mjs --env .env.test.local
// Safe to re-run: existing keys are kept (changing them would break every saved subscription).
import fs from "node:fs";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const envArg = process.argv.indexOf("--env");
const file = envArg > -1 ? process.argv[envArg + 1] : ".env.local";
const env = Object.fromEntries(
  fs.readFileSync(file, "utf8").split(/\r?\n/).map((l) => l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: existing } = await admin.from("app_secrets").select("key").in("key", ["vapid_public", "vapid_private"]);
if (existing?.length === 2) {
  console.log(`Push keys already exist in ${file}'s project. Nothing changed.`);
  process.exit(0);
}
const keys = webpush.generateVAPIDKeys();
const { error } = await admin.from("app_secrets").upsert([
  { key: "vapid_public", value: keys.publicKey },
  { key: "vapid_private", value: keys.privateKey },
]);
if (error) {
  console.error(error.message);
  process.exit(1);
}
console.log(`Push keys created for ${file}'s project.`);
