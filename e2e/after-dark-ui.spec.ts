import { expect, test, type Page } from "@playwright/test";
import { admin, cleanup, pairedRoom, signInPath } from "./helpers";

const SHOTS = process.env.SHOTS_DIR;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
};

async function consent(page: Page, roomId: string, heat: "Warm" | "Hot" | "Fire") {
  await page.goto(`/room/${roomId}/after-dark`);
  await page.getByLabel("I confirm I'm 18 or older").check();
  await expect(page.getByRole("switch", { name: "Open After Dark from my side" })).toBeEnabled();
  await page.getByRole("switch", { name: "Open After Dark from my side" }).click();
  await expect(page.getByRole("switch", { name: "Open After Dark from my side" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radio", { name: heat, exact: true }).click();
  await expect(page.getByRole("radio", { name: heat, exact: true })).toHaveAttribute("aria-checked", "true");
  // The controls are optimistic; let the saves reach the server before navigating away.
  await page.waitForLoadState("networkidle");
}

async function setPin(page: Page, pin: string) {
  await expect(page.getByRole("heading", { name: "Set your PIN" })).toBeVisible();
  await page.locator("#ad-pin").fill(pin);
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { name: "Once more" })).toBeVisible();
  await page.locator("#ad-pin").fill(pin);
  await page.getByRole("button", { name: "Unlock" }).click();
}

/** The whole After Dark flow, with the owner's safety rules, in two real browsers. */
test("after dark: consent, PIN, heat cap, discretion, skip, opt-out and quick exit", async ({ browser }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext({ viewport: { width: 400, height: 860 } });
  const pa = await ctxA.newPage();
  const pb = await ctxB.newPage();
  const errors: string[] = [];
  for (const p of [pa, pb]) p.on("pageerror", (e) => errors.push(e.message));

  try {
    await pa.goto(await signInPath(a.email, `/room/${roomId}`));
    await pb.goto(await signInPath(b.email, `/room/${roomId}`));
    await expect(pa.getByText("After dark is locked.")).toBeVisible();

    // Two keys: each confirms and opts in on their own phone. Ada allows Fire, Bo only Warm.
    await consent(pa, roomId, "Fire");
    await shot(pa, "ad-consent");
    await consent(pb, roomId, "Warm");
    await pb.reload();

    // The section is now open, behind each person's own PIN; the lights dim.
    await setPin(pb, "2468");
    await expect(pb.getByRole("heading", { name: "The lights are low." })).toBeVisible();
    await expect(pb.locator("html")).toHaveAttribute("data-theme", "afterdark");
    await shot(pb, "ad-hub");
    await pa.reload();
    await setPin(pa, "1357");

    // Start Truth or Dare. Bo's invite toast must not name the game.
    await pa.getByRole("link", { name: /Truth or Dare/ }).click();
    await pa.getByRole("button", { name: "Invite Bo" }).click();
    await expect(pa).toHaveURL(/\/play\//);
    const sessionId = pa.url().split("/play/")[1]!;
    const inviteToast = pb.locator('[role="status"]', { hasText: "Ada sent you an invite" });
    await expect(inviteToast).toBeVisible();
    await expect(inviteToast).not.toContainText(/Truth|Dare|after dark/i);
    await pb.getByRole("button", { name: "Join" }).click();
    await expect(pb).toHaveURL(new RegExp(sessionId));

    // Heat is capped at the lower limit (Warm): Hot and Fire are unavailable to both.
    for (const p of [pa, pb]) {
      await expect(p.getByRole("radio", { name: "Hot" })).toBeDisabled();
      await expect(p.getByRole("radio", { name: "Fire" })).toBeDisabled();
    }
    const { data: secret } = await admin.from("game_secrets").select("state").eq("session_id", sessionId).single();
    expect((secret!.state as { maxHeat: number }).maxHeat).toBe(1);

    // Whoever's turn picks a dare; the other skips it, no penalty, and a new dare appears.
    const turnPage = (await pa.getByRole("button", { name: "Dare", exact: true }).isVisible().catch(() => false)) ? pa : pb;
    const otherPage = turnPage === pa ? pb : pa;
    await expect(turnPage.getByRole("button", { name: "Dare", exact: true })).toBeVisible();
    await turnPage.getByRole("button", { name: "Dare", exact: true }).click();
    const firstCard = await otherPage.locator("article p.display").textContent();
    await otherPage.getByRole("button", { name: "Skip, no questions" }).click();
    await expect(turnPage.locator("article p.display")).not.toHaveText(firstCard!);
    await otherPage.waitForTimeout(700);
    await shot(otherPage, "ad-card");

    // Discreet mode: the screen blurs the moment the window loses focus.
    await pa.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(pa.locator(".discreet-blur")).toHaveCount(1);
    await pa.evaluate(() => window.dispatchEvent(new Event("focus")));

    // Bo opts out mid-card (from settings, no PIN). The current card finishes, then it ends, neutrally.
    const pbSettings = await ctxB.newPage();
    await pbSettings.goto(`/room/${roomId}/settings`);
    await pbSettings.getByRole("switch", { name: "After Dark open from my side" }).click();
    await expect(pbSettings.getByText("Closed.")).toBeVisible();
    await pa.reload();
    await expect(pa.getByText("This session will end after this card.")).toBeVisible();
    await pa.getByRole("button", { name: "Done" }).click();
    await expect(pa.locator("#result-title")).toHaveText("Session ended.");
    await expect(pb.locator("#result-title")).toHaveText("Session ended.");
    const { data: s } = await admin.from("game_sessions").select("status, outcome").eq("id", sessionId).single();
    expect(s).toEqual({ status: "finished", outcome: "complete" });

    // Nothing After Dark ever reaches the shared timeline.
    const { data: moments } = await admin.from("moments").select("kind, payload").eq("room_id", roomId);
    expect(JSON.stringify(moments)).not.toMatch(/truth-or-dare|spicy|fantasy/);

    // Quick exit lands on a neutral room screen with the normal theme.
    await pa.getByRole("button", { name: /Quick exit/ }).click();
    await expect(pa).toHaveURL(new RegExp(`/room/${roomId}$`));
    await expect(pa.locator("html")).not.toHaveAttribute("data-theme", "afterdark");
    await expect(pa.getByText("After dark is locked.")).toBeVisible();

    expect(errors).toEqual([]);
  } finally {
    await cleanup([a.id, b.id]);
    await ctxA.close();
    await ctxB.close();
  }
});
