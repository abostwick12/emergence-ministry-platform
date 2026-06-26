import { expect, type Page, test } from "@playwright/test";

// Primary mobile design target.
test.use({ viewport: { width: 375, height: 812 } });

test.describe("Camp mobile Command Center", () => {
  test("all Camp routes load with their headings", async ({ page }) => {
    await login(page);

    const routes: Array<[string, RegExp]> = [
      ["/camp", /Camp Oakwood/],
      ["/camp/teams", /Teams/],
      ["/camp/roster", /Roster/],
      ["/camp/schedule", /Schedule/],
      ["/camp/vehicles", /Transportation/],
      ["/camp/more", /More Camp tools/]
    ];
    for (const [path, text] of routes) {
      await page.goto(path);
      await expect(page.getByText(text).first()).toBeVisible();
    }
  });

  test("mobile operational pages expose stable card hooks", async ({ page }) => {
    await login(page);

    await page.goto("/camp/teams");
    await expect(page.getByTestId("camp-team-card-team-blue")).toBeVisible();

    await page.goto("/camp/roster");
    await expect(page.getByTestId("camp-student-card-stu-1")).toBeVisible();

    await page.goto("/camp/schedule");
    await expect(page.locator("[data-testid^='camp-schedule-card-']").first()).toBeVisible();

    await page.goto("/camp/vehicles");
    await expect(page.locator("[data-testid^='camp-vehicle-card-']").first()).toBeVisible();

    await page.goto("/camp/forms");
    await expect(page.locator("[data-testid^='camp-document-card-']").first()).toBeVisible();

    await page.goto("/camp/medical-command/administer");
    await expect(page.getByTestId("camp-medication-admin-card-med-sched-1")).toBeVisible();
  });

  test("roster cards show safe quick-reference fields and distinct safety badges", async ({ page }) => {
    await login(page);

    const create = await page.request.post("/api/camp/students?role=andrew", {
      data: {
        name: "Playwright Badge Camper",
        grade: "11th",
        teamId: "team-blue",
        vehicleId: "van-1",
        cabin: "Cabin Z",
        shirtSize: "Adult Small",
        hasDietaryAlert: true,
        hasMedicalAlert: true,
        limitedSafetyFlags: ["Partner church: Test Church"]
      }
    });
    expect(create.ok()).toBe(true);
    const created = await create.json() as { student: { id: string } };

    await page.goto("/camp/roster");
    const card = page.getByTestId(`camp-student-card-${created.student.id}`);
    await expect(card).toContainText("Shirt");
    await expect(card).toContainText("Adult Small");
    await expect(card).toContainText("Room");
    await expect(card).toContainText("Cabin Z");
    await expect(card).toContainText("Food allergy");
    await expect(card).toContainText("Medical concern");

    const allergyColor = await card.locator(".camp-cc-tag.food").evaluate((element) => getComputedStyle(element).color);
    const medicalColor = await card.locator(".camp-cc-tag.medical").evaluate((element) => getComputedStyle(element).color);
    expect(allergyColor).not.toBe(medicalColor);
    await expect(card).not.toContainText("Parent-labeled medication");
  });

  test("mobile bottom navigation stays above scrolled cards with final content clear", async ({ page }) => {
    await keepNextDevPortalOffPointerPath(page);
    await login(page);
    await page.goto("/camp/roster");
    await suppressNextDevPortal(page);
    const lastCard = page.locator("[data-testid^='camp-student-card-']").last();
    await expect(lastCard).toBeVisible();

    await lastCard.evaluate((element) => {
      const nav = document.querySelector("nav[aria-label='Camp sections']");
      const scrollers = [
        ...Array.from(document.querySelectorAll<HTMLElement>(".app-main-shell-camp, .app-shell-camp")),
        document.scrollingElement
      ].filter(Boolean) as Array<HTMLElement | Element>;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const navTop = nav?.getBoundingClientRect().top ?? window.innerHeight;
        const overlap = element.getBoundingClientRect().bottom - navTop + 14;
        if (overlap <= 0) break;
        for (const scroller of scrollers) scroller.scrollTop += overlap;
        window.scrollBy(0, overlap);
      }
    });
    await page.waitForTimeout(100);

    const nav = page.getByRole("navigation", { name: "Camp sections" });
    await expect(nav).toBeVisible();
    const navBox = await nav.boundingBox();
    const lastCardBox = await lastCard.boundingBox();
    expect(navBox).not.toBeNull();
    expect(lastCardBox).not.toBeNull();
    if (!navBox || !lastCardBox) return;

    const navIsTopLayer = await page.evaluate(({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      return Boolean(element?.closest("nav[aria-label='Camp sections']"));
    }, { x: navBox.x + navBox.width / 2, y: navBox.y + navBox.height / 2 });

    expect(navIsTopLayer).toBe(true);
    expect(lastCardBox.y + lastCardBox.height).toBeLessThan(navBox.y);
  });

  test("mobile bottom navigation stays clear on schedule tools and operational pages", async ({ page }) => {
    await keepNextDevPortalOffPointerPath(page);
    await login(page);

    for (const [path, finalLocator] of [
      ["/camp/schedule", "[data-testid^='camp-schedule-card-']"],
      ["/camp/more", ".camp-more-tile"],
      ["/camp/vehicles", "[data-testid^='camp-vehicle-card-']"],
      ["/camp/teams", "[data-testid^='camp-team-card-']"]
    ] as const) {
      await page.goto(path);
      await suppressNextDevPortal(page);
      await page.evaluate(() => {
        for (const scroller of Array.from(document.querySelectorAll<HTMLElement>(".app-main-shell-camp, .app-shell-camp"))) {
          scroller.scrollTop = 0;
        }
        window.scrollTo(0, 0);
      });
      const finalCard = page.locator(finalLocator).last();
      await expect(finalCard).toBeVisible();
      await page.waitForTimeout(300);
      await finalCard.evaluate((element) => {
        const nav = document.querySelector("nav[aria-label='Camp sections']");
        const scrollers = [
          ...Array.from(document.querySelectorAll<HTMLElement>(".app-main-shell-camp, .app-shell-camp")),
          document.scrollingElement
        ].filter(Boolean) as Array<HTMLElement | Element>;
        for (let attempt = 0; attempt < 4; attempt += 1) {
          const navTop = nav?.getBoundingClientRect().top ?? window.innerHeight;
          const overlap = element.getBoundingClientRect().bottom - navTop + 14;
          if (overlap <= 0) break;
          for (const scroller of scrollers) scroller.scrollTop += overlap;
          window.scrollBy(0, overlap);
        }
      });
      await page.waitForTimeout(100);

      const nav = page.getByRole("navigation", { name: "Camp sections" });
      await expect(nav).toBeVisible();
      const navBox = await nav.boundingBox();
      const finalCardBox = await finalCard.boundingBox();
      expect(navBox).not.toBeNull();
      expect(finalCardBox).not.toBeNull();
      if (!navBox || !finalCardBox) continue;

      expect(finalCardBox.y + finalCardBox.height).toBeLessThan(navBox.y);
    }
  });

  test("mobile bottom navigation reaches each section", async ({ page }) => {
    await keepNextDevPortalOffPointerPath(page);
    await login(page);
    await page.goto("/camp");

    const nav = page.getByRole("navigation", { name: "Camp sections" });
    await suppressNextDevPortal(page);
    await nav.getByRole("link", { name: "Teams", exact: true }).click();
    await page.waitForURL(/\/camp\/teams$/);
    await expect(page.getByRole("heading", { name: "Teams" })).toBeVisible();

    await expect(nav.getByRole("link", { name: "Schedule", exact: true })).toHaveCount(0);

    await suppressNextDevPortal(page);
    await nav.getByRole("button", { name: "Open EMMA Camp Finder" }).click();
    await expect(page.getByRole("dialog", { name: "Find anything fast" })).toBeVisible();
    await page.getByRole("searchbox", { name: "Smart Camp Search" }).fill("Where is Avery?");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByText(/Avery Johnson/)).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Parent-labeled medication");

    await page.getByRole("button", { name: "Close EMMA" }).click();
    await suppressNextDevPortal(page);
    await nav.getByRole("link", { name: "Roster", exact: true }).click();
    await page.waitForURL(/\/camp\/roster$/);
    await expect(page.getByRole("heading", { name: "Roster" })).toBeVisible();

    await suppressNextDevPortal(page);
    await nav.getByRole("link", { name: "Home", exact: true }).click();
    await page.waitForURL(/\/camp$/);
  });

  test("day selector changes the Next Up content", async ({ page }) => {
    await login(page);
    await page.goto("/camp");

    await expect(page.getByText("Registration")).toBeVisible();

    await page.getByRole("tab", { name: /Tue/ }).click();
    await expect(page.getByText("Wake Up")).toBeVisible();
    await expect(page.getByText("Registration")).toHaveCount(0);
  });

  test("team cards never expose restricted medical content", async ({ page }) => {
    await login(page);
    await page.goto("/camp/teams");

    await page.getByRole("button", { name: /Open Blue team menu/ }).click();
    await expect(page.getByRole("dialog", { name: /Blue Team/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Manage Team", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "View Team" })).toBeVisible();

    const body = (await page.locator("body").textContent()) ?? "";
    for (const needle of ["Parent-labeled medication", "Insurance card", "dosage", "guardianSignature", "allergyNotes"]) {
      expect(body).not.toContain(needle);
    }
  });

  test("schedule cards separate location and notes and keep detail/edit actions usable", async ({ page }) => {
    await login(page);
    const create = await page.request.post("/api/camp/schedule", {
      data: {
        title: "Playwright Location Notes Drill",
        day: "Mon, Jun 29",
        time: "4:44 PM-5:00 PM",
        date: "2026-06-29",
        startTime: "16:44",
        endTime: "17:00",
        location: "Main hall next to cafeteria",
        audience: "Leaders",
        notes: "Have shirt size ready",
        status: "Needs Review",
        visibility: "Leaders Only"
      }
    });
    expect(create.ok()).toBe(true);
    const created = await create.json() as { item: { id: string } };

    await page.goto("/camp/schedule");
    const card = page.getByTestId(`camp-schedule-card-${created.item.id}`);
    await expect(card).toContainText("4:44 PM-5:00 PM");
    await expect(card).toContainText("Playwright Location Notes Drill");
    await expect(card.locator(".camp-schedule-meta-chip.location")).toContainText("Location");
    await expect(card.locator(".camp-schedule-meta-chip.location")).toContainText("Main hall next to cafeteria");
    await expect(card.locator(".camp-schedule-meta-chip.location")).not.toContainText("Have shirt size ready");
    await expect(card.locator(".camp-schedule-note")).toContainText("Notes");
    await expect(card.locator(".camp-schedule-note")).toContainText("Have shirt size ready");

    await card.getByRole("button", { name: /Open Playwright Location Notes Drill schedule details/ }).click();
    const detail = page.getByRole("dialog", { name: "Playwright Location Notes Drill" });
    await expect(detail).toContainText("Event");
    await expect(detail).toContainText("Time");
    await expect(detail).toContainText("Location");
    await expect(detail).toContainText("Audience");
    await expect(detail).toContainText("Status");
    await expect(detail).toContainText("Notes");

    await detail.getByRole("button", { name: "Edit", exact: true }).click();
    const editor = page.getByRole("dialog", { name: "Edit Schedule Item" });
    await expect(editor).toBeVisible();
    await editor.getByRole("textbox", { name: "Location" }).fill("Main hall by cafeteria doors");
    await editor.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Schedule saved. Home and Next Up now use the updated schedule.")).toBeVisible();
    await expect(page.getByTestId(`camp-schedule-card-${created.item.id}`).locator(".camp-schedule-meta-chip.location")).toContainText("Main hall by cafeteria doors");
  });

  test("schedule cards render notes without an ambiguous blank location", async ({ page }) => {
    await login(page);
    const create = await page.request.post("/api/camp/schedule", {
      data: {
        title: "Playwright Notes Only Drill",
        day: "Mon, Jun 29",
        time: "5:05 PM",
        date: "2026-06-29",
        startTime: "17:05",
        location: "",
        audience: "All Camp",
        notes: "Bring water bottles",
        status: "Planned",
        visibility: "All Camp"
      }
    });
    expect(create.ok()).toBe(true);
    const created = await create.json() as { item: { id: string } };

    await page.goto("/camp/schedule");
    const card = page.getByTestId(`camp-schedule-card-${created.item.id}`);
    await expect(card).toContainText("Playwright Notes Only Drill");
    await expect(card.locator(".camp-schedule-meta-chip.location")).toHaveCount(0);
    await expect(card.locator(".camp-schedule-note")).toContainText("Notes");
    await expect(card.locator(".camp-schedule-note")).toContainText("Bring water bottles");
  });

  test("More tools launcher preserves role-aware visibility", async ({ page }) => {
    await login(page);
    const overview = await page.request.get("/api/camp");
    expect(overview.ok()).toBe(true);
    const payload = await overview.json();
    await page.route("**/api/camp", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          ...payload,
          capabilities: { restrictedMedical: false, medicalCommand: false, operationsCommand: false }
        }
      });
    });

    await page.goto("/camp/more");
    await expect(page.getByRole("heading", { name: "Camp Menu" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Full Schedule" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Restricted Workflows" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Admin Tools" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Medicine Intake / Return" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Medical Dashboard" })).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("Parent-labeled medication");
  });

  test("Andrew bootstrap sees Medical Command automatically without a role selector", async ({ page }) => {
    await login(page);
    await page.goto("/camp");

    await expect(page.getByRole("button", { name: "Medical Command" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Andrew", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Jaci", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Driver", exact: true })).toHaveCount(0);
  });

  test("Andrew uses unified Smart Camp Search without leaking restricted record text", async ({ page }) => {
    await login(page);
    await page.goto("/camp");

    await page.getByRole("button", { name: "Open EMMA Camp Finder" }).click();
    const sheet = page.getByRole("dialog", { name: "Find anything fast" });
    await expect(sheet).toBeVisible();
    // Smart Search and Ask EMMA are collapsed into one search - no separate tab inside the sheet.
    await expect(sheet.getByRole("tab")).toHaveCount(0);
    await page.getByRole("searchbox", { name: "Smart Camp Search" }).fill("What medication dose does Avery need?");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByText(/restricted medical details are not available/i)).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Parent-labeled medication");
  });

  test("More separates Andrew medication workflows", async ({ page }) => {
    await login(page);
    await page.goto("/camp");

    await page.getByRole("navigation", { name: "Camp sections" }).getByRole("link", { name: "More", exact: true }).click();
    await page.waitForURL(/\/camp\/more$/);
    await expect(page.getByRole("link", { name: "Medical Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Administer Medicine" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Medicine Intake / Return" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Medication Schedule" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Medication History & Corrections" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Medical Quick View" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Partner Church Upload" })).toBeVisible();
  });

  test("vehicle and team edit modals keep save actions functional", async ({ page }) => {
    await login(page);

    await page.goto("/camp/vehicles");
    await page.getByRole("button", { name: "Edit Vehicle" }).first().click();
    const vehicleEditor = page.getByRole("dialog", { name: "Edit Vehicle" });
    await expect(vehicleEditor).toContainText("Vehicle");
    await expect(vehicleEditor).toContainText("Departure");
    await expect(vehicleEditor).toContainText("Riders");
    await vehicleEditor.getByRole("textbox", { name: "Notes" }).fill("Playwright vehicle note");
    await vehicleEditor.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Vehicle saved and rider counts refreshed.")).toBeVisible();

    await page.goto("/camp/teams");
    await page.getByRole("button", { name: /Open Blue team menu/ }).click();
    await page.getByRole("dialog", { name: /Blue Team/ }).getByRole("button", { name: "Manage Team", exact: true }).click();
    const teamEditor = page.getByRole("dialog", { name: "Manage Team" });
    await expect(teamEditor).toContainText("Leaders");
    await teamEditor.getByRole("textbox", { name: "Notes" }).fill("Playwright team note");
    await teamEditor.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Team saved and counts refreshed.")).toBeVisible();
  });

  test("vehicle assignment dropdown uses the CLC emergency roster boundary", async ({ page }) => {
    await login(page);
    const overview = await page.request.get("/api/camp?role=andrew");
    expect(overview.ok()).toBe(true);
    const payload = await overview.json();
    const baseStudent = payload.students[0];
    const runId = Date.now();
    await page.route("**/api/camp", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          ...payload,
          students: [
            ...payload.students,
            { ...baseStudent, id: `vehicle-clc-${runId}`, name: "Playwright CLC Vehicle Camper", rosterType: "emerge", sourceChurch: "", vehicleId: "", vehicleName: "Unassigned", limitedSafetyFlags: [] },
            { ...baseStudent, id: `vehicle-partner-${runId}`, name: "Playwright Partner Vehicle Camper", rosterType: "partner", sourceChurch: "Grace Chapel", vehicleId: "", vehicleName: "Unassigned", limitedSafetyFlags: [] },
            { ...baseStudent, id: `vehicle-source-only-${runId}`, name: "Playwright Source Only Vehicle Camper", rosterType: undefined, sourceChurch: "Partner Only Church", vehicleId: "", vehicleName: "Unassigned", limitedSafetyFlags: [] }
          ]
        }
      });
    });

    await page.goto("/camp/vehicles");
    await page.getByRole("button", { name: "Edit Vehicle" }).first().click();
    const editor = page.getByRole("dialog", { name: "Edit Vehicle" });
    const optionText = await editor.getByLabel("Camper to assign").locator("option").allTextContents();
    expect(optionText.join("\n")).toContain("Playwright CLC Vehicle Camper");
    expect(optionText.join("\n")).not.toContain("Playwright Partner Vehicle Camper");
    expect(optionText.join("\n")).not.toContain("Playwright Source Only Vehicle Camper");
  });

  test("teams page assigns and removes campers without opening the full roster editor", async ({ page }) => {
    await login(page);
    const camperName = `Playwright Team Assign Camper ${Date.now()}`;
    const create = await page.request.post("/api/camp/students?role=andrew", {
      data: {
        name: camperName,
        grade: "",
        teamId: "",
        vehicleId: "",
        cabin: "",
        limitedSafetyFlags: []
      }
    });
    expect(create.ok()).toBe(true);
    const created = await create.json() as { student: { id: string } };

    await page.goto("/camp/teams");
    await page.getByRole("button", { name: /Open Blue team menu/ }).click();
    await page.getByRole("dialog", { name: /Blue Team/ }).getByRole("button", { name: "Manage Team", exact: true }).click();
    const blueDialog = page.getByRole("dialog", { name: "Manage Team" });
    await expect(blueDialog.getByRole("region", { name: "Blue camper assignments" })).toBeVisible();
    await blueDialog.getByLabel("Camper to assign").selectOption(created.student.id);
    await blueDialog.getByRole("button", { name: "Assign to Blue" }).click();
    await expect(blueDialog.getByText(`${camperName} assigned to Blue.`)).toBeVisible();

    await page.goto("/camp/teams/team-blue");
    await expect(page.getByRole("region", { name: "Team Bulletin" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Blue camper assignments" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Team roster" }).getByText(camperName)).toBeVisible();

    await page.getByRole("button", { name: "Manage Team" }).click();
    const assignments = page.getByRole("dialog", { name: "Manage Team" }).getByRole("region", { name: "Blue camper assignments" });
    await expect(assignments.locator("li").filter({ hasText: camperName })).toHaveCount(1);
    await assignments.locator("li").filter({ hasText: camperName }).getByRole("button", { name: "Remove" }).click();
    await expect(assignments.getByText(`${camperName} removed from Blue.`)).toBeVisible();
    await expect(assignments.locator("li").filter({ hasText: camperName })).toHaveCount(0);
  });

  test("Edit Camper modal scrolls to team and safe indicator fields", async ({ page }) => {
    await login(page);
    const camperName = `Playwright Editable Camper ${Date.now()}`;
    const create = await page.request.post("/api/camp/students?role=andrew", {
      data: {
        name: camperName,
        grade: "",
        teamId: "",
        vehicleId: "",
        cabin: "",
        limitedSafetyFlags: []
      }
    });
    expect(create.ok()).toBe(true);

    await page.goto("/camp/roster");
    await page.getByRole("button", { name: new RegExp(camperName) }).click();
    const dialog = page.getByRole("dialog", { name: "Edit Camper" });
    const dialogBody = dialog.locator(".camp-dialog-body-camper-editor");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveClass(/camp-dialog-camper-editor/);
    await expect(dialogBody).toHaveCSS("overflow-y", "auto");
    const initialScrollState = await dialogBody.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      scrollTop: element.scrollTop
    }));
    expect(initialScrollState.scrollHeight).toBeGreaterThan(initialScrollState.clientHeight);
    await expect(dialog.getByLabel("Team")).toBeVisible();
    await dialog.getByLabel("Team").selectOption("team-red");
    await dialogBody.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    const scrolledState = await dialogBody.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      scrollTop: element.scrollTop
    }));
    expect(scrolledState.scrollTop).toBeGreaterThan(initialScrollState.scrollTop);
    await expect(dialog.getByLabel("Food allergy indicator")).toBeVisible();
    await dialog.getByLabel("Food allergy indicator").check();
    await dialog.getByLabel("Medical concern indicator").check();
    await expect(dialog.getByLabel("Medication-on-file indicator")).toBeVisible();
    await expect(dialog.getByText("Do not enter medication names")).toBeVisible();
    const footerClearance = await dialog.evaluate((element) => {
      const footer = element.querySelector<HTMLElement>(".camp-dialog-foot");
      const body = element.querySelector<HTMLElement>(".camp-dialog-body-camper-editor");
      const save = Array.from(element.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Save");
      return {
        bodyPaddingBottom: body ? getComputedStyle(body).paddingBottom : "",
        bodyOverflowY: body ? getComputedStyle(body).overflowY : "",
        footerBottom: footer?.getBoundingClientRect().bottom ?? 0,
        saveBottom: save?.getBoundingClientRect().bottom ?? 0,
        viewportBottom: window.innerHeight
      };
    });
    expect(footerClearance.bodyOverflowY).toBe("auto");
    expect(parseFloat(footerClearance.bodyPaddingBottom)).toBeGreaterThanOrEqual(120);
    expect(footerClearance.footerBottom).toBeLessThanOrEqual(footerClearance.viewportBottom);
    expect(footerClearance.saveBottom).toBeLessThanOrEqual(footerClearance.viewportBottom);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Camper saved. Team and transportation views are refreshed.")).toBeVisible();

    const card = page.getByRole("button", { name: new RegExp(camperName) });
    await expect(card).toContainText("Red");
    await expect(card).toContainText("Food allergy");
    await expect(card).toContainText("Medical concern");
    await expect(page.locator("body")).not.toContainText("dosage");
  });
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_TEST_EMAIL ?? "staff@example.com");
  await page.getByLabel("Password").fill(process.env.E2E_TEST_PASSWORD ?? "password");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/dashboard$/);
}

async function keepNextDevPortalOffPointerPath(page: Page) {
  await page.addInitScript(() => {
    const suppress = () => {
      Array.from(document.querySelectorAll("nextjs-portal")).forEach((portal) => {
        const element = portal as HTMLElement;
        element.style.setProperty("display", "none", "important");
        element.style.setProperty("pointer-events", "none", "important");
      });
    };
    const install = () => {
      suppress();
      new MutationObserver(suppress).observe(document.documentElement, { childList: true, subtree: true });
    };
    if (document.documentElement) install();
    else window.addEventListener("DOMContentLoaded", install, { once: true });
  });
}

async function suppressNextDevPortal(page: Page) {
  await page.evaluate(() => {
    Array.from(document.querySelectorAll("nextjs-portal")).forEach((portal) => {
      const element = portal as HTMLElement;
      element.style.setProperty("display", "none", "important");
      element.style.setProperty("pointer-events", "none", "important");
    });
  });
}
