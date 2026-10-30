// Loads the starter Fix Am pictures (supabase/seed/fixam) into the fixam bucket and table.
// Safe to run again: pictures already there (same file) are skipped.
// Usage: npm run db:seed:fixam        (live: .env.local)
//        npm run db:seed:fixam:test   (test project: .env.test.local)
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const envArg = process.argv.indexOf("--env");
loadEnv(envArg > -1 ? process.argv[envArg + 1] : ".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const dir = path.resolve("supabase/seed/fixam");
const list = JSON.parse(fs.readFileSync(path.join(dir, "pictures.json"), "utf8"));

const { data: existing, error: readErr } = await db.from("fixam_pictures").select("path, sort");
if (readErr) {
  console.error("Couldn't read fixam_pictures:", readErr.message);
  process.exit(1);
}
const have = new Set(existing.map((r) => r.path));
let sort = Math.max(0, ...existing.map((r) => r.sort ?? 0));
let added = 0;

for (const p of list) {
  const dest = `starter/${p.file}`;
  if (have.has(dest)) continue;
  const body = fs.readFileSync(path.join(dir, p.file));
  const { error: up } = await db.storage.from("fixam").upload(dest, body, { contentType: "image/webp", upsert: true });
  if (up) {
    console.error(`upload ${p.file}: ${up.message}`);
    process.exit(1);
  }
  const { error } = await db.from("fixam_pictures").insert({
    name: p.name,
    place: p.place,
    note: p.note ?? "",
    link: p.link ?? null,
    own_photo: false,
    credit: p.credit,
    credit_url: p.credit_url,
    path: dest,
    live: true,
    sort: ++sort,
  });
  if (error) {
    console.error(`insert ${p.name}: ${error.message}`);
    process.exit(1);
  }
  added++;
}
console.log(`${added} picture(s) added, ${list.length - added} already there.`);
