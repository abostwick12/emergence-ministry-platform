import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const shouldStartWebServer = process.env.E2E_SKIP_WEBSERVER !== "true";

// Some managed sandboxes ship a pinned Chromium that does not match the version
// @playwright/test wants to download. When that pre-installed binary is present,
// point Playwright at it; otherwise (CI, local dev) fall back to the browser that
// `playwright install` provides at the default cache location.
const SANDBOX_CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const chromiumLaunchOptions = existsSync(SANDBOX_CHROMIUM)
  ? { executablePath: SANDBOX_CHROMIUM }
  : {};

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
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
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: chromiumLaunchOptions
      }
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
