import { describe, expect, it } from "vitest";

import { getMobilePrimaryTabs, isMobilePrimaryTab } from "@/lib/project-control/mobile-shell";

describe("mobile reference shell navigation", () => {
  it("keeps the three reference tabs in the approved order", () => {
    expect(getMobilePrimaryTabs()).toEqual([
      { id: "dashboard", label: "Dashboard", icon: "dashboard" },
      { id: "daily", label: "Daily Report", icon: "daily" },
      { id: "info", label: "Project", icon: "project" }
    ]);
  });

  it("treats HR and BUYIN as hamburger destinations", () => {
    expect(isMobilePrimaryTab("dashboard")).toBe(true);
    expect(isMobilePrimaryTab("daily")).toBe(true);
    expect(isMobilePrimaryTab("info")).toBe(true);
    expect(isMobilePrimaryTab("hr")).toBe(false);
    expect(isMobilePrimaryTab("buyin")).toBe(false);
  });
});
