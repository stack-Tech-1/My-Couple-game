import { expect, test } from "@playwright/test";
import { admin, cleanup, pairedRoom, signInPath } from "./helpers";

test("quiet hours: on with the phone's time zone, times change, and off again", async ({ browser }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const ctx = await browser.newContext({ timezoneId: "Africa/Lagos" });
  const page = await ctx.newPage();
  const saved = async () => (await admin.from("profiles").select("quiet_start, quiet_end, time_zone").eq("id", a.id).single()).data;
  try {
    await page.goto(await signInPath(a.email, `/room/${roomId}/settings`));
    await page.getByRole("switch", { name: /Quiet hours/ }).click();
    await expect(page.getByText("Quiet from 11 pm to 7 am.")).toBeVisible();
    expect(await saved()).toEqual({ quiet_start: 23, quiet_end: 7, time_zone: "Africa/Lagos" });

    await page.getByLabel("Quiet from").selectOption({ label: "10 pm" });
    await expect(page.getByText("Quiet from 10 pm to 7 am.")).toBeVisible();
    await expect.poll(async () => (await saved())?.quiet_start).toBe(22);

    // Still there after a reload.
    await page.reload();
    await expect(page.getByLabel("Quiet from")).toHaveValue("22");

    await page.getByRole("switch", { name: /Quiet hours/ }).click();
    await expect(page.getByText("Quiet hours off.")).toBeVisible();
    await expect.poll(async () => (await saved())?.quiet_start).toBeNull();
  } finally {
    await cleanup([a.id, b.id]);
    await ctx.close();
  }
});
