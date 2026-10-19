// Applies supabase/migrations/*.sql in order, once each, inside a transaction.
// Usage: npm run db:migrate   (reads SUPABASE_DB_URL from .env.local or the environment)
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv(".env.local");

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL is not set. Add your Supabase connection string (Session pooler) to .env.local.");
  process.exit(1);
}

const dir = path.resolve("supabase/migrations");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query("create table if not exists public._twain_migrations (name text primary key, applied_at timestamptz not null default now())");
await client.query("alter table public._twain_migrations enable row level security");
const { rows } = await client.query("select name from public._twain_migrations");
const done = new Set(rows.map((r) => r.name));

let applied = 0;
for (const f of files) {
  if (done.has(f)) continue;
  const sql = fs.readFileSync(path.join(dir, f), "utf8");
  process.stdout.write(`applying ${f} ... `);
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("insert into public._twain_migrations (name) values ($1)", [f]);
    await client.query("commit");
    console.log("ok");
    applied++;
  } catch (e) {
    await client.query("rollback");
    console.log("FAILED");
    console.error(e.message);
    await client.end();
    process.exit(1);
  }
}
// Make PostgREST see new tables/functions immediately.
await client.query("notify pgrst, 'reload schema'");
await client.end();
console.log(applied ? `${applied} migration(s) applied.` : "Database is up to date.");