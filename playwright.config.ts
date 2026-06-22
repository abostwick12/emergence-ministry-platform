import { defineConfig, devices } from "@playwright/test";

const shouldStartWebServer = process.env.E2E_SKIP_WEBSERVER !== "true";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  ...(shouldStartWebServer
    ? {
        webServer: {
          command: "node scripts/playwright-next-server.mjs",
          url: "http://localhost:3000",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000
        }
      }
    : {})
});
