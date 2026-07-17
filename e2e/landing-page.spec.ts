import { expect, test } from "@playwright/test";

test("renders the public PCON landing page with real registration and login destinations", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/$/);
  await expect(page).toHaveTitle(/PCON Project Control/);
  await expect(page.locator("main[data-landing-page]")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: /รู้ทุกไซต์.*คุมทุกงาน.*จบในที่เดียว/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "เริ่มใช้งานฟรี", exact: true }).first()).toHaveAttribute("href", "/register");
  await expect(page.getByRole("link", { name: "เข้าสู่ระบบ", exact: true }).first()).toHaveAttribute("href", "/login");
  await expect(page.getByLabel("Page scroll controls")).toHaveCount(0);
});

test("opens and closes the accessible mobile navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const menuButton = page.getByTestId("landing-mobile-menu-button");
  const menu = page.getByTestId("landing-mobile-menu");

  await expect(menuButton).toBeVisible();
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await menuButton.click();
  await expect(menuButton).toHaveAttribute("aria-expanded", "true");
  await expect(menu).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeHidden();
});

test("navigates to real sections and stays usable at all acceptance widths", async ({ page }) => {
  for (const viewport of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 768, height: 900 },
    { width: 1440, height: 1000 }
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const primaryAction = page.getByRole("link", { name: "เริ่มใช้งานฟรี", exact: true }).first();
    await expect(primaryAction).toBeVisible();
    await expect.poll(async () => (await primaryAction.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);

    const undersizedTargetCount = await page
      .locator("header a:visible, header button:visible, main a:visible, main button:visible, footer a:visible, footer button:visible")
      .evaluateAll((targets) => targets.filter((target) => target.getBoundingClientRect().height < 44).length);
    expect(undersizedTargetCount, `${viewport.width}x${viewport.height} tap targets`).toBe(0);

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasOverflow, `${viewport.width}x${viewport.height}`).toBe(false);
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByRole("link", { name: "ดูระบบทำงาน", exact: true }).click();
  await expect(page).toHaveURL(/#workflow$/);
  await expect(page.locator("#workflow")).toBeVisible();
  await expect.poll(async () => (await page.locator("header").boundingBox())?.y ?? -1).toBeGreaterThanOrEqual(0);
  await expect(page.locator("#features")).toBeVisible();
  await expect(page.locator("#audience")).toBeVisible();
});

test("does not publish unsupported proof, contact details, or future modules", async ({ page }) => {
  await page.goto("/");
  const landing = page.locator("main[data-landing-page]");

  await expect(landing).not.toContainText("hello@pcon.co.th");
  await expect(landing).not.toContainText("02-123-4567");
  await expect(landing).not.toContainText(/Payment|Timeline|AI Summary/);
  await expect(landing.locator('a[href="#"]')).toHaveCount(0);
});
