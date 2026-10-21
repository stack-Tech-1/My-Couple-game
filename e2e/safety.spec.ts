import { expect, test } from "@playwright/test";
import { admin, cleanup, clientAs, makeUser, pairedRoom, signInPath } from "./helpers";

/** Reports and blocks at the database: validated, private to the reporter, and blocks hold. */
test("reports and blocks hold up against direct access", async () => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const eve = await makeUser("eve");
  const cy = await makeUser("cy");
  try {
    const ca = await clientAs(a.email);
    const cb = await clientAs(b.email);
    const ce = await clientAs(eve.email);

    const { data: mine } = await ca.from("chat_messages").insert({ room_id: roomId, sender_id: a.id, body: "hi" }).select("id").single();
    const { data: theirs } = await cb.from("chat_messages").insert({ room_id: roomId, sender_id: b.id, body: "you'll regret this" }).select("id").single();

    // Ada reports one of Bo's messages; the text is snapshotted.
    const { data: reportId, error } = await ca.rpc("file_report", { p_reason: "harassment", p_details: "keeps threatening", p_message: theirs!.id });
    expect(error).toBeNull();
    const { data: row } = await admin.from("reports").select("*").eq("id", reportId).single();
    expect(row!.reported_id).toBe(b.id);
    expect((row!.message_snapshot as { body: string }).body).toBe("you'll regret this");
    // Only Bo's messages can be reported, by Ada; outsiders can't file at all.
    expect((await ca.rpc("file_report", { p_reason: "spam", p_message: mine!.id })).error).not.toBeNull();
    expect((await ce.rpc("file_report", { p_reason: "spam" })).error).not.toBeNull();
    expect((await ca.rpc("file_report", { p_reason: "made-up" })).error).not.toBeNull();
    // Reporters see their own reports; the reported person sees nothing; nobody inserts directly.
    expect((await ca.from("reports").select("id")).data).toHaveLength(1);
    expect((await cb.from("reports").select("id")).data).toEqual([]);
    expect((await cb.from("reports").insert({ reporter_id: b.id, reason: "spam" })).error).not.toBeNull();

    // Ada blocks Bo: she leaves, Bo keeps the room with a fresh code, and Ada can't rejoin it.
    expect((await ca.rpc("block_partner")).error).toBeNull();
    expect((await admin.from("room_members").select("user_id").eq("room_id", roomId)).data!.map((m) => m.user_id)).toEqual([b.id]);
    const { data: room } = await admin.from("rooms").select("invite_code, paired_at").eq("id", roomId).single();
    expect(room!.paired_at).toBeNull();
    const { error: rejoin } = await ca.rpc("join_room", { code: room!.invite_code });
    expect(rejoin?.message).toMatch(/invite not found/);
    // Someone else can still join Bo's room.
    const cc = await clientAs(cy.email);
    expect((await cc.rpc("join_room", { code: room!.invite_code })).error).toBeNull();
  } finally {
    await cleanup([a.id, b.id, eve.id, cy.id]);
  }
});

test("terms prompt, reporting, data saver, install card and blocking in the app", async ({ browser }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  // Bo signed up before we asked for consent.
  await admin.from("profiles").update({ terms_version: null, terms_accepted_at: null, adult_confirmed_at: null }).eq("id", b.id);
  const cb = await clientAs(b.email);
  await cb.from("chat_messages").insert({ room_id: roomId, sender_id: b.id, body: "answer me now or else" });
  await cb.from("chat_messages").insert({ room_id: roomId, sender_id: b.id, kind: "sticker", media: { sticker_id: "00000000-0000-4000-8000-000000000001", path: "starter/none.png", scope: "starter" } });

  const ctxA = await browser.newContext({ viewport: { width: 400, height: 860 } });
  const ctxB = await browser.newContext({ viewport: { width: 400, height: 860 } });
  const pa = await ctxA.newPage();
  const pb = await ctxB.newPage();
  const errors: string[] = [];
  for (const p of [pa, pb]) p.on("pageerror", (e) => errors.push(e.message));
  const SHOTS = process.env.SHOTS_DIR;

  try {
    // --- Bo must accept the Terms once; it can't be dismissed.
    await pb.goto(await signInPath(b.email, `/room/${roomId}`));
    const gate = pb.getByRole("dialog", { name: "One quick thing" });
    await expect(gate).toBeVisible();
    await pb.keyboard.press("Escape");
    await expect(gate).toBeVisible();
    if (SHOTS) await pb.screenshot({ path: `${SHOTS}/terms-gate.png` });
    await expect(gate.getByRole("button", { name: "Continue" })).toBeDisabled();
    await gate.getByRole("checkbox").check();
    await gate.getByRole("button", { name: "Continue" }).click();
    await expect(gate).toBeHidden();
    const { data: p } = await admin.from("profiles").select("terms_version, adult_confirmed_at").eq("id", b.id).single();
    expect(p!.terms_version).toBeTruthy();
    expect(p!.adult_confirmed_at).toBeTruthy();

    // --- Install card (Chrome's install event, simulated).
    await pa.goto(await signInPath(a.email, `/room/${roomId}`));
    await pa.evaluate(() => {
      const e = Object.assign(new Event("beforeinstallprompt"), { prompt: async () => {}, userChoice: Promise.resolve({ outcome: "accepted" }) });
      window.dispatchEvent(e);
    });
    const card = pa.getByRole("region", { name: "Install Amah" });
    await expect(card).toBeVisible();
    if (SHOTS) await pa.screenshot({ path: `${SHOTS}/install-card.png` });
    await card.getByRole("button", { name: "Install" }).click();
    await expect(card).toBeHidden();

    // --- Data saver on: Bo's sticker waits for a tap.
    await pa.goto(`/room/${roomId}/settings`);
    await pa.getByRole("radio", { name: "On" }).click();
    await pa.goto(`/room/${roomId}`);
    await pa.getByRole("button", { name: /Chat with Bo/ }).click();
    const chat = pa.getByRole("dialog", { name: "Chat with Bo" });
    await expect(chat.getByRole("button", { name: /Sticker\s*Tap to show/ })).toBeVisible();

    // --- Report one of Bo's messages from the chat (right-click on a computer).
    await chat.getByText("answer me now or else").click({ button: "right" });
    const report = pa.getByRole("dialog", { name: "Report this message" });
    await expect(report.getByText("answer me now or else")).toBeVisible();
    await report.getByText("Harassment, threats or abuse").click();
    await report.getByRole("button", { name: "Send report" }).click();
    await expect(pa.getByRole("dialog", { name: "Thank you for telling us" })).toBeVisible();
    if (SHOTS) await pa.screenshot({ path: `${SHOTS}/report-sent.png` });
    await pa.getByRole("button", { name: "Done" }).click();
    const { data: reports } = await admin.from("reports").select("reason, message_snapshot").eq("reporter_id", a.id);
    expect(reports).toHaveLength(1);
    expect((reports![0]!.message_snapshot as { body: string }).body).toBe("answer me now or else");

    // --- Block from Settings: Ada leaves, Bo keeps the room.
    await pa.goto(`/room/${roomId}/settings`);
    await pa.getByRole("button", { name: "Block Bo" }).click();
    await pa.getByRole("button", { name: "Block and leave" }).click();
    await expect(pa).toHaveURL(/\/(room|onboarding)/);
    await expect.poll(async () => (await admin.from("blocks").select("blocked_id").eq("blocker_id", a.id)).data?.[0]?.blocked_id).toBe(b.id);
    expect((await admin.from("room_members").select("user_id").eq("room_id", roomId)).data!.map((m) => m.user_id)).toEqual([b.id]);

    expect(errors).toEqual([]);
  } finally {
    await ctxA.close();
    await ctxB.close();
    await cleanup([a.id, b.id]);
  }
});

test("legal pages name the operator and cover the essentials", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
  for (const t of ["Stackcoding Technologies", "Nigeria Data Protection Act 2023", "sensitive personal data", "72 hours", "18 or over", "Nigeria Data Protection Commission"]) {
    await expect(page.getByText(t).first()).toBeVisible();
  }
  await page.goto("/terms");
  for (const t of ["Who can use Amah", "Acceptable use", "courts of Oyo State"]) await expect(page.getByText(t).first()).toBeVisible();
  await expect(page.getByText("To be written")).toHaveCount(0);
});
