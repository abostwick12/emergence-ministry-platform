import { expect, type Page, test } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 900 } });

test.describe("Camp Oakwood restricted import boundaries", () => {
  test("keeps the Oakwood import entry out of the Camp More launcher", async ({ page }) => {
    await login(page);
    await page.goto("/camp/more");

    await expect(page.getByRole("link", { name: /Oakwood import preview/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Andrew", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Driver", exact: true })).toHaveCount(0);
  });

  test("Camp Settings exposes roster import route for Andrew's authenticated admin access", async ({ page }) => {
    await login(page);

    await page.goto("/camp");
    await page.getByRole("navigation", { name: "Camp sections" }).getByRole("link", { name: "More", exact: true }).click();
    await page.getByRole("link", { name: "Camp Settings" }).click();
    await page.getByRole("link", { name: "Import Camp Roster" }).click();
    await page.waitForURL(/\/camp\/settings\/import$/);
    await expect(page.getByRole("heading", { name: "Import Camp Roster" })).toBeVisible();
    await expect(page.getByText("no roster data is saved automatically on upload")).toBeVisible();
  });

  test("Camp Settings exposes Partner Church Upload for reviewed camper spreadsheets", async ({ page }) => {
    await login(page);

    await page.goto("/camp/more");
    await page.getByRole("link", { name: "Camp Settings" }).click();
    await page.getByRole("link", { name: "Partner Church Upload" }).click();
    await page.waitForURL(/\/camp\/settings\/import\?mode=partner$/);
    await expect(page.getByRole("heading", { name: "Partner Church Upload" })).toBeVisible();
    await expect(page.getByText("Required fields are camper name and partner church/source church")).toBeVisible();
  });

  test("Andrew can find and edit imported leader staff details", async ({ page }) => {
    await login(page);

    const csv = [
      "Registration ID,Name,Selection,Grade,Room Number,T-Shirt Size,Team,Quick Filter,Emergency Contact",
      "70001994,Playwright Staff Leader,Adult Volunteer,,Leader Cabin,Adult Large,Blue Team,No Concern,"
    ].join("\n");
    const preview = await page.request.post("/api/camp/import?role=andrew", {
      data: {
        action: "oakwoodPreview",
        csv,
        sourceFile: "Playwright_Staff.csv"
      }
    });
    expect(preview.ok()).toBe(true);
    const previewPayload = await preview.json();
    const commit = await page.request.post("/api/camp/import?role=andrew", {
      data: {
        action: "oakwoodCommit",
        oakwoodPreview: previewPayload.preview,
        confirmed: true
      }
    });
    expect(commit.ok()).toBe(true);

    await page.goto("/camp/more");
    await page.getByRole("link", { name: "Leader / Staff Details" }).click();
    await page.waitForURL(/\/camp\/settings\/staff$/);
    await expect(page.getByRole("heading", { name: "Leader / Staff Details" })).toBeVisible();
    await expect(page.getByText("Playwright Staff Leader")).toBeVisible();
    await expect(page.getByText("Oakwood registration ID: 70001994")).toBeVisible();

    await page.getByRole("button", { name: "Edit Details" }).click();
    await page.getByLabel("Display name").fill("Playwright Staff Leader Edited");
    await page.getByLabel("Role / type").selectOption("leader");
    await page.getByLabel("Team assignment").selectOption("team-red");
    await page.getByLabel("Shirt size").fill("Adult Medium");
    await page.getByRole("button", { name: "Save Staff Details" }).click();

    await expect(page.getByText("Staff details saved.")).toBeVisible();
    await expect(page.getByText("Playwright Staff Leader Edited")).toBeVisible();
    await expect(page.getByText("Parent medical note")).toHaveCount(0);
  });

  test("removes synthetic john test from active Camp views through the restricted archive workflow", async ({ page }) => {
    await login(page);

    const create = await page.request.post("/api/camp/students?role=andrew", {
      data: {
        name: "john test",
        grade: "9th",
        teamId: "team-blue",
        vehicleId: "van-1",
        cabin: "Test Cabin",
        limitedSafetyFlags: ["Hydration reminder"]
      }
    });
    expect(create.ok()).toBe(true);
    const created = await create.json();
    const studentId = created.student.id as string;

    const restrictedMedical = await page.request.patch("/api/camp/restricted-medical?role=andrew", {
      data: {
        studentId,
        studentName: "john test",
        medicalFormStatus: "Received",
        restrictedNotes: "synthetic john test restricted note",
        allergyNotes: "",
        insuranceStatus: "",
        emergencyContactName: "Synthetic Parent",
        emergencyContactPhone: "555-0000",
        emergencyContactRelationship: "Parent",
        parentMedicalNotes: ""
      }
    });
    expect(restrictedMedical.ok()).toBe(true);

    const medication = await page.request.post("/api/camp/medication?role=andrew", {
      data: {
        studentId,
        medicationName: "synthetic john test medication",
        parentProvidedInstructions: "",
        checkInStatus: "Not Checked In",
        clarificationStatus: "Clear"
      }
    });
    expect(medication.ok()).toBe(true);

    const archive = await page.request.patch("/api/camp/students?role=andrew", {
      data: {
        action: "archive",
        studentId,
        archiveReason: "Synthetic production cleanup"
      }
    });
    expect(archive.ok()).toBe(true);

    const routes = ["/camp", "/camp/teams", "/camp/roster", "/camp/vehicles", "/camp/safety", "/camp/more"];
    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator("body")).not.toContainText(/john test/i);
      await expect(page.locator("body")).not.toContainText(/synthetic john test/i);
    }
  });
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_TEST_EMAIL ?? "staff@example.com");
  await page.getByLabel("Password").fill(process.env.E2E_TEST_PASSWORD ?? "password");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/dashboard$/);
}
