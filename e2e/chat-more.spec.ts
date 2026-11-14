import { writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { admin, cleanup, clientAs, friendRoom, onboardedUser, pairedRoom, signInPath } from "./helpers";

/**
 * The chat upgrade: reactions, replies, edits, delete for everyone, pinning, saving to Moments
 * and search (couples), plus @tags and polls (friend rooms). Only the sender can change a message.
 */
const openChat = async (p: Page) => {
  await p.getByRole("button", { name: /^(Chat with|Group chat)/ }).click();
  return p.getByRole("dialog", { name: /Chat with|group chat/ });
};
const say = async (chat: ReturnType<Page["getByRole"]>, text: string) => {
  await chat.getByLabel(/^Message /).fill(text);
  await chat.getByRole("button", { name: "Send" }).click();
};
// The first message with this text (a reply quoting it comes later in the list).
const bubble = (chat: ReturnType<Page["getByRole"]>, text: string) => chat.locator("li[id^=msg-]").filter({ hasText: text }).first();
const optionsFor = async (p: Page, chat: ReturnType<Page["getByRole"]>, text: string) => {
  await bubble(chat, text).locator("div.group").first().click({ button: "right" });
  return p.getByRole("dialog", { name: "Message options" });
};

test("couples: react, reply, edit, delete for everyone, pin, save to moments, search", async ({ browser }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const [ca, cb] = [await browser.newContext({ viewport: { width: 1280, height: 900 } }), await browser.newContext({ viewport: { width: 1280, height: 900 } })];
  const [pa, pb] = [await ca.newPage(), await cb.newPage()];
  try {
    await pa.goto(await signInPath(a.email, `/room/${roomId}`));
    await pb.goto(await signInPath(b.email, `/room/${roomId}`));
    const chatA = await openChat(pa);
    const chatB = await openChat(pb);
    await say(chatA, "Whot tonight?");
    await say(chatA, "Bring snacks");
    await expect(bubble(chatB, "Whot tonight?")).toBeVisible({ timeout: 15_000 });

    // Bo reacts with a heart; Ada sees it.
    const menuB = await optionsFor(pb, chatB, "Whot tonight?");
    await menuB.getByRole("button", { name: "React ❤️" }).click();
    await expect(bubble(chatA, "Whot tonight?").getByRole("button", { name: /❤️ from Bo/ })).toBeVisible({ timeout: 15_000 });

    // Bo replies to it; Ada sees the quote and can jump to the original.
    await (await optionsFor(pb, chatB, "Whot tonight?")).getByRole("button", { name: "Reply" }).click();
    await expect(chatB.getByText("Replying to Ada")).toBeVisible();
    await say(chatB, "Only if loser buys suya");
    const reply = bubble(chatA, "Only if loser buys suya");
    // On Ada's screen the original is her own, so it's "You".
    await expect(reply.getByRole("button", { name: /Replying to You: Whot tonight\?/ })).toBeVisible({ timeout: 15_000 });

    // Ada edits her own message; Bo sees the new words, marked edited.
    await (await optionsFor(pa, chatA, "Bring snacks")).getByRole("button", { name: "Edit" }).click();
    await expect(chatA.getByText("Editing your message")).toBeVisible();
    await chatA.getByLabel(/^Message /).fill("Bring chin chin");
    await chatA.getByRole("button", { name: "Send" }).click();
    await expect(bubble(chatB, "Bring chin chin")).toContainText("Edited", { timeout: 15_000 });
    // Bo can't edit or delete Ada's messages, whatever he sends.
    const { data: rows } = await admin.from("chat_messages").select("id, body").eq("room_id", roomId);
    const snacks = rows!.find((r) => r.body === "Bring chin chin")!;
    const asBo = await clientAs(b.email);
    expect((await asBo.rpc("chat_edit", { p_message: snacks.id, p_body: "hacked" })).error).not.toBeNull();
    expect((await asBo.rpc("chat_delete_for_all", { p_message: snacks.id })).error).not.toBeNull();
    expect((await asBo.from("chat_messages").update({ body: "hacked" }).eq("id", snacks.id).select()).data ?? []).toEqual([]);
    // After 15 minutes even Ada can't edit it.
    await admin.from("chat_messages").update({ created_at: new Date(Date.now() - 20 * 60_000).toISOString() }).eq("id", snacks.id);
    expect((await (await clientAs(a.email)).rpc("chat_edit", { p_message: snacks.id, p_body: "late" })).error?.message).toMatch(/too late/);

    // Pin it for both of them.
    await (await optionsFor(pa, chatA, "Whot tonight?")).getByRole("button", { name: "Pin for both of you" }).click();
    await expect.poll(async () => (await admin.from("rooms").select("pinned_message_id").eq("id", roomId).single()).data?.pinned_message_id, { timeout: 10_000 }).toBeTruthy();
    await expect(chatA.getByRole("button", { name: /Pinned: Whot tonight\?/ })).toBeVisible({ timeout: 20_000 });
    await expect(chatB.getByRole("button", { name: /Pinned: Whot tonight\?/ })).toBeVisible({ timeout: 20_000 });

    // Save one to their moments.
    await (await optionsFor(pb, chatB, "Only if loser buys suya")).getByRole("button", { name: "Save to our moments" }).click();
    await expect(pb.getByText("Saved to your moments.")).toBeVisible();

    // Delete for everyone: the words go, the place stays.
    await say(chatA, "oops wrong chat");
    await expect(bubble(chatB, "oops wrong chat")).toBeVisible({ timeout: 15_000 });
    await (await optionsFor(pa, chatA, "oops wrong chat")).getByRole("button", { name: "Delete for everyone" }).click();
    await expect(chatB.getByText("This message was deleted", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(chatB.getByText("oops wrong chat")).toHaveCount(0);

    // Search.
    await chatB.getByRole("button", { name: "Search the chat" }).click();
    await chatB.getByLabel("Search messages").fill("suya");
    await expect(chatB.getByRole("list", { name: "Search results" }).getByRole("button", { name: /suya/ })).toBeVisible();
    if (process.env.SHOTS_DIR) writeFileSync(`${process.env.SHOTS_DIR}/chat-more.png`, await pb.screenshot());

    // The saved message shows in Recent moments on the home screen.
    await pa.goto(`/room/${roomId}`);
    await expect(pa.getByRole("region", { name: "Recent moments" })).toContainText("Bo saved a message: “Only if loser buys suya”");
  } finally {
    await cleanup([a.id, b.id]);
    await ca.close();
    await cb.close();
  }
});

test("friend rooms: tag someone with @, and settle it with a poll", async ({ browser }) => {
  const [o, f1, f2] = await Promise.all([onboardedUser("Chidi"), onboardedUser("Funke"), onboardedUser("Musa")]);
  const room = await friendRoom(o, [f1, f2]);
  const [co, cf] = [await browser.newContext(), await browser.newContext()];
  const [po, pf] = [await co.newPage(), await cf.newPage()];
  try {
    await po.goto(await signInPath(o.email, `/room/${room.id}`));
    await pf.goto(await signInPath(f1.email, `/room/${room.id}`));
    const chatO = await openChat(po);
    const chatF = await openChat(pf);

    // @tag: suggestions as you type, the tag highlighted, and saved as a mention.
    await chatO.getByLabel(/^Message /).fill("you dey come? @Fu");
    await chatO.getByRole("list", { name: "Tag someone" }).getByRole("button", { name: "Funke" }).click();
    await expect(chatO.getByLabel(/^Message /)).toHaveValue("you dey come? @Funke ");
    await chatO.getByRole("button", { name: "Send" }).click();
    await expect(bubble(chatF, "you dey come?").locator("b", { hasText: "@Funke" })).toBeVisible({ timeout: 15_000 });
    const { data: tagged } = await admin.from("chat_messages").select("mentions").eq("room_id", room.id).ilike("body", "%you dey come%").single();
    expect(tagged!.mentions).toEqual([f1.id]);

    // A poll: Funke votes, Chidi sees the count.
    await chatO.getByRole("button", { name: "Make a poll" }).click();
    const maker = po.getByRole("dialog", { name: "A poll" });
    await maker.getByLabel("Question").fill("Who buys suya?");
    await maker.getByLabel("Option 1").fill("Loser");
    await maker.getByLabel("Option 2").fill("Musa, as usual");
    await maker.getByRole("button", { name: "Send poll" }).click();
    const pollF = chatF.getByRole("radiogroup", { name: "Who buys suya?" });
    await expect(pollF).toBeVisible({ timeout: 15_000 });
    await pollF.getByRole("radio", { name: /Musa, as usual/ }).click();
    await expect(chatO.getByRole("radiogroup", { name: "Who buys suya?" }).getByRole("radio", { name: /Musa, as usual/ })).toContainText("1", { timeout: 15_000 });
    await expect(chatO.getByText("1 of 3 voted", { exact: false })).toBeVisible();
    // Polls are for friend rooms only, and votes can't go to options that don't exist.
    const { data: poll } = await admin.from("chat_messages").select("id").eq("room_id", room.id).eq("kind", "poll").single();
    expect((await f2.c.rpc("chat_vote", { p_message: poll!.id, p_option: 7 })).error).not.toBeNull();
  } finally {
    await cleanup([o.id, f1.id, f2.id]);
    await co.close();
    await cf.close();
  }
});
