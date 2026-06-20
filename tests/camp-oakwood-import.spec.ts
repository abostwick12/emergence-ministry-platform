import { expect, type Page, test } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 900 } });

test.describe("Camp Oakwood restricted import workflow", () => {
  test("keeps the Oakwood import entry hidden outside restricted access", async ({ page }) => {
    await login(page);
    await page.goto("/camp/more");

    await expect(page.getByRole("link", { name: /Oakwood import preview/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Driver", exact: true }).click();
    await expect(page.getByRole("link", { name: /Oakwood import preview/ })).toHaveCount(0);
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

    const routes = ["/camp", "/camp/teams", "/camp/roster", "/camp/vehicles", "/camp/safety"];
    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator("body")).not.toContainText(/john test/i);
    }

    await page.goto("/camp/more");
    await page.getByRole("button", { name: "Andrew", exact: true }).click();
    await expect(page.locator("body")).not.toContainText(/john test/i);
    await expect(page.locator("body")).not.toContainText(/synthetic john test/i);
  });

  test("previews, requires confirmation, commits, and keeps restricted detail out of Leader Safety", async ({ page }) => {
    await login(page);
    await page.goto("/camp/more");

    await page.getByRole("button", { name: "Andrew", exact: true }).click();
    await expect(page.getByRole("link", { name: /Oakwood import preview/ })).toBeVisible();
    await page.getByRole("link", { name: /Oakwood import preview/ }).click();
    await expect(page.getByRole("heading", { name: "Preview Oakwood roster import" })).toBeVisible();
    await expect(page.getByText("demo/mock Camp roster", { exact: false })).toBeVisible();
    await expect(page.getByText("Real workbook CSV preview mode")).toBeVisible();
    await expect(page.getByText("Production commit unavailable until ready")).toBeVisible();
    await expect(page.getByLabel("Copyable Oakwood sample header row")).toContainText("Registration ID,Name,Selection,Grade,Room Number,T-Shirt Size,Quick Filter,Emergency Contact");

    const csv = [
      "Registration ID,Name,Selection,Grade,Room Number,T-Shirt Size,Quick Filter,Emergency Contact,Medical Notes,Dietary Requirements",
      "70000200,E2E Oakwood Camper,Student,9th,,Adult Small,Medical + Food/Diet,Pat Parent - (555) 333-4444,Private medical note,Peanut-free",
      "70000201,E2E Oakwood Adult,Adult Volunteer,,Suite 1,Adult Large,No Concern,,,,"
    ].join("\n");

    await page.getByLabel("Source file").fill("Camp_Quick_View_E2E.csv");
    await page.getByLabel("Quick View CSV rows").fill(csv);
    await page.getByRole("button", { name: "Preview Oakwood import" }).click();

    await expect(page.getByText("Oakwood preview ready", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("New campers")).toBeVisible();
    await expect(page.getByText("New staff")).toBeVisible();
    await expect(page.getByText("Safe-data changes")).toBeVisible();
    await expect(page.getByText("Restricted-data changes")).toBeVisible();
    await expect(page.getByText("E2E Oakwood Camper").first()).toBeVisible();
    await expect(page.getByText("E2E Oakwood Adult").first()).toBeVisible();

    const saveButton = page.getByRole("button", { name: "Save confirmed Oakwood import" });
    await expect(saveButton).toBeDisabled();
    await page.getByLabel(/I reviewed this Oakwood preview/).check();
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    await expect(page.getByText("Oakwood import saved: 2 rows committed.").first()).toBeVisible();

    await page.goto("/camp/safety");
    await expect(page.getByText("E2E Oakwood Camper")).toBeVisible();
    await expect(page.getByText("Medical alert on file", { exact: false })).toBeVisible();
    await expect(page.getByText("Dietary note on file")).toBeVisible();
    await expect(page.getByText("Emergency contact available")).toBeVisible();

    const body = (await page.locator("body").textContent()) ?? "";
    expect(body).not.toContain("Private medical note");
    expect(body).not.toContain("555");
    expect(body).not.toContain("Pat Parent");
    expect(body).not.toContain("Peanut-free");
  });
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_TEST_EMAIL ?? "staff@example.com");
  await page.getByLabel("Password").fill(process.env.E2E_TEST_PASSWORD ?? "password");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/dashboard$/);
}
