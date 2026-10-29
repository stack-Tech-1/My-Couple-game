import { createHmac } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { admin, cleanup, clientAs, friendRoom, loadEnv, onboardedUser, pairedRoom, signInPath } from "./helpers";

/**
 * Amah Plus, end to end, against Paystack's TEST mode. The checkout page itself is skipped (a test
 * can't type a card into Paystack); instead we send the webhook Paystack would send, signed with
 * the test secret key, exactly as the real one is.
 */
const SECRET = loadEnv().TEST_PAYSTACK_SECRET_KEY ?? loadEnv().PAYSTACK_SECRET_KEY ?? "";

async function webhook(request: APIRequestContext, event: string, data: Record<string, unknown>, sign = true) {
  const body = JSON.stringify({ event, data });
  const signature = sign ? createHmac("sha512", SECRET).update(body).digest("hex") : "nope";
  return request.post("/api/paystack/webhook", { data: body, headers: { "content-type": "application/json", "x-paystack-signature": signature } });
}

/** Click a pay button, stop at Paystack's door, and return the purchase it started. */
async function checkout(page: Page, button: RegExp, payer: string) {
  await page.route("https://checkout.paystack.com/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<p>Paystack test checkout</p>" }));
  await Promise.all([page.waitForURL(/checkout\.paystack\.com/, { timeout: 30_000 }), page.getByRole("button", { name: button }).click()]);
  const { data } = await admin.from("plus_purchases").select("*").eq("payer_id", payer).eq("status", "pending").order("created_at", { ascending: false }).limit(1).single();
  expect(data).toBeTruthy();
  return data as { reference: string; amount_kobo: number; paystack_plan: string | null; id: string };
}

test.skip(!SECRET, "TEST_PAYSTACK_SECRET_KEY is not set in .env.test.local");

test("couple: Plus games are invitations, the trial opens them, and a card payment covers both", async ({ browser, request }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"], { plus: false });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await page.goto(await signInPath(a.email, `/room/${roomId}/games/chess`));
    // No Plus: an invitation, not the game.
    await expect(page.getByRole("heading", { name: "Chess is on Amah Plus" })).toBeVisible();
    // The server refuses too, whatever the page shows.
    const refused = await page.evaluate(async (rid) => (await fetch("/api/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ gameId: "chess", roomId: rid }) })).status, roomId);
    expect(refused).toBe(402);
    // Free games stay free.
    await page.goto(`/room/${roomId}/games/whot`);
    await expect(page.getByRole("button", { name: "Invite Bo" })).toBeEnabled();

    // The trial: Plus for Ada, so the page now says Bo needs it.
    await page.goto(`/room/${roomId}/games/chess`);
    await page.getByRole("button", { name: "Try Plus free for 7 days" }).click();
    const who = page.getByRole("group", { name: "Who needs Plus" });
    await expect(who).toContainText("Bo");
    await expect(who.getByRole("button", { name: /Buy Bo a seat/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Waiting on 1 seat" })).toBeDisabled();
    // One trial each: a second one is refused.
    const { count } = await admin.from("plus_trials").select("email_key", { count: "exact", head: true }).eq("user_id", a.id);
    expect(count).toBe(1);

    // Pay for the couple plan by card.
    await page.goto(`/room/${roomId}/settings/plus`);
    await expect(page.getByRole("radio", { name: /Us two/ })).toHaveAttribute("aria-checked", "true");
    const p = await checkout(page, /Pay ₦3,000 by card/, a.id);
    expect(p.amount_kobo).toBe(300000);
    expect(p.paystack_plan).toMatch(/^PLN_/);

    // A forged webhook is ignored.
    expect((await webhook(request, "charge.success", { reference: p.reference, status: "success", amount: 300000, currency: "NGN" }, false)).status()).toBe(401);
    // Too little money pays nothing.
    expect((await webhook(request, "charge.success", { reference: p.reference, status: "success", amount: 100, currency: "NGN" })).status()).toBe(500);
    const charge = { reference: p.reference, status: "success", amount: 300000, currency: "NGN", channel: "card", authorization: { last4: "4081", brand: "visa" }, customer: { customer_code: `CUS_e2e_${a.id.slice(0, 8)}` }, plan: { plan_code: p.paystack_plan } };
    expect((await webhook(request, "charge.success", charge)).ok()).toBe(true);
    // Paystack sometimes sends things twice: still one set of seats.
    expect((await webhook(request, "charge.success", charge)).ok()).toBe(true);
    const { data: seats } = await admin.from("plus_seats").select("user_id").eq("purchase_id", p.id);
    expect(seats?.map((s) => s.user_id).sort()).toEqual([a.id, b.id].sort());

    // Back from Paystack.
    await page.goto(`/room/plus/return?reference=${p.reference}`);
    await expect(page).toHaveURL(/settings\/plus\?payment=paid/);
    await expect(page.getByText("Payment received. Welcome to Amah Plus.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "You and Bo have Plus" })).toBeVisible();
    await expect(page.getByText(/Renews .* on card ending 4081, ₦3,000/)).toBeVisible();

    // Now chess starts for both.
    await page.goto(`/room/${roomId}/games/chess`);
    await page.getByRole("button", { name: "Invite Bo" }).click();
    await expect(page).toHaveURL(/\/play\//);

    // A renewal Paystack charges on its own carries both seats forward a month.
    const renewal = `AMH-RNEW-${Date.now().toString(36).toUpperCase()}`;
    expect((await webhook(request, "charge.success", { ...charge, reference: renewal })).ok()).toBe(true);
    const { data: renewed } = await admin.from("plus_purchases").select("id, renews_from, status").eq("reference", renewal).single();
    expect(renewed).toMatchObject({ renews_from: p.id, status: "paid" });
    const { data: bo } = await admin.rpc("plus_until", { uid: b.id });
    expect(Date.parse(bo as string) - Date.now()).toBeGreaterThan(55 * 864e5);

    // A disputed renewal takes its month back.
    expect((await webhook(request, "charge.dispute.create", { transaction: { reference: renewal } })).ok()).toBe(true);
    const { data: back } = await admin.rpc("plus_until", { uid: b.id });
    expect(Date.parse(back as string) - Date.now()).toBeLessThan(32 * 864e5);
  } finally {
    await cleanup([a.id, b.id]);
    await ctx.close();
  }
});

test("friends: a group plan, seats handed out, the free limits, and why people leave", async ({ browser, request }) => {
  const ada = await onboardedUser("Ada", "fig", { plus: false });
  const tolu = await onboardedUser("Tolu", "moon", { plus: false });
  const chi = await onboardedUser("Chi", "wave", { plus: false });
  const dami = await onboardedUser("Dami", "pear", { plus: false });
  const room = await friendRoom(ada, [tolu, chi]);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    // Free accounts get one friend room.
    const { error: second } = await ada.c.rpc("create_room", { room_name: "Second crew", p_kind: "friends" });
    expect(second?.message).toMatch(/plus required: friend rooms/);
    // Free accounts can't send stickers or voice notes, whatever the app shows.
    const { error: sticker } = await ada.c.from("chat_messages").insert({ room_id: room.id, sender_id: ada.id, kind: "voice", media: { path: `${room.id}/voice/x.webm`, duration: 2, mime: "audio/webm" } });
    expect(sticker?.message).toMatch(/plus required/);

    await page.goto(await signInPath(ada.email, `/room/${room.id}/settings/plus`));
    await page.getByRole("radio", { name: /Group of 3/ }).click();
    const p = await checkout(page, /Pay once: transfer, USSD or card/, ada.id);
    expect(p.amount_kobo).toBe(400000);
    expect((await webhook(request, "charge.success", { reference: p.reference, status: "success", amount: 400000, currency: "NGN", channel: "bank_transfer" })).ok()).toBe(true);

    await page.goto(`/room/plus/return?reference=${p.reference}`);
    await expect(page.getByText("1 given, 2 waiting.")).toBeVisible();
    // Tick Tolu, give the seat.
    await page.getByRole("checkbox", { name: /Tolu/ }).check();
    await page.getByRole("button", { name: "Give seat to Tolu" }).click();
    await expect(page.getByText("2 given, 1 waiting.")).toBeVisible();

    // The room home offers the last seat to whoever doesn't have Plus.
    await page.goto(`/room/${room.id}`);
    const prompt = page.getByRole("status").filter({ hasText: "Give Chi a seat?" });
    await prompt.getByRole("button", { name: "Give" }).click();
    await expect(page.getByText("Chi has Plus now.")).toBeVisible();
    const { count } = await admin.from("plus_seats").select("id", { count: "exact", head: true }).eq("purchase_id", p.id);
    expect(count).toBe(3);
    // No fourth seat, and nobody outside the room.
    const { error: fourth } = await admin.rpc("plus_give_seat", { p_purchase: p.id, p_payer: ada.id, p_user: dami.id });
    expect(fourth?.message).toMatch(/no seats left|not in this room/);

    // Plus means a second friend room is fine now.
    const { data: second2, error: e2 } = await ada.c.rpc("create_room", { room_name: "Second crew", p_kind: "friends" });
    expect(e2).toBeNull();
    expect(second2?.id).toBeTruthy();

    // Leaving: the reason is counted, never tied to the person.
    const before = (await admin.from("leave_reasons").select("id", { count: "exact", head: true })).count ?? 0;
    const chiPage = await (await browser.newContext()).newPage();
    await chiPage.goto(await signInPath(chi.email, `/room/${room.id}/settings`));
    await chiPage.getByRole("button", { name: "Leave this room" }).click();
    const dialog = chiPage.getByRole("dialog", { name: "Leave the room?" });
    await expect(dialog.getByText("Before you go, can we ask why?")).toBeVisible();
    await dialog.getByRole("radio", { name: "We don't use Amah much" }).click();
    await dialog.getByRole("button", { name: "Leave", exact: true }).click();
    await chiPage.waitForURL(/onboarding|\/room/);
    await expect.poll(async () => (await admin.from("leave_reasons").select("id", { count: "exact", head: true })).count ?? 0).toBe(before + 1);
    await chiPage.context().close();
  } finally {
    await cleanup([ada.id, tolu.id, chi.id, dami.id]);
    await ctx.close();
  }
});

test("free limits on keepsakes: five photos and three sealed notes", async () => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"], { plus: false });
  try {
    const c = await clientAs(a.email);
    for (let i = 0; i < 5; i++) {
      const { error } = await c.from("memories").insert({ room_id: roomId, author_id: a.id, path: `${roomId}/m${i}.jpg`, prompt: "Where were we?" });
      expect(error).toBeNull();
    }
    const { error: sixth } = await c.from("memories").insert({ room_id: roomId, author_id: a.id, path: `${roomId}/m6.jpg`, prompt: "Where were we?" });
    expect(sixth?.message).toMatch(/plus limit: photos/);

    const later = new Date(Date.now() + 7 * 864e5).toISOString();
    for (let i = 0; i < 3; i++) {
      const { error } = await c.from("love_notes").insert({ room_id: roomId, author_id: a.id, recipient_id: b.id, body: `Note ${i}`, unlock_at: later });
      expect(error).toBeNull();
    }
    const { error: fourth } = await c.from("love_notes").insert({ room_id: roomId, author_id: a.id, recipient_id: b.id, body: "One more", unlock_at: later });
    expect(fourth?.message).toMatch(/plus limit: sealed notes/);
    // Plain notes are never limited.
    const { error: plain } = await c.from("love_notes").insert({ room_id: roomId, author_id: a.id, recipient_id: b.id, body: "Hi" });
    expect(plain).toBeNull();
  } finally {
    await cleanup([a.id, b.id]);
  }
});
