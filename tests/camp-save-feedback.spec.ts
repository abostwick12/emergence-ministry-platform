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
    await expect(page.getByRole("button", { name: "Scan Label" })).toBeDisabled();
    await expect(page.getByText("Medication label scanning is disabled. Manual medication entry remains available.")).toBeVisible();

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
    const adminCard = page.getByTestId("camp-medication-admin-card-med-sched-1");
    await expect(adminCard).toContainText("Parent-labeled medication A");
    await expect(adminCard).toContainText("Dose");
    await expect(adminCard).toContainText("Follow signed parent instructions");
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

    await signPadWithWindowTouch(page.getByRole("img", { name: "Student acknowledgement signature pad" }));
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
    await signPadWithWindowTouch(page.getByRole("img", { name: "Parent or guardian signature", exact: true }));
    await page.getByLabel("Parent/guardian handoff details reviewed with staff.").check();
    await expect(page.getByRole("button", { name: "Save medication intake" })).toBeEnabled();
    await page.getByRole("button", { name: "Save medication intake" }).click();
    await expect(page.getByText("Medication intake recorded with parent/guardian acknowledgement.")).toBeVisible();
    await expect(page.getByRole("img", { name: /Parent or guardian signature preview/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "View Photo" }).first()).toBeVisible();
    await expect(page.getByText("8 tablets received by Andrew").first()).toBeVisible();

    await page.getByLabel("Return status").selectOption("Returned to Parent/Guardian");
    await page.getByLabel("Recipient name").fill("Pat Parent");
    await page.getByLabel("Recipient relationship").fill("Parent");
    await page.getByLabel("Return notes").fill("Returned at checkout.");
    await page.getByRole("button", { name: "Save return status" }).click();
    await expect(page.getByText("Medication return status updated.")).toBeVisible();
  });

  test("Medicine Intake can start medication for an active camper without an existing medication record", async ({ page }) => {
    await login(page);
    await page.goto("/camp/medicine-intake");

    await page.getByLabel("Camper", { exact: true }).selectOption({ label: "Riley Brooks" });
    await expect(page.getByLabel("Camper medication record")).toHaveValue("");
    await page.getByLabel("Medication name/type").fill("New imported camper medication");
    await page.getByLabel("Dose").fill("Parent label dose");
    await page.getByLabel("Scheduled time(s)").fill("8am and 12pm");
    await page.getByLabel("Quantity received").fill("6 tablets");
    await page.getByLabel("Parent/guardian instructions").fill("Follow parent instructions.");
    await page.getByLabel("Parent/guardian name").fill("Pat Parent");
    await signPadWithWindowTouch(page.getByRole("img", { name: "Parent or guardian signature", exact: true }));
    await page.getByLabel("Parent/guardian handoff details reviewed with staff.").check();

    await expect(page.getByRole("button", { name: "Save medication intake" })).toBeEnabled();
    await page.getByRole("button", { name: "Save medication intake" }).click();
    await expect(page.getByText("Saved. Medication intake recorded with parent/guardian acknowledgement.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Recent medication intake records" }).getByText("Riley Brooks - New imported camper medication")).toBeVisible();

    await page.goto("/camp/medical-command/administer");
    await expect(page.getByLabel("Medication time block")).toContainText("Riley Brooks - 8:00 AM");
    await expect(page.getByLabel("Medication time block")).toContainText("Riley Brooks - 12:00 PM");
  });

  test("Scan Label adds a reviewed draft row and falls back to the existing grouped intake save", async ({ page }) => {
    await login(page);
    await enableMedicationScanForPage(page);
    let medicationPostCount = 0;
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname === "/api/camp/medication" && request.method() === "POST") medicationPostCount += 1;
    });
    await page.route(/\/api\/camp\/medication\/scan-label$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          studentNameOnLabel: "Riley Brooks",
          medicationName: "Scanned Camp Med",
          dose: "5 mg",
          directions: "Take one tablet by mouth every morning.",
          suggestedTimes: ["Morning"],
          quantityReceived: "10 tablets",
          instructions: "Original label instructions.",
          confidence: "medium",
          warnings: ["Verify quantity against bottle."],
          processingPath: "server-side transient frame processing, no permanent image storage"
        })
      });
    });

    await page.goto("/camp/medicine-intake");
    await page.getByLabel("Camper", { exact: true }).selectOption({ label: "Riley Brooks" });
    await page.getByRole("button", { name: "Scan Label" }).click();
    await expect(page.getByRole("heading", { name: "Scan Prescription Label" })).toBeVisible();
    await page.getByLabel("Use Temporary Image").setInputFiles(pngFile("scan-label.png"));
    const reviewDialog = page.getByRole("dialog", { name: "Review Scanned Medication" });
    await expect(reviewDialog).toBeVisible();
    await expect(reviewDialog.getByLabel("Medication name", { exact: true })).toHaveValue("Scanned Camp Med");
    await expect(reviewDialog.getByLabel("Dose / strength")).toHaveValue("5 mg");
    await expect(reviewDialog.getByLabel("Suggested time(s)")).toHaveValue("Morning");
    await expect(reviewDialog.getByLabel("Quantity received")).toHaveValue("10 tablets");
    await expect(reviewDialog.getByText("Verify quantity against bottle.")).toBeVisible();

    await page.getByRole("button", { name: "Save Medication Row" }).click();
    await expect(page.getByText("Reviewed scan row added to this intake session. Complete Intake saves the grouped medication record.")).toBeVisible();
    await expect(reviewDialog).toBeHidden();
    await expect(page.locator("select[aria-label='Camper'] option:checked")).toHaveText("Riley Brooks");
    await expect(page.getByLabel("Camper medication record")).toHaveValue("");
    await expect(page.getByLabel("Medication name/type")).toHaveValue("");
    await expect(page.getByLabel("Dose")).toHaveValue("");
    await expect(page.getByLabel("Scheduled time(s)")).toHaveValue("");
    await expect(page.getByLabel("Quantity received")).toHaveValue("");
    await expect(page.getByLabel("Parent/guardian instructions")).toHaveValue("");
    await expect(page.getByLabel("Staff notes")).toHaveValue("");
    await expect(page.getByRole("region", { name: "Current medications for intake" }).getByText("Scanned Camp Med")).toBeVisible();
    await page.getByRole("button", { name: "Scan Label" }).click();
    await expect(page.getByRole("heading", { name: "Scan Prescription Label" })).toBeVisible();
    await expect(page.getByText("Verify quantity against bottle.")).toHaveCount(0);
    await page.getByRole("button", { name: "Cancel" }).click();
    expect(medicationPostCount).toBe(0);

    await page.getByLabel("Parent/guardian name").fill("Pat Parent");
    await signPadWithWindowTouch(page.getByRole("img", { name: "Parent or guardian signature", exact: true }));
    await page.getByLabel("Parent/guardian handoff details reviewed with staff.").check();
    await page.getByRole("button", { name: "Save medication intake" }).click();
    await expect(page.getByText("Saved. Medication intake recorded with parent/guardian acknowledgement.")).toBeVisible();
    expect(medicationPostCount).toBe(1);
  });

  test("Medicine Intake clears manual medication fields without clearing the active camper draft list", async ({ page }) => {
    await login(page);
    await page.goto("/camp/medicine-intake");

    await page.getByLabel("Camper", { exact: true }).selectOption({ label: "Riley Brooks" });
    await page.getByLabel("Medication name/type").fill("Manual Reset Med");
    await page.getByLabel("Dose").fill("1 tablet");
    await page.getByLabel("Scheduled time(s)").fill("Breakfast");
    await page.getByLabel("Quantity received").fill("12 tablets");
    await page.getByLabel("Parent/guardian instructions").fill("Take with food.");
    await page.getByLabel("Staff notes").fill("Bottle verified.");

    await page.getByRole("button", { name: "Add Medication Manually" }).click();

    await expect(page.locator("select[aria-label='Camper'] option:checked")).toHaveText("Riley Brooks");
    await expect(page.getByLabel("Camper medication record")).toHaveValue("");
    await expect(page.getByLabel("Medication name/type")).toHaveValue("");
    await expect(page.getByLabel("Dose")).toHaveValue("");
    await expect(page.getByLabel("Scheduled time(s)")).toHaveValue("");
    await expect(page.getByLabel("Quantity received")).toHaveValue("");
    await expect(page.getByLabel("Parent/guardian instructions")).toHaveValue("");
    await expect(page.getByLabel("Staff notes")).toHaveValue("");
    await expect(page.getByRole("region", { name: "Current medications for intake" }).getByText("Manual Reset Med")).toBeVisible();

    await page.getByLabel("Parent/guardian name").fill("Pat Parent");
    await signPadWithWindowTouch(page.getByRole("img", { name: "Parent or guardian signature", exact: true }));
    await page.getByLabel("Parent/guardian handoff details reviewed with staff.").check();
    await page.getByRole("button", { name: "Save medication intake" }).click();

    await expect(page.getByText("Saved. Medication intake recorded with parent/guardian acknowledgement.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Current medications for intake" }).getByText("Manual Reset Med")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Current medications for intake" }).getByText("No medications added to this intake session yet.")).toBeVisible();
    await expect(page.getByLabel("Medication name/type")).toHaveValue("");
    await expect(page.getByLabel("Dose")).toHaveValue("");
    await expect(page.getByLabel("Scheduled time(s)")).toHaveValue("");
    await expect(page.getByLabel("Quantity received")).toHaveValue("");
    await expect(page.getByLabel("Parent/guardian instructions")).toHaveValue("");
    await expect(page.getByLabel("Staff notes")).toHaveValue("");
    await expect(page.getByLabel("Parent/guardian name")).toHaveValue("");
    await expect(page.getByLabel("Parent/guardian handoff details reviewed with staff.")).not.toBeChecked();

    await page.getByLabel("Camper", { exact: true }).selectOption({ label: "Avery Johnson" });
    await expect(page.getByLabel("Medication name/type")).toHaveValue("");
    await expect(page.getByLabel("Dose")).toHaveValue("");
    await expect(page.getByLabel("Quantity received")).toHaveValue("");
    await expect(page.getByRole("region", { name: "Current medications for intake" }).getByText("No medications added to this intake session yet.")).toBeVisible();
  });

  test("Medicine Intake saves the record even when background photo upload fails, then retries", async ({ page }) => {
    await login(page);
    let photoAttempts = 0;
    await page.route(/\/api\/camp\/medication\/photos(?:\?|$)/, async (route) => {
      if (route.request().method() === "POST") {
        photoAttempts += 1;
        if (photoAttempts === 1) {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: "Simulated photo upload failure." })
          });
          return;
        }
      }
      await route.continue();
    });

    await page.goto("/camp/medicine-intake");
    await page.getByLabel("Camper medication record").selectOption("med-1");
    await page.getByLabel("Dose").fill("Parent label dose");
    await page.getByLabel("Quantity received").fill("8 tablets");
    await page.getByLabel("Parent/guardian name").fill("Pat Parent");
    await page.getByLabel("Upload photo").setInputFiles(pngFile("medicine-retry.png"));
    await signPadWithWindowTouch(page.getByRole("img", { name: "Parent or guardian signature", exact: true }));
    await page.getByLabel("Parent/guardian handoff details reviewed with staff.").check();
    await page.getByRole("button", { name: "Save medication intake" }).click();

    await expect(page.getByText("Saved. Medication intake recorded with parent/guardian acknowledgement.")).toBeVisible();
    await expect(page.getByText("8 tablets received by Andrew").first()).toBeVisible();
    await expect(page.getByText("Photo upload failed")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry upload" })).toBeVisible();

    await page.getByRole("button", { name: "Retry upload" }).click();
    await expect(page.getByText("Photo uploaded")).toBeVisible();
    await expect(page.getByRole("button", { name: "View Photo" }).first()).toBeVisible();
    expect(photoAttempts).toBe(2);
  });

  test("Edit Camper action stays compact inside tall roster cards", async ({ page }) => {
    await login(page);
    await page.goto("/camp");
    await expect(page.getByText("Camp Oakwood").first()).toBeVisible();
    await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.innerHTML = `
        <button class="camp-student-card camp-student-button" style="height: 220px">
          <span class="camp-avatar">AJ</span>
          <span>
            <strong>Layout Probe</strong>
            <span class="muted">Tall card content</span>
            <span class="button compact-button camp-card-action" data-testid="camp-card-action-probe">Edit Camper</span>
          </span>
        </button>
      `;
      document.body.appendChild(probe);
    });
    const action = page.getByTestId("camp-card-action-probe");
    await expect(action).toBeVisible();
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
    await expect(page.locator(".camp-intake-photo-section .camp-photo-actions .button", { hasText: "Take photo" })).toHaveCSS("color", "rgb(15, 23, 42)");
    await expect(page.locator(".camp-intake-photo-section .camp-photo-actions .button", { hasText: "Upload photo" })).toHaveCSS("color", "rgb(15, 23, 42)");
    await page.getByLabel("Upload photo").setInputFiles(pngFile("mobile-medicine.png"));
    await signPadWithWindowTouch(page.getByRole("img", { name: "Parent or guardian signature", exact: true }));
    await page.getByLabel("Parent/guardian handoff details reviewed with staff.").check();
    await expect(page.getByRole("button", { name: "Save medication intake" })).toBeEnabled();

    await page.goto("/camp/medical-command/administer");
    await page.getByLabel("Medication time block").selectOption({ index: 0 });
    await signPadWithWindowTouch(page.getByRole("img", { name: "Student acknowledgement signature pad" }));
    await expect(page.getByRole("button", { name: "Confirm Administration" })).toBeEnabled();

    await page.goto("/camp/roster");
    await expect(page.getByRole("button", { name: /Avery Johnson/ })).toBeVisible();
    let overviewCallsAfterPhotoSave = 0;
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname === "/api/camp") overviewCallsAfterPhotoSave += 1;
    });
    await page.route(/\/api\/camp\/students\/photo(?:\?|$)/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.continue();
    });
    await page.getByRole("button", { name: /Avery Johnson/ }).click();
    await expect(page.getByText("Camper photo")).toBeVisible();
    await expect(page.locator(".camp-profile-photo-editor .camp-photo-actions .button", { hasText: "Take photo" })).toHaveCSS("color", "rgb(15, 23, 42)");
    await expect(page.locator(".camp-profile-photo-editor .camp-photo-actions .button", { hasText: "Upload photo" })).toHaveCSS("color", "rgb(15, 23, 42)");
    await page.getByLabel("Upload photo").setInputFiles(pngFile("avery.png"));
    await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Photo uploading").first()).toBeVisible();
    await expect(page.getByText("Photo uploaded")).toBeVisible();
    await expect(page.locator(".camp-student-avatar img").first()).toBeVisible();
    await expect.poll(() => overviewCallsAfterPhotoSave).toBe(0);
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

async function signPadWithWindowTouch(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const pointerId = 7;
  const points = [
    { x: box.x + 24, y: box.y + 40 },
    { x: box.x + 78, y: box.y + 86 },
    { x: box.x + 132, y: box.y + 42 }
  ];
  await locator.dispatchEvent("pointerdown", {
    bubbles: true,
    cancelable: true,
    pointerId,
    pointerType: "touch",
    isPrimary: true,
    buttons: 1,
    clientX: points[0].x,
    clientY: points[0].y
  });
  await locator.page().evaluate(
    ({ moves, touchPointerId }) => {
      for (const point of moves) {
        window.dispatchEvent(new PointerEvent("pointermove", {
          bubbles: true,
          cancelable: true,
          pointerId: touchPointerId,
          pointerType: "touch",
          isPrimary: true,
          buttons: 1,
          clientX: point.x,
          clientY: point.y
        }));
      }
    },
    { moves: points.slice(1), touchPointerId: pointerId }
  );
  await locator.page().evaluate(
    ({ point, touchPointerId }) => {
      window.dispatchEvent(new PointerEvent("pointerup", {
        bubbles: true,
        cancelable: true,
        pointerId: touchPointerId,
        pointerType: "touch",
        isPrimary: true,
        buttons: 0,
        clientX: point.x,
        clientY: point.y
      }));
    },
    { point: points[2], touchPointerId: pointerId }
  );
}

function pngFile(name: string) {
  return {
    name,
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR42mP8z8BQDwAFgwJ/lwDW0wAAAABJRU5ErkJggg==", "base64")
  };
}

async function enableMedicationScanForPage(page: Page) {
  await page.route(/\/api\/camp\/medication(?:\?|$)/, async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }

    const response = await route.fetch();
    const body = await response.json() as Record<string, unknown>;
    await route.fulfill({ response, json: { ...body, scanEnabled: true } });
  });
}
