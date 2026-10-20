import { expect, test } from "@playwright/test";
import { admin, cleanup, clientAs, makeUser, pairedRoom, signInPath } from "./helpers";

const SHOTS = process.env.SHOTS_DIR;
const shot = async (page: import("@playwright/test").Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
};

/** Chat is room-scoped at the database: outsiders can't read or write, nobody can impersonate. */
test("chat messages stay inside the room", async () => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const eve = await makeUser("eve");
  try {
    const ca = await clientAs(a.email);
    const cb = await clientAs(b.email);
    const ce = await clientAs(eve.email);

    expect((await ca.from("chat_messages").insert({ room_id: roomId, sender_id: a.id, body: "hello you" })).error).toBeNull();
    expect((await ca.from("chat_messages").insert({ room_id: roomId, sender_id: b.id, body: "pretending" })).error).not.toBeNull();
    expect((await ce.from("chat_messages").insert({ room_id: roomId, sender_id: eve.id, body: "let me in" })).error).not.toBeNull();

    const { data: forB } = await cb.from("chat_messages").select("body");
    expect(forB!.map((m) => m.body)).toEqual(["hello you"]);
    const { data: forEve } = await ce.from("chat_messages").select("body");
    expect(forEve).toEqual([]);

    // Read marks: only through the function, only for your own room.
    expect((await cb.rpc("mark_chat_read", { p_room: roomId })).error).toBeNull();
    expect((await ce.rpc("mark_chat_read", { p_room: roomId })).error).not.toBeNull();
    expect((await cb.from("chat_reads").insert({ room_id: roomId, user_id: b.id })).error).not.toBeNull();
    const { data: reads } = await ca.from("chat_reads").select("user_id");
    expect(reads!.map((r) => r.user_id)).toEqual([b.id]);
  } finally {
    await cleanup([a.id, b.id, eve.id]);
  }
});

/** Two real browsers: one on the room page, one mid-game. */
test("chat delivers live, with unread badge, typing and seen", async ({ browser }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const ctxA = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const ctxB = await browser.newContext({ viewport: { width: 400, height: 860 } });
  const pa = await ctxA.newPage();
  const pb = await ctxB.newPage();
  const errors: string[] = [];
  for (const p of [pa, pb]) p.on("pageerror", (e) => errors.push(e.message));

  try {
    await pa.goto(await signInPath(a.email, `/room/${roomId}`));
    await pb.goto(await signInPath(b.email, `/room/${roomId}/games/love-notes`));
    await expect(pa.getByRole("button", { name: "Chat with Bo" })).toBeVisible();
    await expect(pb.getByRole("button", { name: "Chat with Ada" })).toBeVisible();
    await pa.waitForTimeout(1500); // let both realtime channels join

    await pa.getByRole("button", { name: "Chat with Bo" }).click();
    const input = pa.getByLabel("Message Bo");
    await input.pressSequentially("thinking about you");
    await input.press("Enter");

    // Bo: a preview bubble and an unread badge, without opening anything.
    await expect(pb.getByText("thinking about you")).toBeVisible({ timeout: 5000 });
    await expect(pb.getByRole("button", { name: "Chat with Ada, 1 unread" })).toBeVisible();
    await shot(pb, "chat-preview");

    await pb.getByRole("button", { name: /Chat with Ada/ }).click();
    const dialog = pb.getByRole("dialog", { name: "Chat with Ada" });
    await expect(dialog.getByText("thinking about you")).toBeVisible();
    await expect(pb.getByRole("button", { name: "Chat with Ada" })).toBeVisible(); // badge cleared

    // Ada sees "Seen" once Bo has read it.
    await expect(pa.getByText(/· Seen/)).toBeVisible({ timeout: 5000 });

    // Typing indicator, then a multi-line reply.
    const reply = pb.getByLabel("Message Ada");
    await reply.pressSequentially("same");
    await expect(pa.getByText("typing…")).toBeVisible({ timeout: 5000 });
    await reply.press("Shift+Enter");
    await reply.pressSequentially("come home soon");
    await reply.press("Enter");
    await expect(pa.getByRole("dialog").getByText(/same\s+come home soon/)).toBeVisible({ timeout: 5000 });
    await shot(pa, "chat-desktop");
    await shot(pb, "chat-mobile");

    // History survives a reload, and Escape closes the panel.
    await pb.reload();
    await pb.getByRole("button", { name: /Chat with Ada/ }).click();
    await expect(pb.getByRole("dialog").getByText("thinking about you")).toBeVisible();
    await pb.keyboard.press("Escape");
    await expect(pb.getByRole("dialog")).toHaveCount(0);

    expect(errors).toEqual([]);
  } finally {
    await ctxA.close();
    await ctxB.close();
    await cleanup([a.id, b.id]);
  }
});

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==", "base64");

/** Voice notes and stickers: files and rows stay inside the room; the starter pack is read-only. */
test("chat media stays inside the room", async () => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const other = await pairedRoom(["Cy", "Di"]);
  const eve = await makeUser("eve");
  try {
    const ca = await clientAs(a.email);
    const cb = await clientAs(b.email);
    const ce = await clientAs(eve.email);
    const voice = (path: string) => ({ room_id: roomId, sender_id: a.id, kind: "voice", media: { path, duration: 2, mime: "audio/webm", peaks: [0.2, 0.8] } });

    // Files: members of the room only, and only in the voice/stickers folders.
    const own = `${roomId}/voice/e2e-${Date.now()}.webm`;
    expect((await ca.storage.from("chat-media").upload(own, PNG, { contentType: "audio/webm" })).error).toBeNull();
    expect((await cb.storage.from("chat-media").download(own)).error).toBeNull();
    expect((await ce.storage.from("chat-media").download(own)).error).not.toBeNull();
    expect((await ce.storage.from("chat-media").upload(`${roomId}/voice/eve.webm`, PNG, { contentType: "audio/webm" })).error).not.toBeNull();
    expect((await ca.storage.from("chat-media").upload(`${roomId}/elsewhere/x.webm`, PNG, { contentType: "audio/webm" })).error).not.toBeNull();

    // Rows: a voice note must point into this room's folder.
    expect((await ca.from("chat_messages").insert(voice(own))).error).toBeNull();
    expect((await ca.from("chat_messages").insert(voice(`${other.roomId}/voice/x.webm`))).error).not.toBeNull();
    expect((await ca.from("chat_messages").insert({ ...voice(own), body: "both" })).error).not.toBeNull();

    // Stickers: couples add to their own room; nobody but the service role touches the starter pack.
    expect((await ca.from("stickers").insert({ room_id: roomId, path: `${roomId}/stickers/a.png`, created_by: a.id })).error).toBeNull();
    expect((await ca.from("stickers").insert({ room_id: null, path: "starter/sneaky.png", created_by: a.id })).error).not.toBeNull();
    expect((await ca.from("stickers").insert({ room_id: other.roomId, path: `${other.roomId}/stickers/b.png`, created_by: a.id })).error).not.toBeNull();
    const { data: eveSees } = await ce.from("stickers").select("path").not("room_id", "is", null);
    expect(eveSees).toEqual([]);
  } finally {
    await cleanup([a.id, b.id, other.a.id, other.b.id, eve.id]);
  }
});

test("stickers and voice notes, in two browsers", async ({ browser }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const starterPath = `starter/e2e-${Date.now()}.png`;
  await admin.storage.from("stickers").upload(starterPath, PNG, { contentType: "image/png" });
  const { data: starter } = await admin.from("stickers").insert({ room_id: null, path: starterPath }).select("id").single();
  const ctxA = await browser.newContext({ viewport: { width: 1200, height: 900 }, permissions: ["microphone"] });
  const ctxB = await browser.newContext({ viewport: { width: 400, height: 860 } });
  const pa = await ctxA.newPage();
  const pb = await ctxB.newPage();
  const errors: string[] = [];
  for (const p of [pa, pb]) p.on("pageerror", (e) => errors.push(e.message));

  try {
    await pa.goto(await signInPath(a.email, `/room/${roomId}`));
    await pb.goto(await signInPath(b.email, `/room/${roomId}`));
    await expect(pb.getByRole("button", { name: "Chat with Ada" })).toBeVisible();
    await pa.getByRole("button", { name: "Chat with Bo" }).click();
    await pa.waitForTimeout(1000);

    // The starter pack is there for everyone.
    await pa.getByRole("button", { name: "Stickers" }).click();
    await pa.getByRole("tab", { name: "Starter pack" }).click();
    await expect(pa.getByRole("button", { name: /Send sticker/ }).first()).toBeVisible();

    // Make our own sticker from a picture, then send it.
    await pa.getByRole("tab", { name: "Ours" }).click();
    await pa.locator('input[type="file"]').setInputFiles({ name: "us.png", mimeType: "image/png", buffer: PNG });
    await expect(pa.getByRole("button", { name: "Send sticker 1" })).toBeVisible();
    await pa.getByRole("button", { name: "Send sticker 1" }).click();
    await expect(pb.getByText("Sticker", { exact: true }).first()).toBeVisible({ timeout: 8000 });
    await shot(pa, "chat-stickers");

    // Record a voice note with the fake microphone.
    await pa.getByRole("button", { name: "Close stickers" }).click();
    await pa.getByRole("button", { name: "Record a voice message" }).click();
    await expect(pa.getByRole("group", { name: "Recording a voice message" })).toBeVisible();
    await pa.waitForTimeout(2200);
    await shot(pa, "chat-recording");
    await pa.getByRole("button", { name: "Send voice message" }).click();
    await expect(pa.getByRole("button", { name: /Play voice message, 0:0[23]/ })).toBeVisible();

    // Bo gets both and can play the voice note.
    await pb.getByRole("button", { name: /Chat with Ada/ }).click();
    const dialog = pb.getByRole("dialog", { name: "Chat with Ada" });
    await expect(dialog.getByRole("img", { name: "Sticker" })).toBeVisible();
    const play = dialog.getByRole("button", { name: /Play voice message/ });
    await expect(play).toBeVisible({ timeout: 8000 });
    await play.click();
    await expect(dialog.getByRole("button", { name: "Pause voice message" })).toBeVisible();
    await expect(dialog.getByText("Couldn't play")).toHaveCount(0);
    await shot(pb, "chat-voice");

    expect(errors).toEqual([]);
  } finally {
    await ctxA.close();
    await ctxB.close();
    await admin.from("stickers").delete().eq("id", starter!.id);
    await admin.storage.from("stickers").remove([starterPath]);
    await cleanup([a.id, b.id]);
  }
});
