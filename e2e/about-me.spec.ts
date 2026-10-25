import { expect, test } from "@playwright/test";
import { admin, cleanup, pairedRoom, signInPath } from "./helpers";

test("about me: fill in favourites, your partner taps your face to see them, love style from the game", async ({ browser }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const [ca, cb] = await Promise.all([browser.newContext(), browser.newContext()]);
  const [pa, pb] = await Promise.all([ca.newPage(), cb.newPage()]);
  try {
    await pa.goto(await signInPath(a.email, `/room/${roomId}/settings`));
    const form = pa.getByRole("form", { name: "About you" });
    await form.getByLabel("Favourite food").fill("Ofada rice");
    await form.getByLabel("Happy place").fill("Lekki beach at sunset");
    await form.getByLabel("One line about you").fill("I will beat you at Ayo. Respectfully.");
    await form.getByRole("button", { name: "Save" }).click();
    await expect(pa.getByText("Saved. Your people can tap your face to see it.")).toBeVisible();
    expect((await admin.from("profiles").select("about").eq("id", a.id).single()).data?.about).toEqual({
      food: "Ofada rice",
      place: "Lekki beach at sunset",
      line: "I will beat you at Ayo. Respectfully.",
    });

    // Bo taps Ada's face in the header.
    await admin.from("profiles").update({ birth_month: 3, birth_day: 14 }).eq("id", a.id);
    await pb.goto(await signInPath(b.email, `/room/${roomId}`));
    await pb.getByRole("button", { name: /^About Ada/ }).click();
    const card = pb.getByRole("dialog", { name: "Ada" });
    await expect(card.getByText("Ofada rice")).toBeVisible();
    await expect(card.getByText("14 March")).toBeVisible();
    await expect(card.getByText("“I will beat you at Ayo. Respectfully.”")).toBeVisible();
    await expect(card.getByText("Feels most loved through")).toHaveCount(0);
    await pb.keyboard.press("Escape");

    // Bo hasn't filled his in: Ada sees that, kindly.
    await pa.goto(`/room/${roomId}`);
    await pa.getByRole("button", { name: /^About Bo/ }).click();
    await expect(pa.getByRole("dialog", { name: "Bo" }).getByText("Bo hasn't filled this in yet.")).toBeVisible();
    await pa.keyboard.press("Escape");

    // After a Love Styles game together, the card knows how Ada feels most loved.
    await pa.goto(`/room/${roomId}/games/love-styles`);
    await pa.getByRole("button", { name: "Invite Bo" }).click();
    await pb.getByRole("button", { name: "Join" }).click();
    await expect(pb).toHaveURL(/\/play\//);
    for (const p of [pa, pb]) {
      for (let i = 0; i < 10; i++) {
        await expect(p.getByText(`${i + 1} of 10`)).toBeVisible();
        await p.locator("main button.min-h-16").first().click();
      }
      await p.getByRole("button", { name: "Time together" }).click();
    }
    for (const p of [pa, pb]) await expect(p.getByText(/^To love (Ada|Bo) well$/)).toBeVisible();
    await pb.goto(`/room/${roomId}`);
    await pb.getByRole("button", { name: /^About Ada/ }).click();
    await expect(pb.getByRole("dialog", { name: "Ada" }).getByText("Feels most loved through")).toBeVisible();
  } finally {
    await cleanup([a.id, b.id]);
    await Promise.all([ca.close(), cb.close()]);
  }
});
