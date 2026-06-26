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

    await page.goto("/camp/settings/import?mode=partner");
    await expect(page.getByRole("heading", { name: "Partner Church Upload" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Partner church roster import" }).getByText("Only student name is required. Team and other details can be added now or edited later.", { exact: true })).toBeVisible();
  });

  test("partner church campers stay out of default roster but appear in partner and team views", async ({ page }) => {
    await login(page);

    const camperName = "Playwright Partner Camper";
    const sourceChurch = "Playwright Partner Church";
    const preview = await page.request.post("/api/camp/import?role=andrew", {
      data: {
        action: "preview",
        sourceType: "partnerChurch",
        sourceName: "Partner Church Upload",
        csv: [
          "Student Name,Team,Partner Church,Room/Cabin,Shirt Size",
          `${camperName},Blue,${sourceChurch},Partner Cabin,Adult Small`
        ].join("\n")
      }
    });
    expect(preview.ok()).toBe(true);
    const previewPayload = await preview.json();
    expect(previewPayload.preview.rows[0].camper).toMatchObject({ rosterType: "partner", sourceChurch });

    const commit = await page.request.post("/api/camp/import?role=andrew", {
      data: {
        action: "commit",
        preview: previewPayload.preview
      }
    });
    expect(commit.ok()).toBe(true);

    await page.goto("/camp/roster");
    await expect(page.getByRole("heading", { name: "Roster" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(camperName);

    await page.goto("/camp/partner-campers");
    await expect(page.getByRole("heading", { name: "Partner Church Campers" })).toBeVisible();
    await expect(page.getByText(camperName)).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(`${camperName}.*${sourceChurch}`) })).toBeVisible();
    await expect(page.getByText("Adult Small")).toBeVisible();
    await expect(page.getByText("Partner Cabin")).toBeVisible();

    await page.goto("/camp/teams/team-blue");
    const teamRoster = page.getByRole("region", { name: "Team roster" });
    await expect(teamRoster.getByText(camperName)).toBeVisible();
    await expect(teamRoster.getByText(`Partner Church: ${sourceChurch}`)).toBeVisible();
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
    const staffPhotoUrl = "https://photos.example.test/playwright-staff.jpg";
    await page.getByLabel("Profile photo URL").fill(staffPhotoUrl);
    await page.getByLabel("Display name").fill("Playwright Staff Leader Edited");
    await page.getByLabel("Role / type").selectOption("leader");
    await page.getByLabel("Team assignment").selectOption("team-red");
    await page.getByLabel("Shirt size").fill("Adult Medium");
    await page.getByLabel("Partner/source church").fill("Playwright Partner Church");
    await page.getByRole("button", { name: "Save Staff Details" }).click();

    await expect(page.getByText("Staff details saved.")).toBeVisible();
    await expect(page.getByText("Playwright Staff Leader Edited")).toBeVisible();
    await expect(page.getByText("Source church: Playwright Partner Church")).toBeVisible();
    await expect(page.locator(`img[src="${staffPhotoUrl}"]`).first()).toBeVisible();
    await expect(page.getByText("Parent medical note")).toHaveCount(0);

    const teamUpdate = await page.request.patch("/api/camp/teams?role=andrew", {
      data: {
        id: "team-red",
        name: "Red",
        color: "Red",
        leader: "Playwright Staff Leader Edited",
        coLeader: "Playwright Staff Leader Edited",
        room: "Playwright Room",
        notes: "Playwright team note"
      }
    });
    expect(teamUpdate.ok()).toBe(true);

    await page.goto("/camp/teams");
    await expect(page.locator(`img[src="${staffPhotoUrl}"]`).first()).toBeVisible();
    await page.getByRole("button", { name: /Open Red team menu/ }).click();
    await expect(page.getByRole("dialog", { name: /Red Team/ }).locator(`img[src="${staffPhotoUrl}"]`)).toHaveCount(2);

    await page.goto("/camp/teams/team-red");
    await expect(page.getByRole("region", { name: "Team Bulletin" })).toBeVisible();
    await expect(page.locator(`img[src="${staffPhotoUrl}"]`)).toHaveCount(2);
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
