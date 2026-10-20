import { expect, test } from "@playwright/test";

/**
 * Guards the landing page's weight. If anything under app/(app) (e.g. a next/link import in its
 * layout tree) becomes the "first" bundle for a shared client module, Next attributes that module
 * to the app layout's chunk group and the landing page silently starts loading the whole app
 * shell (providers, framer-motion). Lighthouse dropped below 90 when that happened.
 */
test("the landing page doesn't load the app shell", async ({ request }) => {
  const html = await (await request.get("/")).text();
  expect(html).not.toContain("app/(app)/layout");
  expect(html).not.toContain("app/(auth)/layout");
});