import { expect, test } from "@playwright/test";
import { admin, cleanup, onboardedUser, signInPath } from "./helpers";
import { newWall, takings, type WallState } from "../src/lib/solo/games/bashwall";

test("bash am: free players can look but not play, with no run started", async ({ browser }) => {
  test.setTimeout(120_000);
  const free = await onboardedUser("Bas", "fig", { plus: false });
  const friend = await onboardedUser("Dar");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    // Even a friend's challenge doesn't open it without Plus.
    const token = `bashch${Date.now()}`;
    await admin.from("solo_challenges").insert({ token, from_user: friend.id, game_id: "bash-am", mode: "normal", seed: "s", target: 500 });
    const page = await ctx.newPage();
    await page.goto(await signInPath(free.email, "/solo/bash-am"));
    await expect(page.getByRole("heading", { name: "Bash Am", level: 1 })).toBeVisible();
    await expect(page.getByText("Bash Am comes with Amah Plus")).toBeVisible();
    await expect(page.getByRole("link", { name: /^Play wall/ })).toHaveCount(0);

    for (const path of ["?mode=wall-1", "?mode=normal", `?challenge=${token}`]) {
      await page.goto(`/solo/bash-am${path}`);
      await expect(page.getByText("Bash Am comes with Amah Plus")).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('[data-tour="bash-wall"]')).toHaveCount(0);
    }
    const { data: runs } = await admin.from("solo_runs").select("id").eq("user_id", free.id).eq("game_id", "bash-am");
    expect(runs).toEqual([]);

    await page.goto("/solo");
    await expect(page.getByText("Bash Am comes with Amah Plus.")).toBeVisible();
  } finally {
    await cleanup([free.id, friend.id]);
    await ctx.close();
  }
});

test("bash am: Plus clears a wall, gets paid, opens the next, and builds on the street", async ({ browser }) => {
  test.setTimeout(180_000);
  const plus = await onboardedUser("Bob");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const page = await ctx.newPage();
    await page.goto(await signInPath(plus.email, "/solo/bash-am"));
    await expect(page.getByRole("link", { name: "Play wall 1" })).toBeVisible();

    // Walls can't be skipped.
    await page.goto("/solo/bash-am?mode=wall-3");
    await expect(page).toHaveURL(/\/solo\/bash-am$/);

    // Carry on from a game saved one brick from the end, so the finish is the real one.
    const seed = "e2e-wall";
    const { data: run } = await admin.from("solo_runs").insert({ user_id: plus.id, game_id: "bash-am", mode: "wall-1", seed }).select("id").single();
    const base = newWall(seed, 1);
    const state: WallState = { ...base, launched: true, bricks: [{ id: 1, col: 3, row: 3, hp: 1, kind: "brick", paint: 0 }], balls: [{ id: 1, x: 179, y: 260, vx: 0, vy: -250 }] };
    await page.evaluate(([key, value]) => localStorage.setItem(key!, value!), ["amah:solo:bash-am:wall-1", JSON.stringify({ runId: run!.id, seed, target: null, elapsed: 30000, state, at: Date.now() })]);
    await page.goto("/solo/bash-am?mode=wall-1");
    await page.getByRole("button", { name: "Carry on" }).click();
    await expect(page.getByRole("heading", { name: "Wall don fall!" })).toBeVisible({ timeout: 20_000 });
    await expect.poll(async () => (await admin.from("solo_scores").select("mode, score").eq("user_id", plus.id).eq("game_id", "bash-am")).data).toEqual([{ mode: "wall-1", score: takings(1, 0) }]);

    await page.getByRole("link", { name: "Back to the sites" }).click();
    await expect(page.getByRole("link", { name: "Play wall 2" })).toBeVisible();

    const { data: extra } = await admin.from("solo_runs").insert({ user_id: plus.id, game_id: "bash-am", mode: "wall-1", seed }).select("id").single();
    await admin.from("solo_scores").insert({ run_id: extra!.id, user_id: plus.id, game_id: "bash-am", mode: "wall-1", seed, score: 5000, duration_ms: 60000, meta: {} });
    await page.reload();
    await page.getByRole("button", { name: "Build Carpenter's Shed for ₦5,000" }).click();
    await expect(page.getByText("Built", { exact: true })).toBeVisible();
    await expect.poll(async () => (await admin.from("solo_shop").select("item, price").eq("user_id", plus.id).eq("game_id", "bash-am")).data).toEqual([{ item: "shed", price: 5000 }]);
  } finally {
    await cleanup([plus.id]);
    await ctx.close();
  }
});
