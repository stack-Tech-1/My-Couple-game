import { expect, test, type Page } from "@playwright/test";
import { admin, cleanup, onboardedUser, signInPath } from "./helpers";

/** Sweep the can from side to side until the night ends. */
async function survive(page: Page) {
  const room = page.locator('[data-tour="mosquito-room"]');
  await expect(room).toBeVisible({ timeout: 30_000 });
  const box = (await room.boundingBox())!;
  const morning = page.getByRole("heading", { name: "Morning don come!" });
  for (let i = 0; i < 900 && !(await morning.isVisible()); i++) {
    const x = box.x + box.width * (0.5 + 0.42 * Math.sin(i / 3));
    await page.mouse.move(x, box.y + box.height * 0.6);
    await page.waitForTimeout(120);
  }
  await expect(morning).toBeVisible({ timeout: 5000 });
}

test("mosquito wahala: a night pays into savings, opens the next, and free players get two games a day", async ({ browser }) => {
  test.setTimeout(300_000);
  const free = await onboardedUser("Mos", "fig", { plus: false });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const page = await ctx.newPage();
    await page.goto(await signInPath(free.email, "/solo/mosquito-wahala"));
    await expect(page.getByRole("heading", { name: "Mosquito Wahala", level: 1 })).toBeVisible();
    await expect(page.getByText("Two free games a day. 2 left today.")).toBeVisible();

    // Nights can't be skipped.
    await page.goto("/solo/mosquito-wahala?mode=night-3");
    await expect(page).toHaveURL(/\/solo\/mosquito-wahala$/);

    await page.getByRole("link", { name: "Play night 1" }).click();
    await survive(page);
    await expect.poll(async () => (await admin.from("solo_scores").select("mode").eq("user_id", free.id).eq("game_id", "mosquito-wahala").gt("score", 0)).data).toEqual([{ mode: "night-1" }]);

    await page.goto("/solo/mosquito-wahala");
    await expect(page.getByRole("link", { name: "Play night 2" })).toBeVisible();
    await expect(page.getByText("Two free games a day. 1 left today.")).toBeVisible();

    // All Night is the second game of the day, and the third is refused.
    await page.goto("/solo/mosquito-wahala?mode=normal");
    await expect(page.getByRole("heading", { name: "All Night" })).toBeVisible();
    await expect(page.locator('[data-tour="mosquito-room"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: /Big Spray/ })).toHaveCount(0);
    await expect.poll(async () => (await admin.from("solo_runs").select("id").eq("user_id", free.id).eq("game_id", "mosquito-wahala")).data?.length).toBe(2);

    await page.goto("/solo/mosquito-wahala");
    await expect(page.getByText("Your free nights come back at midnight.")).toBeVisible();
    await page.goto("/solo/mosquito-wahala?mode=night-2");
    await expect(page.getByText("today's 2 free games of Mosquito Wahala")).toBeVisible({ timeout: 30_000 });
  } finally {
    await cleanup([free.id]);
    await ctx.close();
  }
});

test("mosquito wahala: gear is bought from night savings at the server's price", async ({ browser }) => {
  test.setTimeout(120_000);
  const plus = await onboardedUser("Gia");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const { data: run } = await admin.from("solo_runs").insert({ user_id: plus.id, game_id: "mosquito-wahala", mode: "night-1", seed: "e2e" }).select("id").single();
    await admin.from("solo_scores").insert({ run_id: run!.id, user_id: plus.id, game_id: "mosquito-wahala", mode: "night-1", seed: "e2e", score: 5000, duration_ms: 60000, meta: {} });
    const page = await ctx.newPage();
    await page.goto(await signInPath(plus.email, "/solo/mosquito-wahala"));
    await expect(page.getByText("₦5,000")).toBeVisible();
    await page.getByRole("button", { name: "Buy Coil Stand for ₦4,000" }).click();
    await expect(page.getByText("₦1,000")).toBeVisible();
    await expect(page.getByRole("button", { name: "Buy Wide Nozzle for ₦6,000" })).toBeDisabled();
    await expect.poll(async () => (await admin.from("solo_shop").select("item, price").eq("user_id", plus.id).eq("game_id", "mosquito-wahala")).data).toEqual([{ item: "coil", price: 4000 }]);
  } finally {
    await cleanup([plus.id]);
    await ctx.close();
  }
});
