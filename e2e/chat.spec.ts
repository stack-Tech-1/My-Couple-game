import { expect, test } from "@playwright/test";
import { cleanup, clientAs, makeUser, pairedRoom, signInPath } from "./helpers";

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
