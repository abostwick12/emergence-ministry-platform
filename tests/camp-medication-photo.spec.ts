import { expect, type Page, test } from "@playwright/test";

test.describe("Camp restricted medication photo thumbnails", () => {
  test.describe.configure({ mode: "serial" });

  test("fresh mock state does not show stale seed photos before a real upload", async ({ page }) => {
    await login(page);

    await page.goto("/camp");
    await page.getByRole("button", { name: "Andrew" }).click();

    const checkIn = page.getByRole("region", { name: "Check-in workflow" });
    await expect(checkIn.getByRole("button", { name: "View medication photo for Avery Johnson" })).toHaveCount(0);
    await expect(checkIn.getByText("Photo capture happens during Medication Intake / Parent Handoff.").first()).toBeVisible();
  });

  test("restricted user sees a real thumbnail and opens the modal from the thumbnail only", async ({ page }) => {
    await login(page);
    await uploadMedicationPhoto(page, "med-1");

    await page.goto("/camp");
    await page.getByRole("button", { name: "Andrew" }).click();

    const checkIn = page.getByRole("region", { name: "Check-in workflow" });
    const thumbnail = checkIn.getByRole("button", { name: "View medication photo for Avery Johnson" });
    await expect(thumbnail.locator("img")).toBeVisible();
    await expect(checkIn.getByRole("button", { name: "View Photo" })).toHaveCount(0);
    await thumbnail.click();
    await expect(page.getByRole("dialog", { name: "Medication photo preview" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Medication photo preview" }).locator("img")).toBeVisible();
  });

  test("failed restricted thumbnail retrieval shows Photo unavailable with retry", async ({ page }) => {
    await login(page);
    await uploadMedicationPhoto(page, "med-1");
    await page.route("**/api/camp/medication/photos?**", async (route) => {
      const request = route.request();
      if (request.method() === "GET" && request.url().includes("medicationRecordId=med-1")) {
        await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Medication photo not found." }) });
        return;
      }
      await route.continue();
    });

    await page.goto("/camp");
    await page.getByRole("button", { name: "Andrew" }).click();

    const checkIn = page.getByRole("region", { name: "Check-in workflow" });
    await expect(checkIn.getByText("Photo unavailable")).toBeVisible();
    await expect(checkIn.getByRole("button", { name: "Retry Photo" })).toBeVisible();
    await expect(checkIn.getByRole("button", { name: "View Photo" })).toHaveCount(0);
    await expect(checkIn.getByRole("button", { name: "View medication photo for Avery Johnson" })).toHaveCount(0);
  });

  test("General Leader and Driver cannot receive or render medication photo data", async ({ page }) => {
    await login(page);

    await page.goto("/camp");
    await expect(page.getByText("Not available for this access view")).toBeVisible();
    await expect(page.getByRole("button", { name: "View Photo" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /View medication photo/ })).toHaveCount(0);

    const generalStatus = await page.evaluate(async () => (await fetch("/api/camp/medication/photos?role=general_leader&medicationRecordId=med-1")).status);
    const driverStatus = await page.evaluate(async () => (await fetch("/api/camp/medication/photos?role=driver&medicationRecordId=med-1")).status);

    expect(generalStatus).toBe(403);
    expect(driverStatus).toBe(403);
  });
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_TEST_EMAIL ?? "staff@example.com");
  await page.getByLabel("Password").fill(process.env.E2E_TEST_PASSWORD ?? "password");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/dashboard$/);
}

async function uploadMedicationPhoto(page: Page, medicationRecordId: string) {
  const status = await page.evaluate(async (recordId) => {
    const bytes = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR42mP8z8BQDwAFgwJ/lwDW0wAAAABJRU5ErkJggg=="), (char) => char.charCodeAt(0));
    const formData = new FormData();
    formData.set("medicationRecordId", recordId);
    formData.set("photo", new File([bytes], "medicine.png", { type: "image/png" }));
    return (await fetch("/api/camp/medication/photos?role=andrew", { method: "POST", body: formData })).status;
  }, medicationRecordId);

  expect(status).toBe(201);
}
