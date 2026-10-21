import { expect, test } from "@playwright/test";
import { admin, cleanup, clientAs, friendRoom, onboardedUser, pairedRoom, signInPath } from "./helpers";

test("theme: switch on the home page, it sticks across pages; email typos get a hint", async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: "light" });
  const p = await ctx.newPage();
  try {
    await p.goto("/");
    await expect(p.locator("html")).not.toHaveAttribute("data-theme", "night");
    await p.getByRole("button", { name: "Switch to dark mode" }).click();
    await expect(p.locator("html")).toHaveAttribute("data-theme", "night");
    await p.goto("/sign-in");
    await expect(p.locator("html")).toHaveAttribute("data-theme", "night");
    await p.reload();
    await expect(p.locator("html")).toHaveAttribute("data-theme", "night");
    await expect(p.getByRole("button", { name: "Switch to light mode" })).toBeVisible();

    // A typo in the domain is caught before a link is sent anywhere.
    await p.getByLabel("Email").fill("someone@gmail.co");
    await p.getByRole("button", { name: "Email me a link" }).click();
    await expect(p.getByText("Did you mean someone@gmail.com?")).toBeVisible();
    await p.getByRole("button", { name: "Yes, fix it" }).click();
    await expect(p.getByLabel("Email")).toHaveValue("someone@gmail.com");
    await expect(p.getByText(/Did you mean/)).toHaveCount(0);
  } finally {
    await ctx.close();
  }
});

test("theme: a phone in dark mode gets dark mode first time", async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: "dark" });
  const p = await ctx.newPage();
  try {
    await p.goto("/");
    await expect(p.locator("html")).toHaveAttribute("data-theme", "night");
  } finally {
    await ctx.close();
  }
});

test("theme: one choice per person, across rooms and onto a new phone", async ({ browser }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const cy = await onboardedUser("Cy");
  const crew = await friendRoom({ c: await clientAs(a.email) }, [cy]);
  const phone1 = await browser.newContext({ colorScheme: "light" });
  const phone2 = await browser.newContext({ colorScheme: "light" });
  try {
    const p = await phone1.newPage();
    await p.goto(await signInPath(a.email, `/room/${roomId}/settings`));
    await p.getByRole("radio", { name: "Night" }).click();
    await expect.poll(async () => (await admin.from("profiles").select("theme").eq("id", a.id).single()).data?.theme).toBe("night");

    // Another room: still night.
    await p.goto(`/room/${crew.id}`);
    await expect(p.locator("html")).toHaveAttribute("data-theme", "night");

    // A different phone, signed in fresh: the account's choice arrives.
    const q = await phone2.newPage();
    await q.goto(await signInPath(a.email, `/room/${roomId}`));
    await expect(q.locator("html")).toHaveAttribute("data-theme", "night");
  } finally {
    await cleanup([a.id, b.id, cy.id]);
    await phone1.close();
    await phone2.close();
  }
});
