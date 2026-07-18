import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (window.name !== "__pcon_behavior_e2e_ready__") {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem("pcon_local_dev_auth_session", JSON.stringify({
        accessSections: [],
        authMode: "local_dev",
        displayName: "PCONE2E",
        loginId: "PCONE2E",
        role: "owner"
      }));
      window.name = "__pcon_behavior_e2e_ready__";
    }
  });
});

test("shows real zero values and resets focus when navigating", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/project-setup");
  await page.getByRole("button", { name: "สร้างโปรเจกต์ใหม่", exact: true }).first().click();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();

  await expect(page.getByTestId("dashboard-completed-count")).toHaveText("0");
  await expect(page.getByTestId("dashboard-workers-count")).toHaveText("0");
  await expect(page.getByTestId("dashboard-today-workers")).toHaveText("0");
  await expect(page.getByTestId("dashboard-today-completed")).toHaveText("0");
  await expect(page.getByTestId("dashboard-today-blockers")).toHaveText("0");
  await expect(page.getByTestId("dashboard-today-next-plan")).toHaveText("ยังไม่มีแผนถัดไป");
  await expect(page.getByTestId("dashboard-today-pulse").getByText("ยังไม่มีปัญหาที่ต้องติดตาม", { exact: true })).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const previousScrollY = await page.evaluate(() => window.scrollY);
  await page.getByRole("button", { name: "Project", exact: true }).click();
  const contentStart = page.getByTestId("workspace-content-start");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(previousScrollY);
  await expect(contentStart).toBeFocused();
  await expect.poll(() => contentStart.evaluate((element) => element.getBoundingClientRect().top)).toBeGreaterThan(-1);
  await expect.poll(() => contentStart.evaluate((element) => element.getBoundingClientRect().top)).toBeLessThan(1);
});

test("shows real Today Pulse values from the saved report", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/project-setup");
  await page.getByRole("button", { name: "สร้างโปรเจกต์ใหม่", exact: true }).first().click();
  await page.getByRole("button", { name: "Daily Report", exact: true }).click();

  await page.locator("[data-mobile-daily-summary]").fill("งานโครงสร้าง");
  const workSection = page.locator("#daily-work");
  const newWorkTitle = workSection.getByPlaceholder("ระบุงานที่ทำ", { exact: true });
  const newWorkStatus = workSection.locator("select");
  for (const title of ["ตั้งเสา", "เดินท่อ"]) {
    await newWorkTitle.fill(title);
    await newWorkStatus.selectOption("completed");
    await workSection.getByRole("button", { name: "+ เพิ่มงาน", exact: true }).click();
  }
  await page.getByRole("button", { name: "คนและวัสดุ", exact: true }).click();
  await page.locator("#daily-site").getByLabel("ชื่อช่างหรือทีม").fill("ทีม A");
  await page.locator("#daily-site").getByLabel("จำนวนคน").fill("3");
  await page.getByRole("button", { name: "แผนงานวันพรุ่งนี้", exact: true }).click();
  await page.locator("#daily-plan").getByLabel("แผนงานวันถัดไป").fill("เทคานชั้นสอง");
  await page.getByRole("button", { name: "ปัญหาและอุปสรรค", exact: true }).click();
  await page.getByRole("button", { name: "+ เพิ่มปัญหา", exact: true }).click();
  await page.locator("#daily-problems").getByLabel("หัวข้อปัญหา").fill("วัสดุล่าช้า");
  await page.locator("#daily-problems").getByLabel(/รายละเอียด •/).fill("รอของจากร้าน");
  await page.getByRole("button", { name: "บันทึกรายงาน", exact: true }).click();
  await expect(page.getByText("บันทึกในเครื่องแล้ว", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await expect(page.getByTestId("dashboard-today-workers")).toHaveText("3");
  await expect(page.getByTestId("dashboard-today-completed")).toHaveText("2");
  await expect(page.getByTestId("dashboard-today-blockers")).toHaveText("1");
  await expect(page.getByTestId("dashboard-today-next-plan")).toHaveText("เทคานชั้นสอง");
  await expect(page.getByTestId("dashboard-today-pulse").getByText("วัสดุล่าช้า: รอของจากร้าน", { exact: true })).toBeVisible();
});

test("switches between create and edit report history states", async ({ page }) => {
  await page.goto("/project-setup");
  await page.getByRole("button", { name: "สร้างโปรเจกต์ใหม่", exact: true }).first().click();
  await page.getByRole("button", { name: "Daily Report", exact: true }).click();
  const reportActionBar = page.getByRole("button", { name: "Save Report", exact: true }).locator("xpath=ancestor::section[1]");
  await expect(reportActionBar.getByText("Creating new report", { exact: true })).toBeVisible();
  const historyToggle = page.getByRole("button", { name: /^ประวัติรายงาน/ });
  await expect(historyToggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#daily-report-history-content")).toBeHidden();
  await page.locator("[data-daily-report-desktop-split]").getByLabel("สรุปงานวันนี้", { exact: true }).fill("Behavioral history test");
  await page.getByRole("button", { name: "Save Report", exact: true }).click();
  await expect(reportActionBar.getByText("Editing saved report", { exact: true })).toBeVisible();
  const historySelect = page.getByLabel("เลือกวันที่มีรายงาน");
  await expect(historySelect).not.toBeVisible();
  await expect(historyToggle).toHaveAttribute("aria-expanded", "false");
  await historyToggle.click();
  await expect(historySelect).toBeVisible();
  await expect(historySelect).not.toHaveValue("");
});

test("uses six Daily Quick sections and one contextual mobile save action", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/project-setup");
  await page.getByRole("button", { name: "สร้างโปรเจกต์ใหม่", exact: true }).first().click();
  await page.getByRole("button", { name: "Daily Report", exact: true }).click();

  await expect(page.locator("[data-daily-quick-section]")).toHaveCount(6);
  await expect(page.getByRole("button", { name: "งานวันนี้", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "คนและวัสดุ", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "ความคืบหน้า BOQ", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "แผนงานวันพรุ่งนี้", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "ปัญหาและอุปสรรค", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "รูปงานประจำวัน", exact: true })).toBeVisible();
  await expect(page.getByText(/0\/\d ไม่สมบูรณ์/)).toHaveCount(6);
  await expect(page.getByRole("button", { name: "งานวันนี้", exact: true })).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("[data-mobile-daily-summary]")).toBeVisible();

  for (const [sectionId, sectionName] of [
    ["daily-work", "งานวันนี้"],
    ["daily-site", "คนและวัสดุ"],
    ["daily-progress", "ความคืบหน้า BOQ"],
    ["daily-plan", "แผนงานวันพรุ่งนี้"],
    ["daily-problems", "ปัญหาและอุปสรรค"],
    ["daily-photos", "รูปงานประจำวัน"]
  ] as const) {
    const toggle = page.locator(`#${sectionId}`).getByRole("button", { name: sectionName, exact: true });
    const controls = (await toggle.getAttribute("aria-controls"))?.split(/\s+/).filter(Boolean) ?? [];
    expect(controls.length, `${sectionId} should control a revealed field group`).toBeGreaterThan(0);
    expect(controls).not.toContain(`${sectionId}-content`);
    for (const controlId of controls) {
      await expect(page.locator(`#${controlId}`), `${sectionId} control ${controlId}`).toHaveCount(1);
    }
  }

  await page.locator("[data-mobile-daily-summary]").fill("งานโครงสร้างชั้นหนึ่ง");
  await page.getByRole("button", { name: "คนและวัสดุ", exact: true }).click();
  await expect(page.locator("#daily-site").getByLabel("ชื่อช่างหรือทีม")).toBeVisible();
  await expect(page.locator("#daily-site").getByLabel("วัสดุที่ใช้ / วัสดุเข้าไซต์")).toBeVisible();
  await page.getByRole("button", { name: "ความคืบหน้า BOQ", exact: true }).click();
  await expect(page.getByRole("button", { name: "ความคืบหน้า BOQ", exact: true })).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "แผนงานวันพรุ่งนี้", exact: true }).click();
  await expect(page.locator("#daily-plan").getByLabel("หมายเหตุภายในทีม")).toBeVisible();
  await page.getByRole("button", { name: "ปัญหาและอุปสรรค", exact: true }).click();
  await expect(page.locator("#daily-problems").getByRole("button", { name: "+ เพิ่มปัญหา", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "รูปงานประจำวัน", exact: true }).click();
  await expect(page.locator("#daily-photos").locator("[data-daily-report-photo-input]")).toHaveCount(1);
  await page.getByRole("button", { name: "งานวันนี้", exact: true }).click();

  const mobileSave = page.getByRole("button", { name: "บันทึกรายงาน", exact: true });
  await expect(mobileSave).toHaveCount(1);
  await expect(mobileSave).toBeVisible();
  await mobileSave.click();
  await expect(page.getByText("บันทึกในเครื่องแล้ว", { exact: true })).toBeVisible();
  await expect(page.getByTestId("daily-save-bar")).toHaveAttribute("data-editing", "true");

  await page.getByRole("button", { name: "แผนงานวันพรุ่งนี้", exact: true }).click();
  const lastField = page.locator("#daily-plan").getByLabel("หมายเหตุภายในทีม");
  await expect(lastField).toBeVisible();
  const stickyBar = page.getByRole("region", { name: "การทำงาน" });
  await expect(stickyBar).toBeVisible();
  const lastFieldBottom = await lastField.evaluate((element) => element.getBoundingClientRect().bottom);
  const stickyBarTop = await stickyBar.evaluate((element) => element.getBoundingClientRect().top);
  expect(lastFieldBottom).toBeLessThanOrEqual(stickyBarTop + 1);
});

test("uploads at most twelve daily work photos and keeps them after refresh", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/project-setup");
  await page.getByRole("button", { name: "สร้างโปรเจกต์ใหม่", exact: true }).first().click();
  await page.getByRole("button", { name: "Daily Report", exact: true }).click();

  const photosSection = page.locator("#daily-photos");
  await photosSection.getByRole("button", { name: "รูปงานประจำวัน", exact: true }).click();
  const tinyPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64"
  );
  await photosSection.locator("[data-daily-report-photo-input]").setInputFiles(
    Array.from({ length: 13 }, (_, index) => ({
      name: `site-${index + 1}.png`,
      mimeType: "image/png",
      buffer: tinyPng
    }))
  );

  await expect(photosSection.locator("[data-daily-report-photo-card]")).toHaveCount(12);
  await expect(photosSection.locator("[data-daily-report-photo-count]")).toContainText("12/12 รูป");
  await expect(page.getByText(/รับรูปเพิ่มได้อีก 12 รูป/)).toBeVisible();

  await page.getByRole("button", { name: "บันทึกรายงาน", exact: true }).click();
  await expect(page.getByText("บันทึกในเครื่องแล้ว", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Daily Report", exact: true }).click();

  const reloadedPhotosSection = page.locator("#daily-photos");
  const reloadedToggle = reloadedPhotosSection.getByRole("button", { name: "รูปงานประจำวัน", exact: true });
  if ((await reloadedToggle.getAttribute("aria-expanded")) !== "true") {
    await reloadedToggle.click();
  }
  await expect(reloadedPhotosSection.locator("[data-daily-report-photo-card]")).toHaveCount(12);
  await reloadedPhotosSection.getByRole("button", { name: "ลบรูป 1", exact: true }).click();
  await expect(reloadedPhotosSection.locator("[data-daily-report-photo-card]")).toHaveCount(11);
});

test("places the desktop daily photo card after the problems card", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/project-setup");
  await page.getByRole("button", { name: "สร้างโปรเจกต์ใหม่", exact: true }).first().click();
  await page.getByRole("button", { name: "Daily Report", exact: true }).click();

  const desktopSplit = page.locator("[data-daily-report-desktop-split]");
  await expect(desktopSplit).toBeVisible();
  await expect(desktopSplit.locator("[data-daily-report-section='site-photos']")).toBeVisible();
  const requiredSections = page.locator("[data-daily-report-required-sections]");
  await expect(requiredSections).toBeVisible();
  const sectionOrder = await requiredSections.evaluate((element) =>
    Array.from(element.querySelectorAll("[data-daily-report-section]"))
      .map((section) => section.getAttribute("data-daily-report-section"))
  );
  expect(sectionOrder.indexOf("site-photos")).toBeGreaterThan(sectionOrder.indexOf("problems"));
  await expect(desktopSplit.locator("[data-daily-reference-section-number='6']")).toBeVisible();
});

test("starts a new Daily Report in work and focuses its summary after section navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/project-setup");
  await page.getByRole("button", { name: "สร้างโปรเจกต์ใหม่", exact: true }).first().click();
  await page.getByRole("button", { name: "Daily Report", exact: true }).click();

  await page.getByRole("button", { name: "คนและวัสดุ", exact: true }).click();
  await page.getByRole("button", { name: "แผนงานวันพรุ่งนี้", exact: true }).click();
  await expect(page.getByRole("button", { name: "แผนงานวันพรุ่งนี้", exact: true })).toHaveAttribute("aria-expanded", "true");

  await page.getByRole("button", { name: "เมนูเพิ่มเติม", exact: true }).click();
  await page.getByRole("button", { name: "รายงานใหม่", exact: true }).click();
  await expect(page.getByRole("button", { name: "งานวันนี้", exact: true })).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("[data-mobile-daily-summary]")).toBeFocused();
});

test("resets Quick focus when creating a second report after site and plan navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/project-setup");
  await page.getByRole("button", { name: "สร้างโปรเจกต์ใหม่", exact: true }).first().click();
  await page.getByRole("button", { name: "Daily Report", exact: true }).click();

  await page.locator("[data-mobile-daily-summary]").fill("รายงานแรก");
  await page.getByRole("button", { name: "บันทึกรายงาน", exact: true }).click();
  await expect(page.getByText("บันทึกในเครื่องแล้ว", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "คนและวัสดุ", exact: true }).click();
  await page.getByRole("button", { name: "แผนงานวันพรุ่งนี้", exact: true }).click();
  await expect(page.getByRole("button", { name: "แผนงานวันพรุ่งนี้", exact: true })).toHaveAttribute("aria-expanded", "true");

  await page.getByRole("button", { name: "เมนูเพิ่มเติม", exact: true }).click();
  await page.getByRole("button", { name: "รายงานใหม่", exact: true }).click();
  await expect(page.getByTestId("daily-save-bar")).toHaveAttribute("data-editing", "false");
  await expect(page.getByRole("button", { name: "งานวันนี้", exact: true })).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("[data-mobile-daily-summary]")).toBeFocused();
});

test("opens real HR and BUYIN modules from More on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/project-setup");
  await page.getByRole("button", { name: "เมนูเพิ่มเติม", exact: true }).click();
  await page.getByRole("button", { name: "HR", exact: true }).click();
  await expect(page.getByRole("heading", { name: "ทะเบียนทีมช่างและค่าแรง", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "เมนูเพิ่มเติม", exact: true })).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("workspace-content-start")).toBeFocused();
  await page.getByRole("button", { name: "เมนูเพิ่มเติม", exact: true }).click();
  await page.getByRole("button", { name: "BUYIN / จัดซื้อ", exact: true }).click();
  await expect(page.getByRole("heading", { name: "บันทึกซื้อของและใบกำกับผู้ขาย", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "เมนูเพิ่มเติม", exact: true })).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("workspace-content-start")).toBeFocused();
});

test("keeps the local Project save when cloud push fails", async ({ page }) => {
  let pushRequestCount = 0;
  await page.route("**/api/cloud-sync/push", async (route) => {
    pushRequestCount += 1;
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "offline" }) });
  });
  await page.goto("/project-setup");
  await page.getByRole("button", { name: "สร้างโปรเจกต์ใหม่", exact: true }).first().click();
  await page.locator("[data-desktop-project-layout]").getByLabel("ชื่อโปรเจกต์").fill("Local survives cloud failure");
  await page.evaluate(() => window.localStorage.removeItem("pcon_project_setup_data"));
  expect(await page.evaluate(() => window.localStorage.getItem("pcon_project_setup_data"))).toBeNull();
  await page.getByRole("button", { name: "Save Project", exact: true }).click();
  await expect(page.getByText(/ข้อมูล local ยังปลอดภัย|Save Project ในเครื่องนี้แล้ว/).first()).toBeVisible();
  expect(pushRequestCount).toBe(1);
  await page.reload();
  await page.getByRole("button", { name: "Project / BOQ", exact: true }).click();
  await expect(page.locator("[data-desktop-project-layout]").getByLabel("ชื่อโปรเจกต์")).toHaveValue("Local survives cloud failure");
});

test("switches active project context between two projects", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/project-setup");

  await page.getByRole("button", { name: "สร้างโปรเจกต์ใหม่", exact: true }).first().click();
  await page.getByRole("button", { name: "Project", exact: true }).click();
  await page.getByRole("button", { name: /ข้อมูลโครงการ/ }).click();
  await page.locator("[data-mobile-project-layout]").getByLabel("ชื่อโปรเจกต์").fill("Switch Alpha");
  await page.getByRole("button", { name: "บันทึก Project", exact: true }).click();

  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await page.getByRole("button", { name: "เมนูเพิ่มเติม", exact: true }).click();
  await page.getByRole("button", { name: "สร้างโปรเจกต์ใหม่", exact: true }).click();
  await page.getByRole("button", { name: "Project", exact: true }).click();
  await page.getByRole("button", { name: /ข้อมูลโครงการ/ }).click();
  await page.locator("[data-mobile-project-layout]").getByLabel("ชื่อโปรเจกต์").fill("Switch Beta");
  await page.getByRole("button", { name: "บันทึก Project", exact: true }).click();

  const switcher = page.getByRole("button", { name: "เลือกโปรเจกต์ปัจจุบัน", exact: true });
  await expect(switcher).toContainText("Switch Beta");
  await switcher.click();
  const mobilePicker = page.locator('[data-project-picker-overlay="mobile-top-sheet"]');
  await expect(mobilePicker).toBeVisible();
  await expect(mobilePicker.evaluate((element) => element.parentElement === document.body)).resolves.toBe(true);
  const switcherBox = await switcher.boundingBox();
  const pickerBox = await mobilePicker.boundingBox();
  expect(pickerBox?.y).toBeGreaterThanOrEqual((switcherBox?.y ?? 0) + (switcherBox?.height ?? 0));
  await expect(mobilePicker.getByRole("searchbox", { name: "ค้นหาโปรเจกต์" })).toBeFocused();
  await page.getByRole("button", { name: /Switch Alpha/ }).click();
  await expect(switcher).toContainText("Switch Alpha");
  await expect(page.locator("[data-mobile-project-layout]").getByLabel("ชื่อโปรเจกต์")).toHaveValue("Switch Alpha");

  await switcher.click();
  await page.getByRole("button", { name: /Switch Beta/ }).click();
  await expect(switcher).toContainText("Switch Beta");
  await expect(page.locator("[data-mobile-project-layout]").getByLabel("ชื่อโปรเจกต์")).toHaveValue("Switch Beta");
  await expect(switcher).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("workspace-content-start")).toBeFocused();
});

test("opens the Desktop project search as a portal outside the workspace header", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/project-setup");
  await page.getByRole("button", { name: "สร้างโปรเจกต์ใหม่", exact: true }).first().click();

  const searchInput = page.getByRole("searchbox", { name: "ค้นหาโปรเจกต์" });
  await searchInput.focus();
  const desktopPicker = page.locator('[data-project-picker-overlay="desktop-popover"]');
  await expect(desktopPicker).toBeVisible();
  await expect(desktopPicker.evaluate((element) => element.parentElement === document.body)).resolves.toBe(true);
  await expect(desktopPicker.getByRole("button", { name: /โปรเจกต์ 1/ }).first()).toBeVisible();
});

test("uses the Daily Report mobile anatomy across Dashboard, Project, HR, and BUYIN", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/project-setup");
  await page.getByRole("button", { name: "สร้างโปรเจกต์ใหม่", exact: true }).first().click();

  const assertModule = async (layoutSelector: string, defaultSection: string) => {
    const layout = page.locator(layoutSelector);
    await expect(layout).toBeVisible();
    await expect(layout.locator("[data-mobile-numbered-section]")).toHaveCount(4);
    await expect(layout.locator(`[data-mobile-numbered-section="${defaultSection}"] button[aria-expanded]`)).toHaveAttribute("aria-expanded", "true");
  };

  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await assertModule("[data-mobile-dashboard-layout]", "dashboard-today");

  await page.getByRole("button", { name: "Project", exact: true }).click();
  await assertModule("[data-mobile-project-layout]", "project-boq");
  await expect(page.getByRole("button", { name: "บันทึก Project", exact: true })).toHaveCount(1);

  await page.getByRole("button", { name: "เมนูเพิ่มเติม", exact: true }).click();
  await page.getByRole("button", { name: "HR", exact: true }).click();
  await assertModule("[data-mobile-hr-layout]", "hr-expense");
  await expect(page.getByRole("button", { name: "Sync HR Cloud", exact: true })).toBeHidden();

  await page.getByRole("button", { name: "เมนูเพิ่มเติม", exact: true }).click();
  await page.getByRole("button", { name: "BUYIN / จัดซื้อ", exact: true }).click();
  await assertModule("[data-mobile-buyin-layout]", "buyin-entry");
  await expect(page.getByRole("button", { name: "Sync BUYIN Cloud", exact: true })).toBeHidden();
});

test("uses the reference Desktop shell and module anatomy across the workspace", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/project-setup");
  await page.getByRole("button", { name: "สร้างโปรเจกต์ใหม่", exact: true }).first().click();
  await page.getByRole("button", { name: "Dashboard", exact: true }).first().click();

  await expect(page.locator("[data-desktop-workspace-shell]")).toBeVisible();
  await expect(page.locator("[data-desktop-sidebar]")).toBeVisible();
  await expect(page.locator("[data-desktop-workspace-header]")).toBeVisible();
  await expect(page.locator("[data-desktop-tools-menu]")).toBeVisible();

  await expect(page.locator('[data-dashboard-layout="reference-desktop"]')).toBeVisible();
  await expect(page.locator("[data-dashboard-summary-strip]")).toBeVisible();
  await expect(page.locator('[data-dashboard-right-rail="reference"]')).toBeVisible();

  await page.getByRole("button", { name: "Project / BOQ", exact: true }).first().click();
  await expect(page.locator("[data-project-desktop-summary]")).toBeVisible();
  await expect(page.locator("[data-project-desktop-action-bar]")).toBeVisible();

  await page.getByRole("button", { name: "Daily Report", exact: true }).first().click();
  await expect(page.locator("[data-daily-desktop-summary]")).toBeVisible();
  await expect(page.locator("[data-daily-desktop-action-bar]")).toBeVisible();

  await page.getByRole("button", { name: "HR / ทีมช่าง", exact: true }).first().click();
  await expect(page.locator("[data-hr-desktop-summary]")).toBeVisible();
  await expect(page.locator("[data-hr-desktop-action-bar]")).toBeVisible();

  await page.getByRole("button", { name: "BUYIN / จัดซื้อ", exact: true }).first().click();
  await expect(page.locator("[data-buyin-desktop-summary]")).toBeVisible();
  await expect(page.locator("[data-buyin-desktop-action-bar]")).toBeVisible();
});

test("keeps reduced-motion content visible and preserves shell overflow at every target viewport", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/project-setup");
  await page.getByRole("button", { name: "สร้างโปรเจกต์ใหม่", exact: true }).first().click();

  for (const viewport of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 768, height: 900 },
    { width: 1440, height: 900 }
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/project-setup");
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByRole("button", { name: "Dashboard", exact: true })).toBeVisible();

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasOverflow, `${viewport.width}x${viewport.height}`).toBe(false);

    await page.getByRole("button", { name: "Daily Report", exact: true }).click();
    if (viewport.width < 1280) {
      await expect(page.locator("[data-mobile-daily-summary]")).toBeVisible();
    } else {
      await expect(page.getByLabel("สรุปงานวันนี้", { exact: true })).toBeVisible();
    }
    if (viewport.width < 1280) {
      await expect(page.getByRole("button", { name: "บันทึกรายงาน", exact: true })).toHaveCount(1);
    } else {
      await expect(page.getByRole("button", { name: "Save Report", exact: true })).toBeVisible();
    }
    await page.getByRole("button", { name: "Dashboard", exact: true }).click();
    await expect(page.getByTestId(viewport.width < 768 ? "dashboard-today-pulse" : "dashboard-today-pulse-desktop")).toBeVisible();
    await page.getByRole("button", { name: viewport.width < 1280 ? "Project" : "Project / BOQ", exact: true }).click();
    if (viewport.width < 768) {
      await expect(page.locator("[data-mobile-project-layout]")).toBeVisible();
    } else {
      await expect(page.getByRole("heading", { name: "BOQ อยู่ในหน้า Project แล้ว", exact: true })).toBeVisible();
    }
  }
});
