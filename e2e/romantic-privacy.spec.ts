import { expect, test } from "@playwright/test";
import { admin, cleanup, clientAs, makeUser, pairedRoom } from "./helpers";

/** Database-level privacy for Love Notes, Memory Lane and the bucket list, as the real users. */
test("sealed notes, private photos and room-scoped lists hold up against direct access", async () => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const eve = await makeUser("eve");
  try {
    const ca = await clientAs(a.email);
    const cb = await clientAs(b.email);
    const ce = await clientAs(eve.email);
    const future = new Date(Date.now() + 7 * 86_400_000).toISOString();

    // --- Love notes
    const { error: e1 } = await ca.from("love_notes").insert({ room_id: roomId, author_id: a.id, recipient_id: b.id, body: "Open me on Sunday", unlock_at: future });
    expect(e1).toBeNull();
    await ca.from("love_notes").insert({ room_id: roomId, author_id: a.id, recipient_id: b.id, body: "Read me now" });

    const { data: visible } = await cb.from("love_notes").select("body");
    expect(visible!.map((n) => n.body)).toEqual(["Read me now"]);
    const { data: sealed } = await cb.rpc("sealed_notes");
    expect(sealed).toHaveLength(1);
    expect(JSON.stringify(sealed)).not.toContain("Sunday");
    const sealedId = (sealed as { id: string }[])[0]!.id;
    const { error: early } = await cb.rpc("open_note", { p_id: sealedId });
    expect(early).not.toBeNull();

    // Can't write to someone outside the room, or impersonate the author.
    const { error: toEve } = await ca.from("love_notes").insert({ room_id: roomId, author_id: a.id, recipient_id: eve.id, body: "hi" });
    expect(toEve).not.toBeNull();
    const { error: forged } = await cb.from("love_notes").insert({ room_id: roomId, author_id: a.id, recipient_id: b.id, body: "fake" });
    expect(forged).not.toBeNull();
    const { data: eveSees } = await ce.from("love_notes").select("id");
    expect(eveSees).toEqual([]);

    // --- Memory Lane storage: room members only
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    const path = `${roomId}/test.png`;
    const { error: up } = await ca.storage.from("memories").upload(path, png, { contentType: "image/png" });
    expect(up).toBeNull();
    const { error: eveUp } = await ce.storage.from("memories").upload(`${roomId}/evil.png`, png, { contentType: "image/png" });
    expect(eveUp).not.toBeNull();
    const { data: bSigned } = await cb.storage.from("memories").createSignedUrl(path, 60);
    expect(bSigned?.signedUrl).toBeTruthy();
    const { data: eSigned } = await ce.storage.from("memories").createSignedUrl(path, 60);
    expect(eSigned?.signedUrl ?? null).toBeNull();

    const { data: mem, error: memErr } = await ca.from("memories").insert({ room_id: roomId, author_id: a.id, path, prompt: "Where were we here?" }).select("id").single();
    expect(memErr).toBeNull();
    const { error: selfAnswer } = await ca.rpc("answer_memory", { p_id: mem!.id, p_answer: "I know!" });
    expect(selfAnswer).not.toBeNull();
    const { error: partnerAnswer } = await cb.rpc("answer_memory", { p_id: mem!.id, p_answer: "Lisbon, the tram" });
    expect(partnerAnswer).toBeNull();
    const { data: eveMem } = await ce.from("memories").select("id");
    expect(eveMem).toEqual([]);

    // --- Bucket list
    const { error: bErr } = await cb.from("bucket_items").insert({ room_id: roomId, title: "See the northern lights", created_by: b.id });
    expect(bErr).toBeNull();
    const { error: eveAdd } = await ce.from("bucket_items").insert({ room_id: roomId, title: "intrude", created_by: eve.id });
    expect(eveAdd).not.toBeNull();
    const { data: item } = await ca.from("bucket_items").select("id").single();
    await ca.from("bucket_items").update({ done_at: new Date().toISOString(), done_by: a.id }).eq("id", item!.id);
    const { data: moments } = await admin.from("moments").select("kind").eq("room_id", roomId);
    expect(moments!.map((m) => m.kind)).toEqual(expect.arrayContaining(["note_sealed", "note_sent", "memory_answered", "bucket_done"]));

    await admin.storage.from("memories").remove([path]);
  } finally {
    await cleanup([a.id, b.id, eve.id]);
  }
});
