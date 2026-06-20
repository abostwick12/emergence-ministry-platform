import { expect, type Page, test } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 900 } });

test.describe("Camp Oakwood restricted import workflow", () => {
  test.describe.configure({ mode: "serial" });

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

  test("loads an upload preview, requires confirmation, and avoids duplicate success alerts", async ({ page }) => {
    await login(page);
    let commitRequests = 0;
    let uploadRequests = 0;
    await page.route("**/api/camp/import/upload?role=andrew", async (route) => {
      uploadRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(uploadRequests === 1
          ? { files: [{ slot: "combinedFile", scope: "full_roster", fileName: "camp-oakwood.xlsx", kind: "xlsx", sheetNames: ["Summary", "Quick View"] }] }
          : { preview: uploadPreview({ matchStatus: "new" }) })
      });
    });
    await page.route("**/api/camp/import?role=andrew", async (route) => {
      const body = route.request().postDataJSON() as { action?: string; confirmed?: boolean };
      if (body.action === "oakwoodCommit") {
        commitRequests += 1;
        await route.fulfill({
          status: body.confirmed ? 200 : 400,
          contentType: "application/json",
          body: JSON.stringify(body.confirmed
            ? { result: { committed: [{ rowNumber: 3, personType: "adult", action: "created", id: "staff-1", name: "E2E Oakwood Adult" }], auditBatch: { id: "batch-1" } } }
            : { error: "Oakwood import confirmation is required before commit." })
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/camp/more");

    await page.getByRole("button", { name: "Andrew", exact: true }).click();
    await expect(page.getByRole("link", { name: /Oakwood import preview/ })).toBeVisible();
    await page.getByRole("link", { name: /Oakwood import preview/ }).click();
    await expect(page.getByRole("heading", { name: "Upload Oakwood roster file" })).toBeVisible();
    await expect(page.getByText("Restricted server preview")).toBeVisible();
    await expect(page.getByText("Combined or split sources")).toBeVisible();
    await expect(page.getByText("Production commit unavailable until ready")).toBeVisible();
    await expect(page.getByLabel("Quick View CSV rows")).toHaveCount(0);

    const inspectButton = page.getByRole("button", { name: "Inspect worksheets" });
    const previewButton = page.getByRole("button", { name: "Preview uploaded roster" });
    const saveButton = page.getByRole("button", { name: "Save confirmed Oakwood import" });
    await expect(inspectButton).toBeDisabled();
    await expect(previewButton).toBeDisabled();
    await expect(saveButton).toBeDisabled();

    await page.getByLabel("Reviewer source label").fill("Camp Oakwood Staff Sheet");
    await page.getByLabel("Combined roster file").setInputFiles({
      name: "camp-oakwood.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from("fake workbook")
    });
    await expect(inspectButton).toBeEnabled();
    await expect(previewButton).toBeDisabled();
    await inspectButton.click();
    await page.getByLabel("Combined roster file worksheet").selectOption("Quick View");
    await expect(previewButton).toBeEnabled();
    await previewButton.click();

    await expect(page.getByText("Oakwood upload preview ready", { exact: false })).toHaveCount(1);
    await expect(page.getByText("New staff").first()).toBeVisible();
    await expect(page.getByText("Matched staff updates").first()).toBeVisible();
    await expect(page.getByText("Skipped and invalid rows").first()).toBeVisible();
    await expect(page.getByText("Safe-data changes").first()).toBeVisible();
    await expect(page.getByText("Restricted-data changes").first()).toBeVisible();
    await expect(page.getByText("E2E Oakwood Adult").first()).toBeVisible();
    await expect(page.getByText("E2E Oakwood Camper").first()).toBeVisible();
    await expect(page.getByText("Uploaded: camp-oakwood.xlsx", { exact: false })).toBeVisible();

    await expect(saveButton).toBeDisabled();
    expect(commitRequests).toBe(0);
    await page.getByLabel(/I reviewed this Oakwood preview/).check();
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    await expect(page.getByText("Oakwood import saved: 1 rows committed.")).toBeVisible();
    expect(commitRequests).toBe(1);
  });

  test("keeps upload save disabled for ambiguous or invalid previews", async ({ page }) => {
    await login(page);
    await page.route("**/api/camp/import/upload?role=andrew", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ preview: uploadPreview({ matchStatus: "ambiguous", ambiguousCount: 1 }) })
      });
    });
    await page.route("**/api/camp/import?role=andrew", async (route) => {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Save should not be called." }) });
    });

    await page.goto("/camp/more");
    await page.getByRole("button", { name: "Andrew", exact: true }).click();
    await page.getByRole("link", { name: /Oakwood import preview/ }).click();
    await page.getByLabel("Combined roster file").setInputFiles({
      name: "camp-oakwood.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Registration ID,Name,Selection\n70000201,E2E Oakwood Adult,Adult Volunteer")
    });
    await page.getByRole("button", { name: "Preview uploaded roster" }).click();
    await expect(page.getByText("Ambiguous rows")).toBeVisible();

    const saveButton = page.getByRole("button", { name: "Save confirmed Oakwood import" });
    await expect(saveButton).toBeDisabled();
    await expect(page.getByText("Resolve ambiguous or invalid rows before saving.")).toBeVisible();
    await expect(saveButton).toBeDisabled();
  });
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_TEST_EMAIL ?? "staff@example.com");
  await page.getByLabel("Password").fill(process.env.E2E_TEST_PASSWORD ?? "password");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/dashboard$/);
}

function uploadPreview({ matchStatus, ambiguousCount = 0 }: { matchStatus: "new" | "ambiguous"; ambiguousCount?: number }) {
  return {
    sourceFile: "Camp Oakwood Upload",
    sourceKind: "upload",
    importScope: "full_roster",
    uploadSources: [
      {
        fileName: "camp-oakwood.xlsx",
        checksumSha256: "abc123def456abc123def456abc123def456abc123def456abc123def456abcd",
        sheetName: "Quick View",
        scope: "full_roster",
        rowCount: 2
      }
    ],
    rows: [
      {
        rowNumber: 2,
        matchStatus: "new",
        personType: "student",
        warnings: [],
        person: {
          name: "E2E Oakwood Camper",
          grade: "9th",
          cabin: "Room 1",
          shirtSize: "Adult Small",
          registrationExternalId: "70000200",
          teamName: "",
          vehicleName: ""
        },
        safeIndicators: { emergencyContactOnFile: false, hasMedicalAlert: false, hasDietaryAlert: false }
      },
      {
        rowNumber: 3,
        matchStatus,
        personType: "adult",
        warnings: matchStatus === "ambiguous" ? ["Name matches multiple existing staff records - manual resolution required."] : [],
        person: {
          name: "E2E Oakwood Adult",
          grade: "",
          cabin: "Suite 1",
          shirtSize: "Adult Large",
          registrationExternalId: "70000201",
          teamName: "",
          vehicleName: ""
        },
        safeIndicators: { emergencyContactOnFile: false, hasMedicalAlert: false, hasDietaryAlert: false },
        matchCandidateCount: ambiguousCount
      }
    ],
    summary: {
      totalSourceRows: 2,
      personRows: 2,
      students: 1,
      adults: 1,
      newCount: matchStatus === "new" ? 2 : 1,
      matchedCount: 0,
      ambiguousCount,
      skippedCount: 0,
      invalidCount: 0,
      safeFieldRows: matchStatus === "new" ? 2 : 1,
      restrictedRecordRows: 1,
      staffRows: matchStatus === "new" ? 1 : 0
    }
  };
}
