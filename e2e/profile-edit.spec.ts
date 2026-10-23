import { expect, test } from "@playwright/test";
import { admin, cleanup, pairedRoom, signInPath } from "./helpers";

test("edit your name and mark: saved everywhere, the partner sees it live, renames are capped", async ({ browser }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const [ca, cb] = await Promise.all([browser.newContext(), browser.newContext()]);
  const [pa, pb] = await Promise.all([ca.newPage(), cb.newPage()]);
  const profile = async () => (await admin.from("profiles").select("display_name, avatar_key, avatar_hue").eq("id", a.id).single()).data!;
  try {
    await pb.goto(await signInPath(b.email, `/room/${roomId}`));
    await pa.goto(await signInPath(a.email, `/room/${roomId}/settings`));

    // Rename and pick a new mark.
    await pa.getByRole("button", { name: "Edit" }).click();
    const form = pa.getByRole("form", { name: "Edit your name and mark" });
    await form.getByLabel("Your name").fill("Adaeze");
    await form.getByRole("radio", { name: "moon" }).click();
    await form.getByRole("button", { name: "Save" }).click();
    await expect(pa.getByText("Saved. Everyone sees the new you.")).toBeVisible();
    await expect(pa.getByText("Adaeze", { exact: true })).toBeVisible();
    expect(await profile()).toMatchObject({ display_name: "Adaeze", avatar_key: "moon" });

    // Bo's room updates by itself, with a note so he knows who Adaeze is.
    await expect(pb.getByText("Ada is now Adaeze.")).toBeVisible();

    // A new colour alone isn't a rename, so it doesn't count toward the daily cap.
    await pa.getByRole("button", { name: "Edit" }).click();
    await form.getByRole("radio", { name: /^Colour/ }).nth(2).click();
    await form.getByRole("button", { name: "Save" }).click();
    await expect(pa.getByRole("button", { name: "Edit" })).toBeVisible();

    // Three renames a day; the fourth is turned away kindly and nothing changes.
    for (const n of ["Ada B", "Ada C"]) {
      await pa.getByRole("button", { name: "Edit" }).click();
      await form.getByLabel("Your name").fill(n);
      await form.getByRole("button", { name: "Save" }).click();
      await expect(pa.getByRole("button", { name: "Edit" })).toBeVisible();
    }
    await pa.getByRole("button", { name: "Edit" }).click();
    await form.getByLabel("Your name").fill("Ada D");
    await form.getByRole("button", { name: "Save" }).click();
    await expect(form.getByRole("alert")).toHaveText(/a lot of new names for one day/);
    expect((await profile()).display_name).toBe("Ada C");

    // Empty names aren't allowed.
    await form.getByLabel("Your name").fill("   ");
    await form.getByRole("button", { name: "Save" }).click();
    await expect(form.getByRole("alert")).toHaveText(/Everyone needs a name/);
  } finally {
    await cleanup([a.id, b.id]);
    await Promise.all([ca.close(), cb.close()]);
  }
});
