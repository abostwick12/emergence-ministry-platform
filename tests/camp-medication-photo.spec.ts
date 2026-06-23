import { expect, type Page, test } from "@playwright/test";

test.describe("Camp restricted medication photo boundaries", () => {
  test("More stays a launcher and does not render the old check-in photo workflow", async ({ page }) => {
    await login(page);

    await page.goto("/camp/more");

    await expect(page.getByRole("region", { name: "Check-in workflow" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /View medication photo/ })).toHaveCount(0);
  });

  test("role query params cannot downgrade Andrew's authenticated photo access", async ({ page }) => {
    await login(page);
    await uploadMedicationPhoto(page, "med-1");

    const generalStatus = await page.evaluate(async () => (await fetch("/api/camp/medication/photos?role=general_leader&medicationRecordId=med-1")).status);
    const driverStatus = await page.evaluate(async () => (await fetch("/api/camp/medication/photos?role=driver&medicationRecordId=med-1")).status);

    expect(generalStatus).toBe(200);
    expect(driverStatus).toBe(200);
  });

  test("Andrew reaches the dedicated Medical Quick View without photo thumbnails on More", async ({ page }) => {
    await login(page);
    await uploadMedicationPhoto(page, "med-1");

    await page.goto("/camp");
    await page.getByRole("navigation", { name: "Camp sections" }).getByRole("link", { name: "More", exact: true }).click();
    await page.waitForURL(/\/camp\/more$/);

    await expect(page.getByRole("button", { name: /View medication photo/ })).toHaveCount(0);
    await page.getByRole("link", { name: "Medical Quick View" }).click();
    await page.waitForURL(/\/camp\/medical-quick-view$/);
    await expect(page.getByRole("heading", { name: "Medical Quick View" })).toBeVisible();
    await expect(page.getByText(/Photo: Photo On File/)).toBeVisible();
    await expect(page.getByRole("button", { name: /View medication photo/ })).toHaveCount(0);
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
