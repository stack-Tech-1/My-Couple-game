import { expect, test } from "@playwright/test";
import { admin, cleanup, clientAs, onboardedUser, pairedRoom, signInPath } from "./helpers";

test("pet names: only the person who sets one ever sees it, and only for roommates", async ({ browser }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const stranger = await onboardedUser("Stranger");
  const [ca, cb] = await Promise.all([browser.newContext(), browser.newContext()]);
  const [pa, pb] = await Promise.all([ca.newPage(), cb.newPage()]);
  try {
    await pa.goto(await signInPath(a.email, `/room/${roomId}/settings`));
    const row = pa.getByRole("form", { name: "Pet name for Bo" });
    await row.getByLabel("What you call Bo").fill("Baby");
    await row.getByRole("button", { name: "Save" }).click();
    await expect(pa.getByText("Bo is “Baby” to you now.")).toBeVisible();

    // Ada's screens say Baby; the real name stays visible where she set it.
    await pa.goto(`/room/${roomId}`);
    await expect(pa.getByRole("img", { name: /^Baby/ }).first()).toBeVisible();
    await pa.goto(`/room/${roomId}/settings`);
    await expect(pa.getByRole("form", { name: "Pet name for Bo" }).getByLabel("What you call Bo")).toHaveValue("Baby");

    // Bo never sees it: not on screen, not in the database.
    await pb.goto(await signInPath(b.email, `/room/${roomId}`));
    await expect(pb.getByText("Baby")).toHaveCount(0);
    const asBo = await clientAs(b.email);
    expect((await asBo.from("nicknames").select("*")).data).toEqual([]);

    // Pet names are for people you share a room with.
    const asAda = await clientAs(a.email);
    const { error } = await asAda.from("nicknames").insert({ owner_id: a.id, target_id: stranger.id, nickname: "Hey you" });
    expect(error).not.toBeNull();

    // Clearing it brings the real name back.
    await row.getByLabel("What you call Bo").fill("");
    await row.getByRole("button", { name: "Remove" }).click();
    await expect(pa.getByText("Back to Bo.")).toBeVisible();
    await expect.poll(async () => (await admin.from("nicknames").select("*").eq("owner_id", a.id)).data).toEqual([]);
  } finally {
    await cleanup([a.id, b.id, stranger.id]);
    await Promise.all([ca.close(), cb.close()]);
  }
});
