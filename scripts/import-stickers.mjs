// Imports a folder of stickers into the starter pack that every couple gets.
// Usage: npm run stickers:import -- "C:\path\to\WhatsApp Stickers"
//
// Takes .webp (static or animated), .png and .gif files up to 1 MB. WhatsApp's own sticker folder
// works as is. Files are named by their content hash, so running it twice never duplicates.
import crypto from "node:crypto";
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
loadEnv(".env.local");

const dir = process.argv[2];
if (!dir || !fs.existsSync(dir)) {
  console.error('Usage: npm run stickers:import -- "<folder of stickers>"');
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });

const TYPES = { ".webp": "image/webp", ".png": "image/png", ".gif": "image/gif" };
const MAX = 1024 * 1024;

const isAnimated = (buf, type) => {
  if (type === "image/gif") return true;
  if (type !== "image/webp") return false;
  const head = buf.subarray(0, 4096).toString("latin1");
  return head.startsWith("RIFF") && head.includes("ANIM");
};

const files = fs.readdirSync(dir).filter((f) => TYPES[path.extname(f).toLowerCase()]).sort();
const { count } = await admin.from("stickers").select("id", { count: "exact", head: true }).is("room_id", null);
let sort = count ?? 0;
let added = 0;
let skipped = 0;

for (const f of files) {
  const buf = fs.readFileSync(path.join(dir, f));
  const type = TYPES[path.extname(f).toLowerCase()];
  if (buf.length > MAX) {
    console.warn(`skip ${f}: over 1 MB`);
    skipped++;
    continue;
  }
  const hash = crypto.createHash("sha1").update(buf).digest("hex").slice(0, 20);
  const objectPath = `starter/${hash}${path.extname(f).toLowerCase()}`;
  const { data: existing } = await admin.from("stickers").select("id").eq("path", objectPath).maybeSingle();
  if (existing) {
    skipped++;
    continue;
  }
  const { error: up } = await admin.storage.from("stickers").upload(objectPath, buf, { contentType: type, upsert: true, cacheControl: "31536000" });
  if (up) {
    console.warn(`skip ${f}: ${up.message}`);
    skipped++;
    continue;
  }
  const { error } = await admin.from("stickers").insert({ room_id: null, path: objectPath, animated: isAnimated(buf, type), sort: sort++ });
  if (error) {
    console.warn(`skip ${f}: ${error.message}`);
    skipped++;
    continue;
  }
  added++;
}

console.log(`${added} sticker(s) added to the starter pack, ${skipped} skipped (duplicates, too large or unreadable).`);
