import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { admin, cleanup, clientAs, loadEnv, makeUser, pairedRoom, signInPath } from "./helpers";

/**
 * Content editing, starter stickers and email preferences. Runs against the real project: every
 * row it adds is removed in `finally`.
 */

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==", "base64");

test("content tables and admin uploads are closed to everyone else", async () => {
  const eve = await makeUser("eve");
  try {
    const ce = await clientAs(eve.email);
    expect((await ce.from("content_items").select("id")).data ?? []).toEqual([]);
    expect((await ce.from("content_items").insert({ kind: "daily_question", body: { text: "spam?" } })).error).not.toBeNull();
    expect((await ce.from("content_hidden").insert({ kind: "daily_question", key: "b_x" })).error).not.toBeNull();
    expect((await ce.rpc("admin_email_recipients")).error).not.toBeNull();
    expect((await ce.storage.from("stickers").upload(`starter/eve${Date.now()}.png`, PNG, { contentType: "image/png" })).error).not.toBeNull();
  } finally {
    await cleanup([eve.id]);
  }
});

test("admin edits content and the starter pack; people control announcement emails", async ({ browser }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  await admin.from("app_admins").insert({ user_id: a.id });
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const ctxB = await browser.newContext({ viewport: { width: 400, height: 860 } });
  const pa = await ctxA.newPage();
  const pb = await ctxB.newPage();
  const errors: string[] = [];
  for (const p of [pa, pb]) p.on("pageerror", (e) => errors.push(e.message));
  const SHOTS = process.env.SHOTS_DIR;
  const opener = `E2E opener ${Date.now()}: the lights went out at the worst possible moment.`;
  const startedAt = new Date().toISOString();
  const uploaded: string[] = [];

  try {
    // --- Content: add a Story opener, hide a built-in, show it again, remove ours
    await pa.goto(await signInPath(a.email, "/admin/content?kind=story_opener"));
    await expect(pa.getByRole("heading", { name: "Story openers" })).toBeVisible();
    await pa.getByLabel("Opening line").fill(opener);
    await pa.getByRole("button", { name: "Add", exact: true }).click();
    await expect(pa.getByText(opener)).toBeVisible();
    const { data: added } = await admin.from("content_items").select("id, body").eq("kind", "story_opener").contains("body", { text: opener });
    expect(added).toHaveLength(1);

    const cards = pa.getByRole("list", { name: "Story openers list" });
    const firstBuiltIn = cards.getByRole("listitem").filter({ hasNotText: "Yours" }).first();
    const builtInText = (await firstBuiltIn.innerText()).split("\n")[0]!.trim();
    await firstBuiltIn.getByRole("button", { name: /^Hide:/ }).click();
    await expect(pa.getByRole("button", { name: `Show: ${builtInText}` })).toBeVisible();
    await pa.getByRole("button", { name: "hidden" }).click();
    await expect(cards.getByRole("listitem")).toHaveCount(1);
    if (SHOTS) await pa.screenshot({ path: `${SHOTS}/admin-content.png`, fullPage: true });
    await pa.getByRole("button", { name: `Show: ${builtInText}` }).click();
    await expect(pa.getByText("Nothing matches.")).toBeVisible();
    await pa.getByRole("button", { name: "all" }).click();
    await pa.getByRole("button", { name: `Remove: ${opener}` }).click();
    await expect(pa.getByRole("button", { name: `Show: ${opener}` })).toBeVisible();

    // Validation: a How Well question needs four answers.
    await pa.goto("/admin/content?kind=how_well");
    await pa.getByLabel("Question", { exact: true }).fill("Best snack?");
    for (const [i, v] of ["Crisps", "Fruit", "Chocolate"].entries()) await pa.getByLabel(`Answer ${i + 1}`).fill(v);
    await pa.getByRole("button", { name: "Add", exact: true }).click();
    await expect(pa.getByLabel("Answer 4")).toHaveJSProperty("validity.valueMissing", true);

    // --- Starter stickers: upload, see it in a couple's tray, remove
    await pa.goto("/admin/stickers");
    const before = Number((await pa.getByText(/in the pack$/).innerText()).split(" ")[0]);
    await pa.locator('input[type="file"]').setInputFiles({ name: "wave.png", mimeType: "image/png", buffer: PNG });
    await expect(pa.getByText(`${before + 1} in the pack`)).toBeVisible();
    if (SHOTS) await pa.screenshot({ path: `${SHOTS}/admin-stickers.png` });
    const { data: newest } = await admin.from("stickers").select("id, path").is("room_id", null).gte("created_at", startedAt);
    expect(newest).toHaveLength(1);
    uploaded.push(newest![0]!.path as string);
    await pa.getByRole("button", { name: "Remove some" }).click();
    await pa.getByRole("button", { name: `Remove starter sticker ${before + 1}` }).click();
    await expect(pa.getByText(`${before} in the pack`)).toBeVisible();

    // --- Email: not configured here, so the option is off and explains why
    await pa.goto("/admin/announcements");
    await expect(pa.getByRole("checkbox", { name: /Also email it to everyone/ })).toBeDisabled();
    await expect(pa.getByText(/Email isn't set up yet/)).toBeVisible();

    // --- Unsubscribe link: no sign-in needed, signed for one account, reversible in settings
    const secret = process.env.EMAIL_LINK_SECRET || loadEnv().SUPABASE_SERVICE_ROLE_KEY!;
    const token = createHmac("sha256", secret).update(`unsubscribe:${b.id}`).digest("base64url").slice(0, 32);
    const anon = await browser.newContext();
    const pu = await anon.newPage();
    await pu.goto(`/email/unsubscribe?u=${b.id}&t=${token.replace(/.$/, token.endsWith("A") ? "B" : "A")}`);
    await pu.getByRole("button", { name: "Unsubscribe" }).click();
    await expect(pu.getByRole("heading", { name: "That link didn't work." })).toBeVisible();
    await pu.goto(`/email/unsubscribe?u=${b.id}&t=${token}`);
    await pu.getByRole("button", { name: "Unsubscribe" }).click();
    await expect(pu.getByRole("heading", { name: "You're off the list." })).toBeVisible();
    await anon.close();
    expect((await admin.from("profiles").select("announcement_emails").eq("id", b.id).single()).data!.announcement_emails).toBe(false);
    // Mail apps' one-click unsubscribe POSTs to the API route.
    const oneClick = await pa.request.post(`/api/email/unsubscribe?u=${b.id}&t=${token}`);
    expect(oneClick.status()).toBe(200);

    await pb.goto(await signInPath(b.email, `/room/${roomId}/settings`));
    const sw = pb.getByRole("switch", { name: "Announcement emails" });
    await expect(sw).toHaveAttribute("aria-checked", "false");
    await sw.click();
    await expect.poll(async () => (await admin.from("profiles").select("announcement_emails").eq("id", b.id).single()).data!.announcement_emails).toBe(true);

    expect(errors).toEqual([]);
  } finally {
    await admin.from("content_items").delete().eq("kind", "story_opener").like("body->>text", "E2E opener %");
    await admin.from("content_hidden").delete().gte("created_at", startedAt).eq("created_by", a.id);
    const { data: stray } = await admin.from("stickers").select("id, path").is("room_id", null).gte("created_at", startedAt);
    if (stray?.length) {
      await admin.from("stickers").delete().in("id", stray.map((s) => s.id));
      uploaded.push(...stray.map((s) => s.path as string));
    }
    if (uploaded.length) await admin.storage.from("stickers").remove(uploaded);
    await ctxA.close();
    await ctxB.close();
    await cleanup([a.id, b.id]);
  }
});
