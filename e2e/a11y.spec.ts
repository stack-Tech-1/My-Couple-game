import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { admin, cleanup, pairedRoom, signInPath } from "./helpers";

const REPORT_ONLY = !!process.env.A11Y_REPORT;

async function audit(page: Page, name: string) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(600); // let entrance animations settle so contrast is measured on final colours
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  for (const v of serious) console.log(`[${name}] ${v.impact} ${v.id}: ${v.help}\n   ${v.nodes.slice(0, 4).map((n) => n.target.join(" ")).join("\n   ")}`);
  if (!REPORT_ONLY) expect(serious.map((v) => `${name}: ${v.id}`)).toEqual([]);
}

/** WCAG 2.1 AA audit of every main screen, in both themes. */
test("accessibility: key screens have no serious or critical violations", async ({ browser }) => {
  test.setTimeout(300_000);
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const p = await ctx.newPage();

  await p.goto("/");
  await audit(p, "landing");
  await p.goto("/sign-in");
  await audit(p, "sign-in");

  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  try {
    await p.goto(await signInPath(a.email, `/room/${roomId}`));
    await audit(p, "room home (day)");
    await p.goto(`/room/${roomId}/settings`);
    await audit(p, "settings");
    await p.getByRole("radio", { name: "Night" }).click();
    await expect.poll(async () => (await admin.from("profiles").select("theme").eq("id", a.id).single()).data?.theme).toBe("night");
    await p.goto(`/room/${roomId}`);
    await expect(p.locator("html")).toHaveAttribute("data-theme", "night");
    await audit(p, "room home (night)");

    await p.goto(`/room/${roomId}/games/connect-four`);
    await audit(p, "game page");
    await p.getByRole("button", { name: "Invite Bo" }).click();
    await expect(p).toHaveURL(/\/play\//);
    await audit(p, "connect four");

    for (const f of ["love-notes", "memory-lane", "bucket-list", "date-night", "daily-question"]) {
      await p.goto(`/room/${roomId}/games/${f}`);
      await audit(p, f);
    }

    await admin.from("room_members").update({ age_confirmed_at: new Date().toISOString(), spicy_opt_in: true }).eq("room_id", roomId);
    await p.goto(`/room/${roomId}/after-dark`);
    await audit(p, "after dark (pin)");
  } finally {
    await cleanup([a.id, b.id]);
    await ctx.close();
  }
});
/** Every game board, via the two-seat sandbox (needs a server started with AMAH_SANDBOX=1). */
test("accessibility: every game board", async ({ page }) => {
  test.setTimeout(400_000);
  const probe = await page.goto("/dev/play/connect-four");
  test.skip(!probe || probe.status() === 404, "sandbox disabled on this server");
  const { GAME_LOGIC } = await import("../src/games/logic");
  for (const id of Object.keys(GAME_LOGIC)) {
    await page.goto(`/dev/play/${id}`);
    await page.waitForSelector("[data-seat]");
    await audit(page, `board: ${id}`);
  }
});
