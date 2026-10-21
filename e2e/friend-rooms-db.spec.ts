import { expect, test } from "@playwright/test";
import { admin, cleanup, friendRoom, onboardedUser } from "./helpers";

/**
 * Friend rooms at the database: limits, owner powers, and the couple/friend boundary.
 * No browser needed (E2E_NO_SERVER=1).
 */
test("friend rooms: limits, owner powers, and couple-only things stay in couple rooms", async () => {
  test.setTimeout(240_000);
  const ada = await onboardedUser("Ada");
  const bo = await onboardedUser("Bo");
  const cy = await onboardedUser("Cy");
  const di = await onboardedUser("Di");
  const ids = [ada.id, bo.id, cy.id, di.id];
  const extra: string[] = [];

  try {
    // Ada and Bo are a couple; Ada, Bo and Cy share a friend room. Di is outside it.
    const { data: couple } = await ada.c.rpc("create_room", { room_name: "Us" });
    await bo.c.rpc("join_room", { code: couple.invite_code });
    const crew = await friendRoom(ada, [bo, cy]);

    // A second couple room is refused, both ways in.
    const second = await ada.c.rpc("create_room", { room_name: "Again" });
    expect(second.error?.message).toContain("already in a couple room");
    const { data: diCouple } = await di.c.rpc("create_room", {});
    expect((await ada.c.rpc("join_room", { code: diCouple.invite_code })).error?.message).toContain("already in a couple room");

    // Friend rooms keep their invite code after people join; couple rooms retire theirs.
    const { data: rooms } = await admin.from("rooms").select("id, kind, invite_code, owner_id").in("id", [couple.id, crew.id]);
    const byId = Object.fromEntries((rooms ?? []).map((r) => [r.id, r]));
    expect(byId[couple.id]).toMatchObject({ kind: "couple", invite_code: null });
    expect(byId[crew.id]).toMatchObject({ kind: "friends", invite_code: crew.invite_code, owner_id: ada.id });

    // Peek shows kind and headcount.
    const { data: peek } = await di.c.rpc("peek_invite", { code: crew.invite_code });
    expect(peek[0]).toMatchObject({ kind: "friends", member_count: 3, is_full: false });

    // Profiles: Cy can see Ada and Bo (shared friend room); Di can't see Cy.
    expect((await cy.c.from("profiles").select("id").in("id", [ada.id, bo.id])).data).toHaveLength(2);
    expect((await di.c.from("profiles").select("id").eq("id", cy.id)).data).toHaveLength(0);

    // Couple-only data is refused in a friend room, even straight at the database.
    const love = await ada.c.from("love_notes").insert({ room_id: crew.id, author_id: ada.id, recipient_id: bo.id, body: "hi" });
    expect(love.error?.message).toContain("only in a couple room");
    const mood = await ada.c.from("moods").insert({ room_id: crew.id, user_id: ada.id, mood: "happy" });
    expect(mood.error?.message).toContain("only in a couple room");
    expect((await ada.c.from("nudges").insert({ room_id: crew.id, from_user: ada.id })).error?.message).toContain("only in a couple room");

    // After Dark never unlocks in a friend room, even if every member opts in.
    for (const p of [ada, bo, cy]) {
      await p.c.from("room_members").update({ age_confirmed_at: new Date().toISOString(), spicy_opt_in: true }).eq("room_id", crew.id).eq("user_id", p.id);
    }
    expect((await ada.c.rpc("spicy_unlocked", { p_room: crew.id })).data).toBe(false);
    expect((await ada.c.from("custom_cards").insert({ room_id: crew.id, deck: "truth", heat: 1, text: "hello there", created_by: ada.id })).error).toBeTruthy(); // RLS: not unlocked

    // Only the owner renames, resets the code, removes people or hands over the room.
    expect((await bo.c.from("rooms").update({ name: "Bo's crew" }).eq("id", crew.id)).error?.message).toContain("only the owner");
    expect((await bo.c.rpc("regenerate_invite", { p_room: crew.id })).error?.message).toContain("only the owner");
    expect((await bo.c.rpc("kick_room_member", { p_room: crew.id, p_user: cy.id })).error?.message).toContain("only the owner");
    expect((await ada.c.from("rooms").update({ name: "Renamed" }).eq("id", crew.id)).error).toBeNull();
    const fresh = await ada.c.rpc("regenerate_invite", { p_room: crew.id });
    expect(fresh.data).toMatch(/^[A-Z2-9]{6}$/);

    // The owner removes Cy; Cy loses access straight away.
    expect((await ada.c.rpc("kick_room_member", { p_room: crew.id, p_user: cy.id })).error).toBeNull();
    expect((await cy.c.from("rooms").select("id").eq("id", crew.id)).data).toHaveLength(0);
    await cy.c.rpc("join_room", { code: fresh.data });

    // Owner leaves without choosing: the longest-standing member (Bo) takes over.
    await ada.c.rpc("leave_room", { p_room: crew.id });
    expect((await admin.from("rooms").select("owner_id").eq("id", crew.id).single()).data!.owner_id).toBe(bo.id);
    // Owner leaves and picks someone: that person takes over.
    await ada.c.rpc("join_room", { code: fresh.data });
    await bo.c.rpc("leave_room", { p_room: crew.id, p_next_owner: ada.id });
    expect((await admin.from("rooms").select("owner_id").eq("id", crew.id).single()).data!.owner_id).toBe(ada.id);
    // Hand over without leaving.
    expect((await ada.c.rpc("transfer_room_owner", { p_room: crew.id, p_user: cy.id })).error).toBeNull();
    expect((await admin.from("rooms").select("owner_id").eq("id", crew.id).single()).data!.owner_id).toBe(cy.id);

    // Leaving a friend room never touches the couple room.
    expect((await admin.from("room_members").select("user_id").eq("room_id", couple.id)).data).toHaveLength(2);

    // Reporting someone in a friend room names them; blocking hides them without anyone leaving.
    const rep = await ada.c.rpc("file_report", { p_reason: "spam", p_room: crew.id, p_reported: cy.id });
    expect(rep.error).toBeNull();
    expect((await ada.c.rpc("block_member", { p_user: cy.id })).error).toBeNull();
    expect((await admin.from("room_members").select("user_id").eq("room_id", crew.id)).data).toHaveLength(2);
    await ada.c.rpc("unblock_member", { p_user: cy.id });

    // Five friend rooms at most per person.
    for (let i = 0; i < 4; i++) {
      const { data, error } = await di.c.rpc("create_room", { room_name: `Crew ${i}`, p_kind: "friends" });
      expect(error).toBeNull();
      extra.push(data.id);
    }
    expect((await di.c.rpc("join_room", { code: fresh.data })).error).toBeNull(); // fifth
    const sixth = await di.c.rpc("create_room", { room_name: "One too many", p_kind: "friends" });
    expect(sixth.error?.message).toContain("friend room limit");

    // Eight people at most per friend room.
    const crowd = await Promise.all(Array.from({ length: 5 }, (_, i) => onboardedUser(`P${i}`)));
    ids.push(...crowd.map((p) => p.id));
    const big = await friendRoom(crowd[0]!, crowd.slice(1)); // 5
    for (const p of [ada, bo, cy]) expect((await p.c.rpc("join_room", { code: big.invite_code })).error).toBeNull(); // 8
    expect((await di.c.rpc("leave_room", { p_room: crew.id })).error).toBeNull();
    expect((await di.c.rpc("join_room", { code: big.invite_code })).error?.message).toContain("room is full");
  } finally {
    await cleanup(ids);
  }
});
