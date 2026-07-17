import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (window.name !== "__pcon_visual_behavior_e2e_ready__") {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem("pcon_local_dev_auth_session", JSON.stringify({ accessSections: [], authMode: "local_dev", displayName: "PCONE2E", loginId: "PCONE2E", role: "owner" }));
      window.name = "__pcon_visual_behavior_e2e_ready__";
    }
  });
});

test("keeps focus visible, tap targets reachable, and pages free of overflow at mobile widths", async ({ page }) => {
  for (const viewport of [
    { width: 360, height: 800 },
    { width: 390, height: 844 }
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/project-setup");
    await expect(page.locator("main")).toBeVisible();

    const createProjectButton = page.getByRole("button", { name: "สร้างโปรเจกต์ใหม่", exact: true }).first();
    await expect(createProjectButton).toBeVisible();
    await expect
      .poll(async () => (await createProjectButton.boundingBox())?.height ?? 0)
      .toBeGreaterThanOrEqual(44);

    const unfocusedStyle = await createProjectButton.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        boxShadow: style.boxShadow
      };
    });
    await createProjectButton.focus();
    const focusStyle = await createProjectButton.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        boxShadow: style.boxShadow
      };
    });
    const hasConcreteFocusOutline =
      focusStyle.outlineStyle !== "none" && Number.parseFloat(focusStyle.outlineWidth) > 0;
    const hasFocusOnlyShadowChange = focusStyle.boxShadow !== unfocusedStyle.boxShadow;
    expect(
      hasConcreteFocusOutline || hasFocusOnlyShadowChange
    ).toBe(true);

    const hasPageOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasPageOverflow, `${viewport.width}x${viewport.height}`).toBe(false);
  }
});

test("keeps Quick fields, Today Pulse, BOQ cards, and sticky controls visible with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/project-setup");
  await page.getByRole("button", { name: "สร้างโปรเจกต์ใหม่", exact: true }).first().click();

  await page.getByRole("button", { name: "Daily Report", exact: true }).click();
  await expect(page.locator("[data-mobile-daily-summary]")).toBeVisible();
  await expect(page.getByRole("region", { name: "การทำงาน" })).toBeVisible();

  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await expect(page.getByTestId("dashboard-today-pulse")).toBeVisible();

  await page.getByRole("button", { name: "Project", exact: true }).click();
  const mobileProject = page.locator("[data-mobile-project-layout]");
  await expect(mobileProject).toBeVisible();
  await expect(mobileProject.locator('[data-mobile-numbered-section="project-boq"] button[aria-expanded]')).toHaveAttribute("aria-expanded", "true");
  await mobileProject.getByRole("button", { name: "+ เพิ่มหมวด", exact: true }).click();
  await mobileProject.getByRole("button", { name: "+ เพิ่มรายการ", exact: true }).first().click();
  await expect(mobileProject.getByTestId("boq-item-card")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
