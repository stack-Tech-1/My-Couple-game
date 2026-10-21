import { expect, test, type Page } from "@playwright/test";
import { admin, cleanup, onboardedUser, pairedRoom, signInPath } from "./helpers";

/**
 * Friend rooms in three browsers: Ada (who also has a couple room with Bo) starts a friend room,
 * Bo and Cy join by link. Switcher, group chat, a targeted game invite, owner controls.
 */
test("friend rooms: start, join, switch, group chat, invite one friend, owner removes someone", async ({ browser }) => {
  test.setTimeout(300_000);
  const { a, b, roomId: coupleId } = await pairedRoom(["Ada", "Bo"]);
  const cy = await onboardedUser("Cy", "moon");
  const ctx = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext()]);
  const [pa, pb, pc] = (await Promise.all(ctx.map((c) => c.newPage()))) as [Page, Page, Page];
  const errors: string[] = [];
  for (const p of [pa, pb, pc] as Page[]) p.on("pageerror", (e) => errors.push(e.message));

  try {
    // Ada: one room, so no switcher yet. The way in is Settings → Your rooms.
    await pa.goto(await signInPath(a.email, `/room/${coupleId}/settings`));
    await expect(pa.getByRole("button", { name: /switch room/ })).toHaveCount(0);
    await pa.getByRole("link", { name: /Start or join a friend room/ }).click();
    await expect(pa).toHaveURL(/\/room\/new$/);
    // A second couple room isn't offered.
    await expect(pa.getByRole("radio", { name: /A couple room/ })).toBeDisabled();
    await pa.getByRole("radio", { name: /A friend room/ }).click();
    await pa.getByLabel("Room name").fill("The Crew");
    await pa.getByRole("button", { name: "Open the room" }).click();
    await expect(pa.getByRole("heading", { level: 1, name: "The Crew" })).toBeVisible();
    const crewId = pa.url().split("/room/")[1]!.split(/[/?#]/)[0]!;
    const { data: crew } = await admin.from("rooms").select("kind, invite_code, owner_id").eq("id", crewId).single();
    expect(crew).toMatchObject({ kind: "friends", owner_id: a.id });
    await expect(pa.getByRole("heading", { name: "Bring your people." })).toBeVisible();

    // The friend library: friend games only, no After Dark, no couple features.
    await expect(pa.getByRole("link", { name: /Whot/ }).first()).toBeVisible();
    await expect(pa.getByText(/After dark/i)).toHaveCount(0);
    await expect(pa.getByRole("link", { name: /Love Notes/ })).toHaveCount(0);

    // Bo (already in a couple room) and Cy join by link.
    await pb.goto(await signInPath(b.email, `/join/${crew!.invite_code}`));
    await expect(pb.getByText(/A friend room · 1 person so far/)).toBeVisible();
    await pb.getByRole("button", { name: "Take the seat" }).click();
    await expect(pb.getByRole("heading", { level: 1, name: "The Crew" })).toBeVisible();
    await pc.goto(await signInPath(cy.email, `/join/${crew!.invite_code}`));
    await pc.getByRole("button", { name: "Take the seat" }).click();
    await expect(pc.getByRole("heading", { level: 1, name: "The Crew" })).toBeVisible();
    // Non-owners don't get the invite card.
    await expect(pc.getByRole("heading", { name: "Bring your people." })).toHaveCount(0);

    // Ada now has two rooms: the switcher lists both.
    await pa.reload();
    await pa.getByRole("button", { name: /switch room/ }).click();
    const menu = pa.getByRole("menu", { name: "Your rooms" });
    await expect(menu.getByRole("menuitem", { name: /E2E.*Couple room/ })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /The Crew.*3 people/ })).toBeVisible();
    await pa.keyboard.press("Escape");

    // Group chat: Cy writes; Ada sees it with Cy's name.
    await pc.getByRole("button", { name: /Group chat/ }).click();
    await pc.getByRole("textbox").last().fill("hello crew");
    await pc.keyboard.press("Enter");
    await pa.getByRole("button", { name: /Group chat/ }).click();
    const panel = pa.getByRole("dialog", { name: "The Crew group chat" });
    await expect(panel.getByText("hello crew")).toBeVisible();
    await expect(panel.getByText("Cy", { exact: true })).toBeVisible();
    await panel.getByRole("button", { name: "Close chat" }).click();

    // Ada challenges Cy to Connect Four: Cy gets the invite, Bo doesn't.
    await pa.goto(`/room/${crewId}/games/connect-four`);
    await pa.getByRole("radio", { name: "Cy" }).click();
    await pa.getByRole("button", { name: "Invite Cy" }).click();
    await expect(pa).toHaveURL(/\/play\//);
    const sessionId = pa.url().split("/play/")[1]!;
    await pc.getByRole("button", { name: "Join" }).click();
    await expect(pc).toHaveURL(new RegExp(sessionId));
    await pb.waitForTimeout(1500);
    await expect(pb.getByRole("button", { name: "Join" })).toHaveCount(0);
    const { data: sess } = await admin.from("game_sessions").select("room_id, players").eq("id", sessionId).single();
    expect(sess).toMatchObject({ room_id: crewId, players: [a.id, cy.id] });

    // A couple-only page in a friend room just goes back to the room.
    await pb.goto(`/room/${crewId}/after-dark`);
    await expect(pb).toHaveURL(new RegExp(`/room/${crewId}$`));

    // Owner removes Bo from the friend room; Bo's couple room is untouched.
    await pa.goto(`/room/${crewId}/settings`);
    const bo = pa.getByRole("listitem").filter({ hasText: "Bo" });
    await bo.getByRole("button", { name: "Remove" }).click();
    await pa.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
    await expect(pa.getByText("Bo has been removed.")).toBeVisible();
    expect((await admin.from("room_members").select("user_id").eq("room_id", crewId)).data).toHaveLength(2);
    expect((await admin.from("room_members").select("user_id").eq("room_id", coupleId)).data).toHaveLength(2);

    // Ada leaves and hands the room to Cy.
    await pa.getByRole("button", { name: "Leave this room" }).click();
    await pa.getByLabel("New owner").selectOption({ label: "Cy" });
    await pa.getByRole("dialog").getByRole("button", { name: "Leave" }).click();
    await expect(pa).toHaveURL(new RegExp(`/room/${coupleId}`));
    expect((await admin.from("rooms").select("owner_id").eq("id", crewId).single()).data!.owner_id).toBe(cy.id);
    expect(errors).toEqual([]);
  } finally {
    await cleanup([a.id, b.id, cy.id]);
    await Promise.all(ctx.map((c) => c.close()));
  }
});
