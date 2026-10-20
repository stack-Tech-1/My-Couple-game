import { expect, test } from "@playwright/test";

/** Installable + offline: the service worker activates, and a dropped connection shows a friendly page. */
test("service worker serves the offline page when the network is gone", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  const manifest = await (await page.request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.some((i: { sizes: string }) => i.sizes === "512x512")).toBe(true);

  await page.reload(); // let the active worker control the page
  await ctx.setOffline(true);
  await page.goto("/room").catch(() => {});
  await expect(page.getByRole("heading", { name: "The Wi-Fi has wandered off." })).toBeVisible();
  await ctx.close();
});