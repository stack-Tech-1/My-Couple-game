import { expect, test } from "@playwright/test";
import { admin, cleanup, friendRoom, makeUser, onboardedUser, pairedRoom, signInPath } from "./helpers";

/**
 * The admin tools added for launch: couples in the Paired view, the person page, friend rooms,
 * today's word, the activity log, health, Overview numbers, and announcements for one group.
 */
test("admin tools: couples, people, rooms, words, activity, health and targeted announcements", async ({ browser }) => {
  const { a, b } = await pairedRoom(["Ada", "Bo"]);
  const waiter = await onboardedUser("Wale", "fig");
  const pal = await onboardedUser("Pal", "moon");
  const { error: roomErr } = await waiter.c.rpc("create_room", { room_name: "Our room" });
  expect(roomErr).toBeNull();
  const crew = await friendRoom(pal, [], "Test Crew Admin");
  const boss = await makeUser("boss");
  await admin.from("app_admins").insert({ user_id: boss.id });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const day = new Date(Date.now() + 3600_000 + 5 * 864e5).toISOString().slice(0, 10);
  let announcementId: string | null = null;
  try {
    // Paired: one row per couple, both names together.
    await page.goto(await signInPath(boss.email, `/admin/users?filter=paired&q=${encodeURIComponent(a.email)}`));
    const couple = page.getByRole("row").filter({ hasText: "Ada" });
    await expect(couple).toContainText("Bo");
    await expect(couple).toHaveCount(1);

    // The person page: rooms, Plus, Solo in one place.
    await page.goto(`/admin/users?email=${encodeURIComponent(a.email)}`);
    await expect(page.getByRole("heading", { name: /Ada/ })).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "Couple room" })).toContainText("with Bo");
    await expect(page.getByRole("heading", { name: "Amah Plus" })).toBeVisible();

    // Friend rooms: the room and who's in it.
    await page.goto(`/admin/rooms?q=Test%20Crew%20Admin`);
    await page.getByRole("link", { name: "Test Crew Admin" }).click();
    await expect(page.locator("#people")).toContainText("Pal");
    expect(crew.id).toBeTruthy();

    // Today's word: set a day's word, see it in the list and the activity log.
    await page.goto("/admin/words");
    const row = page.getByRole("listitem").filter({ hasText: new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) });
    await row.getByRole("button", { name: "Change" }).click();
    await row.getByLabel("Word (5 letters)").fill("mango");
    const naija = row.getByLabel("Naija word");
    if (await naija.isChecked()) await naija.uncheck();
    await row.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(/MANGO is the word for/)).toBeVisible();
    await expect(row).toContainText("Set by hand");
    await page.goto("/admin/activity?q=word");
    await expect(page.getByRole("row").filter({ hasText: "Set a day's word" }).first()).toContainText(day);

    // Health and Overview render.
    await page.goto("/admin/health");
    await expect(page.getByText("Paystack payments")).toBeVisible();
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Plus and Solo" })).toBeVisible();

    // An announcement only for people waiting for their person.
    await page.goto("/admin/announcements");
    await page.getByLabel("Title").fill("E2E for the waiting");
    await page.getByLabel("Message").fill("Your person is one tap away.");
    await page.getByText("Waiting for their person", { exact: true }).click();
    await page.getByRole("button", { name: /Publish|Post/ }).click();
    await expect(page.getByText(/Only the group you picked sees it/)).toBeVisible();
    const { data: ann } = await admin.from("announcements").select("id, audience").eq("title", "E2E for the waiting").single();
    announcementId = ann!.id as string;
    expect(ann!.audience).toBe("waiting");

    // Wale (waiting) sees it; Ada (paired) doesn't.
    const w = await (await browser.newContext()).newPage();
    await w.goto(await signInPath(waiter.email, "/room"));
    await expect(w.getByText("E2E for the waiting")).toBeVisible();
    const pa = await (await browser.newContext()).newPage();
    await pa.goto(await signInPath(a.email, "/room"));
    await expect(pa.getByRole("heading", { name: /Ada/ }).or(pa.getByText(/Evening|Morning|Afternoon/)).first()).toBeVisible();
    await expect(pa.getByText("E2E for the waiting")).toHaveCount(0);
    await w.context().close();
    await pa.context().close();
  } finally {
    if (announcementId) await admin.from("announcements").delete().eq("id", announcementId);
    await admin.from("solo_word_days").delete().eq("day", day);
    await admin.from("app_admins").delete().eq("user_id", boss.id);
    await cleanup([a.id, b.id, waiter.id, pal.id, boss.id]);
    await ctx.close();
  }
});
