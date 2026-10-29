import { expect, test } from "@playwright/test";
import { admin, cleanup, makeUser, pairedRoom, signInPath } from "./helpers";

/**
 * The admin Plus page. Plus is live in the test project; anything global changed here (the
 * launch switch) is put back in `finally`.
 */
test("admin Plus: payments, refunds through Paystack, giving and ending Plus, the launch switch", async ({ page }) => {
  const { a, b } = await pairedRoom(["Ada", "Bo"]);
  const payer = await makeUser("payer", { plus: false });
  const { data: before } = await admin.from("app_config").select("value").eq("key", "plus").single();
  try {
    await admin.from("app_admins").insert({ user_id: a.id });
    // A one-off payment by USSD, paid as Paystack would confirm it.
    const reference = `AMH-ADMN-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await admin.from("plus_purchases").insert({ reference, payer_id: payer.id, room_id: null, plan: "single", period: "month", method: "pass", seats: 1, amount_kobo: 150000, recipients: [payer.id] });
    expect(error).toBeNull();
    expect((await admin.rpc("plus_fulfil", { p_reference: reference, p_amount: 150000, p_info: { channel: "ussd" } })).error).toBeNull();

    await page.goto(await signInPath(a.email, "/admin/plus"));
    await expect(page.getByRole("heading", { name: "Amah Plus", level: 1 })).toBeVisible();
    await expect(page.getByText(/^Live/)).toBeVisible();

    // Find the payment by its reference.
    await page.getByLabel("Reference or email").fill(reference);
    await page.getByRole("button", { name: "Search" }).click();
    const row = page.getByRole("row").filter({ hasText: reference });
    await expect(row).toContainText("Just me, monthly");
    await expect(row).toContainText("USSD");
    await expect(row).toContainText("₦1,500");
    await expect(row).toContainText("Paid");
    // Paystack has never seen this made-up payment, so the refund is refused and nothing changes.
    await row.getByRole("button", { name: "Refund" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Refund ₦1,500" }).click();
    await expect(page.getByText(/^Paystack:/)).toBeVisible();
    const { data: still } = await admin.from("plus_purchases").select("status").eq("reference", reference).single();
    expect(still?.status).toBe("paid");

    // Someone's Plus: look them up, give a month, end a seat.
    const person = page.locator("#person");
    await person.getByLabel("Their email").fill(payer.email);
    await person.getByRole("button", { name: "Look up" }).click();
    await expect(person.getByText(/Has Plus until/)).toBeVisible();
    await person.getByRole("button", { name: "Give Plus" }).click();
    await expect(page.getByText("Added after any Plus they already had.")).toBeVisible();
    await expect(person.getByRole("row").filter({ hasText: "From the team" })).toHaveCount(1);
    await person.getByRole("row").filter({ hasText: "From the team" }).getByRole("button", { name: "End now" }).click();
    await expect(page.getByText("Seat ended.")).toBeVisible();
    const { data: team } = await admin.from("plus_seats").select("revoked_at").eq("user_id", payer.id).eq("source", "admin").single();
    expect(team?.revoked_at).not.toBeNull();

    // Why people leave: the table is there, with every reason.
    await expect(page.locator("#leaving").getByRole("row")).toHaveCount(8);

    // The launch switch: off makes everything free again.
    await page.getByRole("button", { name: "Switch Plus off" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Switch off" }).click();
    await expect(page.getByText("Everything in Amah is free, and no Plus screens show.")).toBeVisible();
    // While Plus is off, even a brand-new free account counts as having it.
    const free = await makeUser("free", { plus: false });
    expect((await admin.rpc("has_plus", { uid: free.id })).data).toBe(true);
    await cleanup([free.id]);
  } finally {
    await admin.from("app_config").upsert({ key: "plus", value: before?.value ?? { launched_at: "2026-01-01T00:00:00Z" } });
    await admin.from("app_admins").delete().eq("user_id", a.id);
    await cleanup([a.id, b.id, payer.id]);
  }
});
