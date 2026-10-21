import { expect, test } from "@playwright/test";
import { admin, cleanup, clientAs, makeUser, pairedRoom, signInPath } from "./helpers";

const today = () => new Date().toISOString().slice(0, 10);
const shift = (days: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

test("moods, countdowns and challenges stay in the room, and future days stay locked", async () => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const eve = await makeUser("eve");
  try {
    const ca = await clientAs(a.email);
    const cb = await clientAs(b.email);
    const ce = await clientAs(eve.email);
    expect((await ca.from("moods").insert({ room_id: roomId, user_id: a.id, mood: "happy" })).error).toBeNull();
    expect((await ca.from("moods").insert({ room_id: roomId, user_id: b.id, mood: "sad" })).error).not.toBeNull();
    expect((await cb.from("moods").select("mood")).data).toEqual([{ mood: "happy" }]);
    expect((await ce.from("moods").select("mood")).data).toEqual([]);
    expect((await ce.from("countdowns").insert({ room_id: roomId, title: "x", on_date: today(), created_by: eve.id })).error).not.toBeNull();

    // A challenge started two days ago: days 1-3 can be ticked, day 4 can't yet.
    const { data: ch } = await admin.from("room_challenges").insert({ room_id: roomId, challenge_id: "thirty-days-of-us", started_on: shift(-2), started_by: a.id }).select("id").single();
    expect((await ca.from("challenge_checks").insert({ room_challenge_id: ch!.id, day: 3, user_id: a.id })).error).toBeNull();
    expect((await ca.from("challenge_checks").insert({ room_challenge_id: ch!.id, day: 4, user_id: a.id })).error).not.toBeNull();
    expect((await ca.from("challenge_checks").insert({ room_challenge_id: ch!.id, day: 1, user_id: b.id })).error).not.toBeNull();
    expect((await ce.from("challenge_checks").select("day")).data).toEqual([]);
    // Only one challenge at a time.
    expect((await ca.from("room_challenges").insert({ room_id: roomId, challenge_id: "miles-apart", started_by: a.id })).error).not.toBeNull();
  } finally {
    await cleanup([a.id, b.id, eve.id]);
  }
});

test("anniversary, countdowns, mood and a challenge, live in two browsers", async ({ browser }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const ctxB = await browser.newContext({ viewport: { width: 400, height: 860 } });
  const pa = await ctxA.newPage();
  const pb = await ctxB.newPage();
  const errors: string[] = [];
  for (const p of [pa, pb]) p.on("pageerror", (e) => errors.push(e.message));

  try {
    await pa.goto(await signInPath(a.email, `/room/${roomId}`));
    await pb.goto(await signInPath(b.email, `/room/${roomId}`));
    await pa.waitForTimeout(1500);
    const together = pa.getByRole("region", { name: "Together" });

    // One year ago today: day 366 and an anniversary.
    const d = new Date();
    d.setUTCFullYear(d.getUTCFullYear() - 1);
    await together.getByLabel("When did you two get together?").fill(d.toISOString().slice(0, 10));
    await together.getByRole("button", { name: "Save" }).click();
    await expect(together).toContainText("Happy first anniversary!");
    await expect(pb.getByRole("region", { name: "Together" })).toContainText("Happy first anniversary!", { timeout: 10_000 });
    await expect(together.getByRole("button", { name: "Edit" })).toBeVisible();

    await together.getByLabel("What are you counting down to?").fill("Lagos trip");
    await together.getByLabel("Date").fill(shift(3));
    await together.getByRole("button", { name: "Add" }).click();
    await expect(together).toContainText("Lagos trip");
    await expect(pb.getByRole("region", { name: "Together" })).toContainText("in 3 days", { timeout: 10_000 });

    // Ada checks in; Bo sees it.
    const mood = pa.getByRole("region", { name: "How are you today?" });
    await mood.getByRole("radio", { name: /Missing you/ }).click();
    await mood.getByLabel("Add a few words (optional)").fill("long day without you");
    await mood.getByRole("button", { name: "Share" }).click();
    await expect(pb.getByRole("region", { name: "How are you today?" })).toContainText("Ada is feeling missing you", { timeout: 10_000 });
    await expect(pb.getByText("“long day without you”")).toBeVisible();

    // Start a challenge; both tick today.
    const ch = pa.getByRole("region", { name: "30-day challenge" });
    await ch.getByRole("listitem").filter({ hasText: "Miles Apart" }).getByRole("button", { name: "Start" }).click();
    const running = pa.getByRole("region", { name: "Miles Apart" });
    await expect(running).toContainText("Day 1 of 30");
    await running.getByRole("button", { name: "Mark mine done" }).click();
    await expect(running.getByRole("button", { name: "You did it" })).toBeVisible();
    const bView = pb.getByRole("region", { name: "Miles Apart" });
    await expect(bView).toContainText("Ada did it", { timeout: 10_000 });
    await bView.getByRole("button", { name: "Mark mine done" }).click();
    await expect(running).toContainText("1 done together", { timeout: 10_000 });
    if (process.env.SHOTS_DIR) await pa.screenshot({ path: `${process.env.SHOTS_DIR}/together.png`, fullPage: true });

    expect(errors).toEqual([]);
  } finally {
    await ctxA.close();
    await ctxB.close();
    await cleanup([a.id, b.id]);
  }
});
