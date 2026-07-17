import { describe, expect, it } from "vitest";

import { DEFAULT_ROLE_ACCESS, normalizeAccessSections } from "@/lib/access-control";

describe("access control", () => {
  it("keeps owner access upgraded when older cloud rows do not include newer HR and BUYIN sections", () => {
    const sections = normalizeAccessSections(["dashboard", "project", "daily_report", "admin"], "owner");

    expect(sections).toEqual(DEFAULT_ROLE_ACCESS.owner);
    expect(sections).toContain("hr");
    expect(sections).toContain("buyin");
  });

  it("still lets non-owner members use explicit HR and BUYIN function access toggles", () => {
    const sections = normalizeAccessSections(["dashboard", "daily_report", "hr", "buyin"], "worker");

    expect(sections).toContain("hr");
    expect(sections).toContain("buyin");
    expect(sections).not.toContain("admin");
  });
});
