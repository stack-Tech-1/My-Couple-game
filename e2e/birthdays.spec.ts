import { expect, test } from "@playwright/test";
import { MONTHS } from "../src/lib/birthdays";
import { admin, cleanup, loadEnv, pairedRoom, signInPath } from "./helpers";

const plus = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return { month: d.getMonth() + 1, day: d.getDate(), weekday: d.toLocaleDateString("en-GB", { weekday: "long" }) };
};

test("birthdays: set in Settings, celebrated on the day, a heads-up before, and a nudge to add yours", async ({ browser, request }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const [ca, cb] = await Promise.all([browser.newContext(), browser.newContext()]);
  const [pa, pb] = await Promise.all([ca.newPage(), cb.newPage()]);
  try {
    // Ada's birthday is today. Day and month only.
    const today = plus(0);
    await pa.goto(await signInPath(a.email, `/room/${roomId}/settings`));
    await pa.getByLabel("Birthday day").selectOption(String(today.day));
    await pa.getByLabel("Birthday month").selectOption({ label: MONTHS[today.month - 1]! });
    await pa.getByRole("group", { name: "Your birthday" }).getByRole("button", { name: "Save" }).click();
    await expect(pa.getByText("Birthday saved. Your people will be reminded.")).toBeVisible();
    expect((await admin.from("profiles").select("birth_month, birth_day").eq("id", a.id).single()).data).toEqual({ birth_month: today.month, birth_day: today.day });

    await pa.goto(`/room/${roomId}`);
    await expect(pa.getByRole("heading", { name: "Happy birthday, Ada!" })).toBeVisible();

    // Bo sees the celebration, and (having no birthday saved) a nudge to add his.
    await pb.goto(await signInPath(b.email, `/room/${roomId}`));
    const party = pb.getByRole("region", { name: "Birthdays" });
    await expect(party.getByRole("heading", { name: "It's Ada's birthday today!" })).toBeVisible();
    await expect(party.getByRole("button", { name: "Send a birthday message" })).toBeVisible();
    await expect(party.getByText("When's your birthday?")).toBeVisible();
    await party.getByRole("button", { name: "Not now" }).click();
    await expect(party.getByText("When's your birthday?")).toHaveCount(0);

    // Three days out, Ada gets a heads-up about Bo.
    const soon = plus(3);
    await admin.from("profiles").update({ birth_month: soon.month, birth_day: soon.day }).eq("id", b.id);
    await pa.reload();
    await expect(pa.getByText(`Bo's birthday is on ${soon.weekday}.`)).toBeVisible();

    // No impossible dates, even straight to the database.
    const { error } = await admin.from("profiles").update({ birth_month: 2, birth_day: 30 }).eq("id", b.id);
    expect(error).not.toBeNull();

    // The daily reminder only answers Vercel's scheduler.
    expect((await request.get("/api/cron/birthdays")).status()).toBe(401);
    const run = await request.get("/api/cron/birthdays", { headers: { authorization: `Bearer ${loadEnv().CRON_SECRET}` } });
    expect(run.status()).toBe(200);
    expect((await run.json()).people).toBeGreaterThanOrEqual(1);
  } finally {
    await cleanup([a.id, b.id]);
    await Promise.all([ca.close(), cb.close()]);
  }
});
