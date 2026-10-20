import { admin, cleanup } from "./helpers";

/**
 * Remove test accounts a previous run left behind (a dropped connection can skip a test's own
 * cleanup), so they never show up in the admin numbers.
 */
export default async function globalSetup() {
  const stale: string[] = [];
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data.users.length) break;
    for (const u of data.users) if (/^(amah|twain)-e2e-/.test(u.email ?? "")) stale.push(u.id);
    if (data.users.length < 200) break;
  }
  if (stale.length) await cleanup(stale);
}
