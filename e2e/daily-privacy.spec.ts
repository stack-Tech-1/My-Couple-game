import { expect, test } from "@playwright/test";
import { admin, cleanup, clientAs, makeUser, pairedRoom } from "./helpers";

/** Database-level privacy for Daily Question, exercised as the real users (RLS, not app code). */
test("daily answers stay sealed until both partners answer", async () => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const stranger = await makeUser("eve");
  try {
    const ca = await clientAs(a.email);
    const cb = await clientAs(b.email);
    const ce = await clientAs(stranger.email);
    const day = new Date().toISOString().slice(0, 10);

    const { error: insA } = await ca.from("daily_answers").insert({ room_id: roomId, day, user_id: a.id, question: "Q?", answer: "Ada's secret" });
    expect(insA).toBeNull();

    // Bo can't see Ada's answer yet, but can see that she answered.
    const { data: early } = await cb.from("daily_answers").select("answer").eq("room_id", roomId);
    expect(early).toEqual([]);
    const { data: status } = await cb.rpc("daily_status", { p_room: roomId });
    expect(status![0]).toMatchObject({ mine: false, partner: true, streak: 0 });

    // Nobody can answer for someone else, for another day, or edit/delete.
    const { error: forge } = await cb.from("daily_answers").insert({ room_id: roomId, day, user_id: a.id, question: "Q?", answer: "forged" });
    expect(forge).not.toBeNull();
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const { error: backdate } = await cb.from("daily_answers").insert({ room_id: roomId, day: yesterday, user_id: b.id, question: "Q?", answer: "late" });
    expect(backdate).not.toBeNull();
    await ca.from("daily_answers").update({ answer: "edited" }).eq("user_id", a.id);
    await ca.from("daily_answers").delete().eq("user_id", a.id);
    const { data: still } = await admin.from("daily_answers").select("answer").eq("user_id", a.id).single();
    expect(still!.answer).toBe("Ada's secret");

    // Bo answers: now both see both, and the streak starts.
    const { error: insB } = await cb.from("daily_answers").insert({ room_id: roomId, day, user_id: b.id, question: "Q?", answer: "Bo's secret" });
    expect(insB).toBeNull();
    const { data: both } = await cb.from("daily_answers").select("answer").eq("room_id", roomId).order("answer");
    expect(both!.map((r) => r.answer)).toEqual(["Ada's secret", "Bo's secret"]);
    const { data: after } = await ca.rpc("daily_status", { p_room: roomId });
    expect(after![0]).toMatchObject({ mine: true, partner: true, streak: 1 });

    // A stranger sees nothing and can't query the status.
    const { data: leak } = await ce.from("daily_answers").select("answer");
    expect(leak).toEqual([]);
    const { error: statusErr } = await ce.rpc("daily_status", { p_room: roomId });
    expect(statusErr).not.toBeNull();

    // The "both answered" moment landed on the timeline.
    const { data: moments } = await admin.from("moments").select("kind").eq("room_id", roomId);
    expect(moments!.map((m) => m.kind)).toContain("daily_both");
  } finally {
    await cleanup([a.id, b.id, stranger.id]);
  }
});