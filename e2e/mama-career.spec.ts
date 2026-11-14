import { expect, test } from "@playwright/test";
import { admin, cleanup, onboardedUser, signInPath } from "./helpers";

/**
 * Mama Put's career and shop: days open in order, stars from the best takings, savings from
 * everything taken in, upgrades bought per restaurant, and Yaba free even when the day's free
 * plays are used up.
 */
const score = (userId: string, mode: string, n: number) => ({ user_id: userId, game_id: "mama-put", mode, seed: "s", score: n, duration_ms: 60000 });

test("Mama Put: the career map, stars, quick rush bests, and buying an upgrade", async ({ browser }) => {
  const me = await onboardedUser("Tolu", "fig", { plus: false });
  await admin.from("profiles").update({ solo_home: true }).eq("id", me.id);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await page.goto(await signInPath(me.email, "/solo/mama-put"));
    await expect(page.getByRole("heading", { name: "Mama Put", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /Day 1 · Yaba/ })).toContainText("Free to play");
    await expect(page.getByLabel("Day 2, locked")).toBeVisible();
    // A locked day can't be opened by its address either.
    await page.goto("/solo/mama-put?mode=day-2");
    await expect(page).toHaveURL(/\/solo\/mama-put$/);

    // Three stars on day 1, one on day 2, and a hard rush.
    await admin.from("solo_scores").insert([score(me.id, "day-1", 8000), score(me.id, "day-2", 5000), score(me.id, "hard", 12000)]);
    await page.reload();
    await expect(page.getByRole("link", { name: "Day 1, 3 of 3 stars" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Day 2, 1 of 3 stars" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Day 3, 0 of 3 stars" })).toBeVisible();
    await expect(page.getByLabel("Day 4, locked")).toBeVisible();
    await expect(page.getByRole("link", { name: /Day 3 · Yaba/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "Your career" })).toContainText("4 of 90 ★");
    await expect(page.getByRole("radio", { name: /Hard/ })).toContainText("Best ₦12,000");

    // Savings: everything taken in. Buy the fan; the chairs are out of reach for now.
    const shop = page.getByRole("region", { name: "Your buka" });
    await expect(shop).toContainText("₦25,000");
    await shop.getByRole("button", { name: "Buy Standing fan for ₦15,000" }).click();
    const done = page.getByRole("dialog", { name: "New in your buka: standing fan" });
    await expect(done).toBeVisible();
    await done.getByRole("button", { name: "Keep shopping" }).click();
    await expect(shop).toContainText("₦10,000");
    await expect(shop.getByRole("listitem").filter({ hasText: "Standing fan" })).toContainText("In your buka");
    await expect(shop.getByRole("button", { name: "Buy Chairs and table for ₦25,000" })).toBeDisabled();
    const { data: rows } = await admin.from("solo_shop").select("area, item, price").eq("user_id", me.id);
    expect(rows).toEqual([{ area: 0, item: "fan", price: 15000 }]);
    // The shop can't be written to from the browser.
    const { error } = await me.c.from("solo_shop").insert({ user_id: me.id, game_id: "mama-put", area: 0, item: "tv", price: 0 });
    expect(error).not.toBeNull();
  } finally {
    await cleanup([me.id]);
    await ctx.close();
  }
});

test("Mama Put: Yaba is free to play after the day's free plays are gone; quick rushes aren't", async ({ browser }) => {
  const me = await onboardedUser("Segun", "fig", { plus: false });
  await admin.from("profiles").update({ solo_home: true }).eq("id", me.id);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    const run = { user_id: me.id, game_id: "mama-put", mode: "normal", seed: "s", started_at: new Date().toISOString() };
    await admin.from("solo_runs").insert([run, { ...run, seed: "t" }]);
    await page.goto(await signInPath(me.email, "/solo/mama-put?mode=hard"));
    await expect(page.getByRole("heading", { name: "It opens again at midnight" })).toBeVisible();
    await page.goto("/solo/mama-put?mode=day-1");
    await expect(page.getByRole("heading", { name: "Day 1 · Yaba" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Jollof" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "It opens again at midnight" })).toHaveCount(0);
  } finally {
    await cleanup([me.id]);
    await ctx.close();
  }
});
