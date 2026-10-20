import { expect, test } from "@playwright/test";
import { admin, cleanup, clientAs, makeUser, pairedRoom } from "./helpers";

/** After Dark safety rules, enforced by the database itself, exercised as the real users. */
test("after dark consent, PIN and fantasy privacy hold up against direct access", async () => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const eve = await makeUser("eve");
  try {
    const ca = await clientAs(a.email);
    const cb = await clientAs(b.email);
    const ce = await clientAs(eve.email);
    const now = new Date().toISOString();
    const unlocked = async () => (await ca.rpc("spicy_unlocked", { p_room: roomId })).data;

    // Opt-in is impossible without confirming 18+.
    const { error: noAge } = await cb.from("room_members").update({ spicy_opt_in: true }).eq("user_id", b.id);
    expect(noAge).not.toBeNull();

    // One key isn't enough.
    await ca.from("room_members").update({ age_confirmed_at: now, spicy_opt_in: true }).eq("user_id", a.id);
    expect(await unlocked()).toBe(false);
    const { error: earlyCard } = await ca.from("custom_cards").insert({ room_id: roomId, deck: "truth", heat: 1, text: "too early", created_by: a.id });
    expect(earlyCard).not.toBeNull();
    const { error: earlyPick } = await ca.from("fantasy_picks").insert({ room_id: roomId, user_id: a.id, item_id: "blindfold", pick: "yes" });
    expect(earlyPick).not.toBeNull();

    // Both keys: it opens.
    await cb.from("room_members").update({ age_confirmed_at: now, spicy_opt_in: true }).eq("user_id", b.id);
    expect(await unlocked()).toBe(true);

    // PIN: hashed, verifiable, not directly writable.
    expect((await ca.rpc("set_spicy_pin", { p_pin: "4821" })).error).toBeNull();
    expect((await ca.rpc("verify_spicy_pin", { p_pin: "0000" })).data).toBe(false);
    expect((await ca.rpc("verify_spicy_pin", { p_pin: "4821" })).data).toBe(true);
    const { data: stored } = await admin.from("room_members").select("pin_hash").eq("user_id", a.id).single();
    expect(stored!.pin_hash).not.toContain("4821");
    const { error: directPin } = await ca.from("room_members").update({ pin_hash: "x" }).eq("user_id", a.id);
    expect(directPin).not.toBeNull();
    expect((await cb.rpc("verify_spicy_pin", { p_pin: "4821" })).data).toBe(false); // per person: Bo has none

    // Fantasy picks: private, only mutual matches come back.
    const pick = (c: typeof ca, uid: string, item: string, p: string) => c.from("fantasy_picks").upsert({ room_id: roomId, user_id: uid, item_id: item, pick: p }, { onConflict: "room_id,user_id,item_id" });
    await pick(ca, a.id, "blindfold", "yes");
    await pick(ca, a.id, "bath", "maybe");
    await pick(ca, a.id, "mirror", "no");
    await pick(cb, b.id, "blindfold", "yes");
    await pick(cb, b.id, "bath", "yes");
    await pick(cb, b.id, "mirror", "yes");

    const { data: peek } = await cb.from("fantasy_picks").select("item_id, pick").eq("user_id", a.id);
    expect(peek).toEqual([]);
    const matches = async () => ((await cb.rpc("fantasy_matches", { p_room: roomId })).data as { item_id: string }[]).map((m) => m.item_id).sort();
    expect(await matches()).toEqual(["blindfold"]); // Ada's No on "mirror" is invisible; her Maybe needs both opted in

    await ca.from("room_members").update({ match_mode: "yes_maybe" }).eq("user_id", a.id);
    expect(await matches()).toEqual(["blindfold"]); // only one of them enabled Yes+Maybe
    await cb.from("room_members").update({ match_mode: "yes_maybe" }).eq("user_id", b.id);
    expect(await matches()).toEqual(["bath", "blindfold"]);

    await pick(ca, a.id, "blindfold", "no"); // un-saying a Yes: the match quietly disappears
    expect(await matches()).toEqual(["bath"]);

    const { data: prog } = await cb.rpc("fantasy_progress", { p_room: roomId });
    expect(prog![0]).toEqual({ mine: 3, partner: 3 }); // counts only, never content

    // A stranger gets nothing.
    expect((await ce.rpc("fantasy_matches", { p_room: roomId })).data).toEqual([]);
    expect((await ce.from("fantasy_picks").select("item_id")).data).toEqual([]);
    expect((await ce.from("custom_cards").select("id")).data).toEqual([]);

    // Opting out closes it for both again; picks become unreadable even to their owner.
    await cb.from("room_members").update({ spicy_opt_in: false }).eq("user_id", b.id);
    expect(await unlocked()).toBe(false);
    expect((await ca.from("fantasy_picks").select("item_id")).data).toEqual([]);
    expect((await ca.rpc("fantasy_matches", { p_room: roomId })).data).toEqual([]);
  } finally {
    await cleanup([a.id, b.id, eve.id]);
  }
});
