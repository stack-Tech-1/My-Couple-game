// Runs a command with an env file loaded on top of the environment.
// Usage: node scripts/with-env.mjs .env.test.local -- npx next build
// Next.js inlines NEXT_PUBLIC_* at build time, so the test build must be made this way.
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const [file, sep, ...cmd] = process.argv.slice(2);
if (!file || sep !== "--" || !cmd.length) {
  console.error("Usage: node scripts/with-env.mjs <env-file> -- <command...>");
  process.exit(1);
}
if (!fs.existsSync(file)) {
  console.error(`${file} not found. Create it with the TEST project's keys (see README, "Testing").`);
  process.exit(1);
}
const env = { ...process.env };
for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const r = spawnSync(cmd.join(" "), { stdio: "inherit", env, shell: true });
process.exit(r.status ?? 1);
