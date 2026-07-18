import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (window.name !== "__pcon_e2e_ready__") {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem("pcon_local_dev_auth_session", JSON.stringify({ accessSections: [], authMode: "local_dev", displayName: "PCONE2E", loginId: "PCONE2E", role: "owner" }));
      window.name = "__pcon_e2e_ready__";
    }
  });
});

test("creates, persists, edits, deletes, exports, and imports the local core workflow", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/project-setup");
  await expect(page.locator("main")).toBeVisible();

  await page.getByRole("button", { name: "สร้างโปรเจกต์ใหม่", exact: true }).first().click();
  const projectName = `E2E Project ${Date.now()}`;
  await page.locator("[data-desktop-project-layout]").getByLabel("ชื่อโปรเจกต์").fill(projectName);
  await page.reload();
  await page.getByRole("button", { name: "Project / BOQ", exact: true }).click();
  const desktopProject = page.locator("[data-desktop-project-layout]");
  await expect(desktopProject.getByLabel("ชื่อโปรเจกต์")).toHaveValue(projectName);

  await desktopProject.getByRole("button", { name: "+ เพิ่มหมวดงาน", exact: true }).first().click();
  const categoryCard = desktopProject.getByRole("button", { name: "+ เพิ่มรายการ", exact: true }).first().locator("xpath=ancestor::section[1]");
  await categoryCard.locator("input").first().fill("งานโครงสร้าง");

  await categoryCard.getByRole("button", { name: "+ เพิ่มรายการ", exact: true }).click();
  await desktopProject.getByLabel("รายการ").nth(0).fill("คอนกรีต");
  await desktopProject.getByLabel("จำนวน").nth(0).fill("2");
  await desktopProject.getByLabel("ราคา/หน่วย").nth(0).fill("1000");
  await desktopProject.getByLabel("Progress %").nth(0).fill("50");

  await categoryCard.getByRole("button", { name: "+ เพิ่มรายการ", exact: true }).click();
  await desktopProject.getByLabel("รายการ").nth(1).fill("เหล็กเสริม");
  await desktopProject.getByLabel("จำนวน").nth(1).fill("1");
  await desktopProject.getByLabel("ราคา/หน่วย").nth(1).fill("1000");
  await desktopProject.getByLabel("Progress %").nth(1).fill("0");
  await expect(categoryCard).toContainText("33.3%");

  await desktopProject.getByLabel("จำนวน").nth(1).fill("-5");
  await expect(desktopProject.getByLabel("จำนวน").nth(1)).toHaveValue("0");
  await desktopProject.getByLabel("จำนวน").nth(1).fill("1");

  await page.getByRole("button", { name: "Daily Report", exact: true }).click();
  const desktopDaily = page.locator("[data-daily-report-desktop-split]");
  const progressInput = desktopDaily.getByLabel("New %").first();
  await progressInput.click();
  await progressInput.press("Control+A");
  await progressInput.press("Backspace");
  await progressInput.type("60");
  await expect(progressInput).toHaveValue("60");
  await desktopDaily.getByLabel("สรุปงานวันนี้", { exact: true }).fill("ตรวจงานโครงสร้างรอบเช้า");
  await desktopDaily.getByLabel("งานที่ทำเสร็จวันนี้").fill("เทคอนกรีตฐานราก");
  await desktopDaily.getByLabel("ชื่อช่าง / ทีม").fill("ทีมช่าง E2E");
  await desktopDaily.getByLabel("จำนวนคน").fill("3");
  const reportDate = await desktopDaily.getByLabel("วันที่รายงาน").inputValue();
  await page.getByRole("button", { name: "Save Report", exact: true }).click();
  await expect(page.getByText(/บันทึกในเครื่องแล้ว|บันทึก Daily Report แล้ว/).first()).toBeVisible();

  await desktopDaily.getByLabel("สรุปงานวันนี้", { exact: true }).fill("แก้ไขรายงานหลังตรวจไซต์");
  await page.getByRole("button", { name: "Save Report", exact: true }).click();
  await expect(page.getByText(/บันทึกในเครื่องแล้ว|บันทึก Daily Report แล้ว/).first()).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Daily Report", exact: true }).click();
  await expect(desktopDaily.getByLabel("สรุปงานวันนี้", { exact: true })).toHaveValue("แก้ไขรายงานหลังตรวจไซต์");

  await page.getByRole("button", { name: "Project / BOQ", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const download = await downloadPromise;
  const exportedPath = testInfo.outputPath("workspace-export.json");
  await download.saveAs(exportedPath);

  await page.getByRole("button", { name: "Daily Report", exact: true }).click();
  await page.getByRole("button", { name: "ลบ", exact: true }).first().click();
  await page.getByLabel(`พิมพ์ ${reportDate} เพื่อยืนยัน`).fill(reportDate);
  await page.getByRole("heading", { name: "ยืนยันการลบ", exact: true }).locator("xpath=ancestor::form").getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("ลบ Daily Report แล้ว", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Project / BOQ", exact: true }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByLabel(`พิมพ์ ${projectName} เพื่อยืนยัน`).fill(projectName);
  await page.getByRole("heading", { name: "ยืนยันการลบ", exact: true }).locator("xpath=ancestor::form").getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Project / BOQ", exact: true }).click();
  await expect(page.getByText("เริ่มจากโปรเจกต์แรกของคุณ", { exact: true })).toBeVisible();

  await page.locator('input[type="file"][accept="application/json"]').setInputFiles(exportedPath!);
  await expect(page.getByText("Import JSON สำเร็จ พร้อม dailyReports", { exact: true })).toBeVisible();
  await expect(page.getByText(projectName, { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Daily Report", exact: true }).click();
  await expect(desktopDaily.getByLabel("สรุปงานวันนี้", { exact: true })).toHaveValue("แก้ไขรายงานหลังตรวจไซต์");
});

test("keeps the core workspace free from page-level overflow at target viewports", async ({ page }) => {
  for (const viewport of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 768, height: 900 },
    { width: 1440, height: 900 }
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/project-setup");
    await expect(page.locator("main")).toBeVisible();
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasOverflow, `${viewport.width}x${viewport.height}`).toBe(false);
  }
});

test("keeps BOQ item cards readable and preserves CRUD, numeric guards, and Project Save", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/project-setup");
  await page.getByRole("button", { name: "สร้างโปรเจกต์ใหม่", exact: true }).first().click();
  await page.getByRole("button", { name: "Project", exact: true }).click();
  const mobileProject = page.locator("[data-mobile-project-layout]");

  await mobileProject.getByRole("button", { name: "+ เพิ่มหมวด", exact: true }).click();
  const categoryCard = mobileProject.getByRole("button", { name: "+ เพิ่มรายการ", exact: true }).locator("xpath=ancestor::section[1]");
  await categoryCard.locator("input").first().fill("งานโครงสร้าง");
  await mobileProject.getByRole("button", { name: "+ เพิ่มรายการ", exact: true }).click();

  const itemCard = mobileProject.getByTestId("boq-item-card").first();
  await expect(itemCard).toBeVisible();
  await itemCard.getByTestId("boq-item-description").fill("คอนกรีตฐานราก");
  await itemCard.getByTestId("boq-item-quantity").fill("2");
  await itemCard.getByTestId("boq-item-unit").fill("ลบ.ม.");
  await itemCard.getByTestId("boq-item-unit-price").fill("1000");
  await itemCard.getByTestId("boq-item-progress").fill("50");
  await expect(itemCard.getByTestId("boq-item-total")).toContainText("฿2,000");
  await expect(itemCard.getByTestId("boq-item-progress-value")).toHaveText("50.0%");

  await itemCard.getByTestId("boq-item-quantity").fill("-5");
  await expect(itemCard.getByTestId("boq-item-quantity")).toHaveValue("0");
  await itemCard.getByTestId("boq-item-unit-price").fill("-100");
  await expect(itemCard.getByTestId("boq-item-unit-price")).toHaveValue("0");
  await itemCard.getByTestId("boq-item-progress").fill("150");
  await expect(itemCard.getByTestId("boq-item-progress")).toHaveValue("100");

  await itemCard.getByTestId("boq-item-quantity").fill("2");
  await itemCard.getByTestId("boq-item-unit-price").fill("1000");
  await itemCard.getByTestId("boq-item-progress").fill("50");
  await page.getByRole("button", { name: "บันทึก Project", exact: true }).click();
  await expect(page.getByText(/Save Project ในเครื่องนี้แล้ว|ข้อมูล local ยังปลอดภัย/).first()).toBeVisible();
  await expect(itemCard.getByTestId("boq-item-description")).toHaveValue("คอนกรีตฐานราก");

  await itemCard.getByRole("button", { name: "ลบรายการ", exact: true }).click();
  await expect(mobileProject.getByTestId("boq-item-card")).toHaveCount(0);

  await page.evaluate(() => {
    const hasOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
    if (hasOverflow) {
      throw new Error("BOQ item card overflows at 360px");
    }
  });
});

test("keeps the BOQ card grid within the page at tablet width", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("/project-setup");
  await page.getByRole("button", { name: "สร้างโปรเจกต์ใหม่", exact: true }).first().click();
  await page.getByRole("button", { name: "Project", exact: true }).click();
  const desktopProject = page.locator("[data-desktop-project-layout]");
  await desktopProject.getByRole("button", { name: "+ เพิ่มหมวดงาน", exact: true }).first().click();
  const categoryCard = desktopProject.getByRole("button", { name: "+ เพิ่มรายการ", exact: true }).first().locator("xpath=ancestor::section[1]");
  await categoryCard.locator("input").first().fill("งานระบบ");
  await categoryCard.getByRole("button", { name: "+ เพิ่มรายการ", exact: true }).click();
  await expect(desktopProject.getByTestId("boq-item-card")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(768);
});

test("loads PDF UI on demand and keeps one mobile Daily save action", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/project-setup");
  await page.getByRole("button", { name: "สร้างโปรเจกต์ใหม่", exact: true }).first().click();
  await page.getByRole("button", { name: "Daily Report", exact: true }).click();

  await expect(page.locator('[data-pdf-export-root="true"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "บันทึกรายงาน", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "เมนูเพิ่มเติม", exact: true }).click();
  await page.getByRole("button", { name: "Preview PDF", exact: true }).click();
  await expect(page.locator("p", { hasText: /^Preview PDF$/ })).toBeVisible();
  await expect(page.locator('[data-pdf-export-root="true"]')).toHaveCount(1);
});
