import { expect, test } from "@playwright/test";
import { admin, cleanup, clientAs, makeUser, pairedRoom, signInPath } from "./helpers";

/**
 * Admin. These run against the real project, so anything global they change (a game switched
 * off, an announcement) is short-lived and restored in `finally`.
 */

test("non-admins can't reach any admin data or switch", async ({ page }) => {
  const eve = await makeUser("eve");
  try {
    const ce = await clientAs(eve.email);
    expect((await ce.rpc("is_admin")).data).toBe(false);
    expect((await ce.rpc("admin_stats", { p_days: 30 })).error).not.toBeNull();
    expect((await ce.rpc("admin_find_user", { p_email: eve.email })).error).not.toBeNull();
    expect((await ce.rpc("admin_remove_from_room", { p_user: eve.id })).error).not.toBeNull();
    expect((await ce.from("app_admins").insert({ user_id: eve.id })).error).not.toBeNull();
    await ce.from("app_config").update({ value: { off: ["ludo"], new: [] } }).eq("key", "games");
    const { data: cfg } = await admin.from("app_config").select("value").eq("key", "games").single();
    expect((cfg!.value as { off: string[] }).off).not.toContain("ludo");
    expect((await ce.from("announcements").insert({ title: "hi", body: "spam" })).error).not.toBeNull();

    await page.goto(await signInPath(eve.email, "/admin"));
    await expect(page.getByRole("heading", { name: "Overview" })).toHaveCount(0);
    await expect(page.locator("body")).toContainText(/not found|wandered|404/i);
  } finally {
    await cleanup([eve.id]);
  }
});

test("admin: numbers, game switches, announcements and user management", async ({ browser }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  await admin.from("app_admins").insert({ user_id: a.id });
  const { data: before } = await admin.from("app_config").select("value").eq("key", "games").single();
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const ctxB = await browser.newContext({ viewport: { width: 400, height: 860 } });
  const pa = await ctxA.newPage();
  const pb = await ctxB.newPage();
  const errors: string[] = [];
  for (const p of [pa, pb]) p.on("pageerror", (e) => errors.push(e.message));
  const SHOTS = process.env.SHOTS_DIR;

  try {
    // --- Overview
    await pa.goto(await signInPath(a.email, "/admin"));
    await expect(pa.getByRole("heading", { name: "Overview" })).toBeVisible();
    await expect(pa.getByText("Couples paired")).toBeVisible();
    await expect(pa.getByRole("img", { name: /Active people per day/ })).toBeVisible();
    await pa.getByRole("link", { name: "Last 7 days" }).click();
    await expect(pa).toHaveURL(/days=7/);
    if (SHOTS) await pa.screenshot({ path: `${SHOTS}/admin-overview.png`, fullPage: true });

    // --- Game switches: Ludo off and Word Duel tagged new, as Bo sees it
    await pa.goto("/admin/games");
    await pa.getByRole("switch", { name: "Ludo available" }).click();
    await pa.getByRole("switch", { name: "Word Duel tagged new" }).click();
    await expect.poll(async () => ((await admin.from("app_config").select("value").eq("key", "games").single()).data!.value as { off: string[] }).off).toContain("ludo");
    if (SHOTS) await pa.screenshot({ path: `${SHOTS}/admin-games.png`, fullPage: true });

    await pb.goto(await signInPath(b.email, `/room/${roomId}`));
    const library = pb.getByRole("region", { name: "The library" });
    await expect(library.getByRole("link", { name: /Word Duel/ })).toContainText("New");
    await expect(library.getByRole("link", { name: /Ludo/ })).toHaveCount(0);
    await pb.goto(`/room/${roomId}/games/ludo`);
    await expect(pb.getByRole("heading", { name: "Ludo is taking a break." })).toBeVisible();
    const blocked = await pb.request.post("/api/sessions", { data: { gameId: "ludo" } });
    expect(blocked.status()).toBe(403);

    // --- Announcement: live for Bo, dismissible, then ended
    await pa.goto("/admin/announcements");
    const title = `E2E notice ${Date.now()}`;
    await pa.getByLabel("Title").fill(title);
    await pa.getByLabel("Message").fill("Testing the banner. It goes away in a moment.");
    await pa.getByText("Celebration").click();
    await pa.getByLabel("Show it for").selectOption("1");
    await pa.getByRole("button", { name: "Publish" }).click();
    await expect(pa.getByRole("listitem").filter({ hasText: title })).toContainText("Live");
    await pb.goto(`/room/${roomId}`);
    const banner = pb.getByRole("status", { name: "Announcement" });
    await expect(banner).toContainText(title);
    if (SHOTS) await pb.screenshot({ path: `${SHOTS}/announcement.png` });
    await banner.getByRole("button", { name: "Dismiss announcement" }).click();
    await expect(pb.getByText(title)).toHaveCount(0);
    await pa.getByRole("listitem").filter({ hasText: title }).getByRole("button", { name: "End now" }).click();
    await expect(pa.getByRole("listitem").filter({ hasText: title })).toContainText("Ended");

    // --- Users: find Bo, suspend, restore, then delete; Ada keeps the room
    await pa.goto("/admin/users");
    await pa.getByLabel("Email address").fill(b.email.toUpperCase());
    await pa.getByRole("button", { name: "Find" }).click();
    await expect(pa.getByText("Paired with a partner")).toBeVisible();
    await pa.getByRole("button", { name: "Suspend account" }).click();
    await expect(pa.getByText("Suspended", { exact: true })).toBeVisible();
    // A suspended account can't sign in.
    await expect(clientAs(b.email)).rejects.toBeTruthy();
    await pa.getByRole("button", { name: "Restore account" }).click();
    await expect(pa.getByText("Suspended", { exact: true })).toHaveCount(0);
    if (SHOTS) await pa.screenshot({ path: `${SHOTS}/admin-users.png` });

    await pa.getByRole("button", { name: "Delete account" }).click();
    const confirm = pa.getByRole("dialog");
    await expect(confirm.getByRole("button", { name: "Delete forever" })).toBeDisabled();
    await confirm.getByRole("textbox").fill(b.email);
    await confirm.getByRole("button", { name: "Delete forever" }).click();
    await expect(pa.getByText("Account deleted.")).toBeVisible();
    const { data: gone } = await admin.auth.admin.getUserById(b.id);
    expect(gone.user).toBeNull();
    const { data: room } = await admin.from("rooms").select("paired_at, invite_code").eq("id", roomId).single();
    expect(room!.paired_at).toBeNull();
    expect(room!.invite_code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

    // The admin can't act on themselves.
    await pa.getByLabel("Email address").fill(a.email);
    await pa.getByRole("button", { name: "Find" }).click();
    await expect(pa.getByRole("button", { name: "Delete account" })).toBeDisabled();

    expect(errors).toEqual([]);
  } finally {
    await admin.from("app_config").update({ value: before!.value }).eq("key", "games");
    await admin.from("announcements").delete().like("title", "E2E notice %");
    await ctxA.close();
    await ctxB.close();
    await cleanup([a.id, b.id]);
  }
});
