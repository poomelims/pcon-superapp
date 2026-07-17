import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("mobile module design unification source", () => {
  test("provides the shared mobile anatomy", () => {
    const source = read("app/project-setup/features/shared/mobile-module-ui.tsx");
    expect(source).toContain("MobileModuleHeader");
    expect(source).toContain("MobileSummaryStrip");
    expect(source).toContain("MobileNumberedSection");
    expect(source).toContain("MobileContextActionBar");
  });

  test.each([
    ["dashboard", "app/project-setup/features/dashboard/dashboard-view.tsx", "data-mobile-dashboard-layout"],
    ["project", "app/project-setup/features/project/project-view.tsx", "data-mobile-project-layout"],
    ["hr", "app/project-setup/features/hr/hr-view.tsx", "data-mobile-hr-layout"],
    ["buyin", "app/project-setup/features/buyin/buyin-view.tsx", "data-mobile-buyin-layout"]
  ])("adds a dedicated %s layout below 768px", (_name, file, marker) => {
    const source = read(file);
    expect(source).toContain(marker);
    expect(source).toContain("md:hidden");
    expect(source).toContain("hidden md:block");
  });
});
