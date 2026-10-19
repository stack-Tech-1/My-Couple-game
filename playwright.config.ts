import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure", viewport: { width: 420, height: 900 } },
  // Production build: realistic timings, no on-demand route compiles.
  webServer: { command: "npx next build && npx next start -p 3100", url: "http://localhost:3100", reuseExistingServer: !!process.env.E2E_REUSE, timeout: 400_000 },
});