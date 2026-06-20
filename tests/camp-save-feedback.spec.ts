import { expect, type Page, test } from "@playwright/test";

test.describe("Camp save feedback and recovery", () => {
  test.describe.configure({ mode: "serial" });

  test("medication check-in disables the save button, shows real stages, and persists after refresh", async ({ page }) => {
    await login(page);
    await page.goto("/camp/more");
    await page.getByRole("button", { name: "Andrew" }).click();

    const checkIn = page.getByRole("region", { name: "Check-in workflow" });
    await checkIn.getByLabel("Medication Label").fill("Feedback Check-in Medication");
    await checkIn.getByLabel("Parent-Provided Instructions").fill("Follow signed parent instructions.");
    await checkIn.getByLabel("Check-In Status").selectOption("Checked In");

    await page.route("**/api/camp/medication?**", async (route) => {
      const request = route.request();
      if (request.method() === "POST") await page.waitForTimeout(350);
      await route.continue();
    });

    const response = page.waitForResponse((res) => res.url().includes("/api/camp/medication?role=andrew") && res.request().method() === "POST");
    const saveButton = checkIn.getByRole("button", { name: "Save medication check-in" });
    await saveButton.click();
    await expect(checkIn.getByRole("button", { name: "Saving medication..." })).toBeDisabled();
    await expect(checkIn.getByText("Saving medication check-in...")).toBeVisible();
    expect((await response).status()).toBe(200);
    await expect(checkIn.getByText("Medication check-in saved.")).toBeVisible();

    await page.reload();
    await page.getByRole("button", { name: "Andrew" }).click();
    await expect(page.getByRole("region", { name: "Check-in workflow" }).getByText("Feedback Check-in Medication")).toBeVisible();
  });

  test("schedule save failure surfaces the server message and preserves form values", async ({ page }) => {
    await login(page);
    await page.goto("/camp/more");
    await page.getByRole("button", { name: "Andrew" }).click();

    const schedule = page.getByRole("region", { name: "Schedule workflow" });
    await schedule.getByLabel("Time Window").fill("Failure recovery window");
    await schedule.getByLabel("Parent Instructions").fill("Follow signed parent instructions.");

    await page.route("**/api/camp/medication?**", async (route) => {
      const request = route.request();
      if (request.method() === "POST") {
        const body = JSON.parse(request.postData() ?? "{}") as { target?: string };
        if (body.target === "schedule") {
          await page.waitForTimeout(250);
          await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "Broken schedule save" }) });
          return;
        }
      }
      await route.continue();
    });

    await schedule.getByRole("button", { name: "Add schedule item" }).click();
    await expect(schedule.getByRole("button", { name: "Saving schedule..." })).toBeDisabled();
    await expect(schedule.getByText("Medication schedule could not be saved: Broken schedule save")).toBeVisible();
    await expect(schedule.getByRole("button", { name: "Add schedule item" })).toBeEnabled();
    await expect(schedule.getByLabel("Time Window")).toHaveValue("Failure recovery window");
  });

  test("intake with a real fake image shows upload stage text and keeps the thumbnail after refresh", async ({ page }) => {
    await login(page);
    await page.goto("/camp/more");
    await page.getByRole("button", { name: "Andrew" }).click();

    const intake = page.getByRole("region", { name: "Drop-off intake" });
    await intake.getByLabel("Medication Name / Type").fill("Photo Feedback Intake");
    await intake.getByLabel("Dose").fill("Parent label dose");
    await intake.getByLabel("Schedule / When Given").fill("Breakfast");
    await intake.getByLabel("Quantity Received").fill("4 tablets");
    await intake.getByLabel("Container Status").fill("Original bottle");
    await intake.getByLabel("Guardian Printed Name").fill("Pat Parent");
    await intake.getByLabel("Guardian Relationship").fill("Parent");
    await intake.getByLabel("Parent-Provided Instructions").fill("Follow signed parent instructions.");
    await page.locator("input[type='file']").first().setInputFiles({
      name: "medicine.png",
      mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR42mP8z8BQDwAFgwJ/lwDW0wAAAABJRU5ErkJggg==", "base64")
    });
    await drawSignature(page);
    await intake.getByLabel(/I confirm this reflects/).check();

    await page.route("**/api/camp/medication/photos?**", async (route) => {
      if (route.request().method() === "POST") await page.waitForTimeout(400);
      await route.continue();
    });

    await intake.getByRole("button", { name: "Save medication intake" }).click();
    await expect(intake.getByText("Saving medication intake...")).toBeVisible();
    await expect(intake.getByText("Uploading container photo...")).toBeVisible();
    await expect(page.getByText("Medication intake saved. Photo on file.").first()).toBeVisible();

    await page.reload();
    await page.getByRole("button", { name: "Andrew" }).click();
    const checkIn = page.getByRole("region", { name: "Check-in workflow" });
    const thumbnail = checkIn.getByRole("button", { name: "View medication photo for Avery Johnson" }).first();
    await expect(thumbnail.locator("img")).toBeVisible();
  });
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_TEST_EMAIL ?? "staff@example.com");
  await page.getByLabel("Password").fill(process.env.E2E_TEST_PASSWORD ?? "password");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/dashboard$/);
}

async function drawSignature(page: Page) {
  const canvas = page.locator("canvas[aria-label='Parent or guardian signature']");
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("signature canvas not visible");
  await page.mouse.move(box.x + 24, box.y + 24);
  await page.mouse.down();
  await page.mouse.move(box.x + 80, box.y + 50, { steps: 4 });
  await page.mouse.move(box.x + 140, box.y + 92, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(100);
}
