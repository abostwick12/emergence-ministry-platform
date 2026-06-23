import { expect, type Locator, type Page, test } from "@playwright/test";

test.describe("Camp dedicated medication tool pages", () => {
  test("Andrew bootstrap sees restricted medication workflows without selecting a role", async ({ page }) => {
    await login(page);
    await page.goto("/camp/more");

    await expect(page.getByRole("heading", { name: "More Camp tools" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Full Schedule" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Transportation / Vehicles" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Forms & Documents" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Medicine Intake / Return" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Administer Medicine" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Drop-off intake" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Andrew", exact: true })).toHaveCount(0);
  });

  test("Andrew can open restricted staff medicine pages and Medical Command administration", async ({ page }) => {
    await login(page);
    await page.goto("/camp");
    await page.getByRole("navigation", { name: "Camp sections" }).getByRole("link", { name: "More", exact: true }).click();

    await expect(page.getByRole("link", { name: "Medicine Intake / Return" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Medication Schedule" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Medication History & Corrections" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Administer Medicine" })).toBeVisible();

    await page.getByRole("link", { name: "Medicine Intake / Return" }).click();
    await expect(page.getByRole("heading", { name: "Medicine Intake / Return" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save medication intake" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save return status" })).toBeVisible();

    await page.goto("/camp/medical-command/administer");
    await expect(page.getByRole("heading", { name: "Administer Medicine" })).toBeVisible();
  });

  test("tapping a Medical Command time block opens administration with the block preselected", async ({ page }) => {
    await login(page);
    await page.goto("/camp");

    await page.getByRole("button", { name: "Medical Command" }).click();
    await page.getByRole("link", { name: "Open medication detail for Avery Johnson" }).click();
    await page.waitForURL(/\/camp\/medical-command\/administer\?.*scheduleItemId=med-sched-1/);
    await expect(page.getByRole("heading", { name: "Administer Medicine" })).toBeVisible();
    await expect(page.getByLabel("Medication time block")).toHaveValue("med-sched-1");
    await expect(page.getByText("Avery Johnson - Breakfast").first()).toBeVisible();
    await expect(page.locator("a.camp-cc-back", { hasText: "More" })).toBeVisible();
  });

  test("Andrew administration requires acknowledgement initials or unavailable reason", async ({ page }) => {
    await login(page);
    await page.goto("/camp");
    await page.getByRole("navigation", { name: "Camp sections" }).getByRole("link", { name: "More", exact: true }).click();

    await page.getByRole("link", { name: "Administer Medicine" }).click();
    await page.waitForURL(/\/camp\/medical-command\/administer$/);
    await page.getByLabel("Medication time block").selectOption("med-sched-1");
    await expect(page.getByRole("button", { name: "Confirm Administration" })).toBeDisabled();

    await signPad(page.getByRole("img", { name: "Student acknowledgement signature pad" }));
    await expect(page.getByRole("button", { name: "Confirm Administration" })).toBeEnabled();
    await page.getByRole("button", { name: "Clear and Re-sign" }).click();
    await expect(page.getByRole("button", { name: "Confirm Administration" })).toBeDisabled();

    await signPad(page.getByRole("img", { name: "Student acknowledgement signature pad" }));
    await page.getByLabel("Staff notes").fill("Logged after student acknowledgement.");
    await page.getByRole("button", { name: "Confirm Administration" }).click();
    await expect(page.getByText("Medication administration logged.")).toBeVisible();
    await expect(page.getByRole("img", { name: /Student acknowledgement preview/ })).toBeVisible();
  });

  test("Andrew acknowledgement unavailable requires a reason", async ({ page }) => {
    await login(page);
    await page.goto("/camp");
    await page.getByRole("navigation", { name: "Camp sections" }).getByRole("link", { name: "More", exact: true }).click();
    await page.getByRole("link", { name: "Administer Medicine" }).click();
    await page.waitForURL(/\/camp\/medical-command\/administer$/);

    await page.getByLabel("Unavailable or declined to initial").check();
    await expect(page.getByRole("button", { name: "Confirm Administration" })).toBeDisabled();

    await page.getByLabel("Reason required").fill("Student was asleep during documentation.");
    await page.getByRole("button", { name: "Confirm Administration" }).click();
    await expect(page.getByText("Medication administration logged.")).toBeVisible();
  });

  test("Medicine Intake saves parent handoff with signature and updates return status", async ({ page }) => {
    await login(page);
    await page.goto("/camp");
    await page.getByRole("navigation", { name: "Camp sections" }).getByRole("link", { name: "More", exact: true }).click();
    await page.getByRole("link", { name: "Medicine Intake \/ Return" }).click();
    await page.waitForURL(/\/camp\/medicine-intake$/);

    await page.getByLabel("Camper medication record").selectOption("med-1");
    await page.getByLabel("Dose").fill("Parent label dose");
    await page.getByLabel("Quantity received").fill("8 tablets");
    await page.getByLabel("Parent/guardian name").fill("Pat Parent");
    await page.getByLabel("Upload photo").setInputFiles(pngFile("medicine.png"));
    await expect(page.getByAltText("Selected medication label or container preview")).toBeVisible();
    await signPad(page.getByRole("img", { name: "Parent or guardian signature", exact: true }));
    await page.getByLabel("Parent/guardian handoff details reviewed with staff.").check();
    await expect(page.getByRole("button", { name: "Save medication intake" })).toBeEnabled();
    await page.getByRole("button", { name: "Save medication intake" }).click();
    await expect(page.getByText("Medication intake recorded with parent/guardian acknowledgement.")).toBeVisible();
    await expect(page.getByRole("img", { name: /Parent or guardian signature preview/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "View Photo" })).toBeVisible();
    await expect(page.getByText("8 tablets received by Andrew")).toBeVisible();

    await page.getByLabel("Return status").selectOption("Returned to Parent/Guardian");
    await page.getByLabel("Recipient name").fill("Pat Parent");
    await page.getByLabel("Recipient relationship").fill("Parent");
    await page.getByLabel("Return notes").fill("Returned at checkout.");
    await page.getByRole("button", { name: "Save return status" }).click();
    await expect(page.getByText("Medication return status updated.")).toBeVisible();
  });

  test("Edit Camper action stays compact inside tall roster cards", async ({ page }) => {
    await login(page);
    await page.goto("/camp");
    await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.innerHTML = `
        <button class="camp-student-card camp-student-button" style="height: 220px">
          <span class="camp-avatar">AJ</span>
          <span>
            <strong>Layout Probe</strong>
            <span class="muted">Tall card content</span>
            <span class="button compact-button camp-card-action">Edit Camper</span>
          </span>
        </button>
      `;
      document.body.appendChild(probe);
    });
    const action = page.locator(".camp-card-action").last();
    const box = await action.boundingBox();
    expect(box?.height).toBeLessThan(48);
  });

  test("mobile photo and signature controls are usable on routed Camp workflows", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);

    await page.goto("/camp/medicine-intake");
    await page.getByLabel("Camper medication record").selectOption("med-1");
    await page.getByLabel("Dose").fill("Parent label dose");
    await page.getByLabel("Quantity received").fill("8 tablets");
    await page.getByLabel("Parent/guardian name").fill("Pat Parent");
    await page.getByLabel("Upload photo").setInputFiles(pngFile("mobile-medicine.png"));
    await signPad(page.getByRole("img", { name: "Parent or guardian signature", exact: true }));
    await page.getByLabel("Parent/guardian handoff details reviewed with staff.").check();
    await expect(page.getByRole("button", { name: "Save medication intake" })).toBeEnabled();

    await page.goto("/camp/medical-command/administer");
    await page.getByLabel("Medication time block").selectOption({ index: 0 });
    await signPad(page.getByRole("img", { name: "Student acknowledgement signature pad" }));
    await expect(page.getByRole("button", { name: "Confirm Administration" })).toBeEnabled();

    await page.goto("/camp/roster");
    await page.getByRole("button", { name: /Avery Johnson/ }).click();
    await expect(page.getByText("Camper photo")).toBeVisible();
    await page.getByLabel("Upload photo").setInputFiles(pngFile("avery.png"));
    await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Camper saved.")).toBeVisible();
    await expect(page.locator(".camp-student-avatar img").first()).toBeVisible();
  });
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_TEST_EMAIL ?? "staff@example.com");
  await page.getByLabel("Password").fill(process.env.E2E_TEST_PASSWORD ?? "password");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/dashboard$/);
}

async function signPad(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  await locator.page().mouse.move(box.x + 24, box.y + 40);
  await locator.page().mouse.down();
  await locator.page().mouse.move(box.x + 78, box.y + 86);
  await locator.page().mouse.move(box.x + 132, box.y + 42);
  await locator.page().mouse.up();
}

function pngFile(name: string) {
  return {
    name,
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR42mP8z8BQDwAFgwJ/lwDW0wAAAABJRU5ErkJggg==", "base64")
  };
}
