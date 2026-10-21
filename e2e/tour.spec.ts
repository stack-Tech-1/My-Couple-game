import { expect, test } from "@playwright/test";
import { admin, cleanup, clientAs, friendRoom, onboardedUser, pairedRoom, signInPath } from "./helpers";

test("welcome tour: existing people are asked once, it never repeats, and Settings replays it", async ({ browser }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const cy = await onboardedUser("Cy");
  const crew = await friendRoom({ c: await clientAs(a.email) }, [cy]);
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  try {
    // Someone who was here before the tour existed: offered, not forced.
    await admin.from("profiles").update({ tour: "ask" }).eq("id", a.id);
    await p.goto(await signInPath(a.email, `/room/${roomId}`));
    await expect(p.getByText("Want a 30-second tour?")).toBeVisible();
    await p.getByRole("button", { name: "No thanks" }).click();
    await expect.poll(async () => (await admin.from("profiles").select("tour").eq("id", a.id).single()).data?.tour).toBe("done");
    await p.reload();
    await p.waitForTimeout(1500);
    await expect(p.getByText("Want a 30-second tour?")).toHaveCount(0);

    // Never mid-game: other pages never show it, even when it's due.
    await admin.from("profiles").update({ tour: "auto" }).eq("id", a.id);
    await p.goto(`/room/${roomId}/games/whot`);
    await p.waitForTimeout(1500);
    await expect(p.getByRole("dialog", { name: "This is your room" })).toHaveCount(0);

    // A friend room has its own tour.
    await p.goto(`/room/${crew.id}`);
    await expect(p.getByRole("dialog", { name: "This is your friend room" })).toBeVisible();
    await p.getByRole("button", { name: "Next" }).click();
    await expect(p.getByRole("dialog", { name: "Bring your people" })).toBeVisible();
    await p.getByRole("button", { name: "Skip tour" }).click();
    await expect.poll(async () => (await admin.from("profiles").select("tour").eq("id", a.id).single()).data?.tour).toBe("done");

    // Replay from Settings, any time.
    await p.goto(`/room/${roomId}/settings`);
    await p.getByRole("link", { name: /Replay the welcome tour/ }).click();
    await expect(p.getByRole("dialog", { name: "This is your room" })).toBeVisible();
    await p.keyboard.press("Escape");
    await expect(p.getByRole("dialog", { name: "This is your room" })).toHaveCount(0);
  } finally {
    await cleanup([a.id, b.id, cy.id]);
    await ctx.close();
  }
});
