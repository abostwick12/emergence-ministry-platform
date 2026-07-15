import { chromium } from "@playwright/test";

const baseUrl = process.env.REDESIGN_CAPTURE_URL ?? "http://localhost:3102";
const browser = await chromium.launch();

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel("Email").fill("staff@example.com");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/dashboard$/);

  for (const route of ["dashboard", "events", "worship", "budget"]) {
    await page.goto(`${baseUrl}/${route}`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `test-results/${route}-editorial-1280x900.png`, fullPage: true });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/dashboard`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "test-results/dashboard-editorial-390x844.png", fullPage: true });

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(`${baseUrl}/events`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "test-results/events-editorial-768x1024.png", fullPage: true });
} finally {
  await browser.close();
}
