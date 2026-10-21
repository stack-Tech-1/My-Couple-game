import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    viewport: { width: 420, height: 900 },
    // A synthetic microphone (a beeping tone) so voice notes can be recorded without hardware.
    launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
  },
  // Production build against the TEST project (.env.test.local): realistic timings, never live data.
  // E2E_NO_SERVER=1 skips it entirely, for database-only specs.
  ...(process.env.E2E_NO_SERVER
    ? {}
    : { webServer: { command: "node scripts/with-env.mjs .env.test.local -- \"npx next build && npx next start -p 3100\"", url: "http://localhost:3100", reuseExistingServer: !!process.env.E2E_REUSE, timeout: 400_000 } }),
});