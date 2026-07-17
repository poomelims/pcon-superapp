import { describe, expect, it } from "vitest";
import {
  formatDashboardDateSpan,
  formatDashboardShortDate
} from "@/lib/project-control/dashboard-view-model";

describe("dashboard view model", () => {
  it("formats compact project dates without inventing missing values", () => {
    expect(formatDashboardShortDate("2026-07-15")).toBe("7/15");
    expect(formatDashboardShortDate(null)).toBe("-");
    expect(formatDashboardShortDate("legacy-date")).toBe("legacy-date");
    expect(formatDashboardDateSpan("2026-07-01", "2026-07-31")).toBe("7/1-7/31");
    expect(formatDashboardDateSpan(undefined, "2026-07-31")).toBe("7/31");
    expect(formatDashboardDateSpan(undefined, undefined)).toBe("-");
  });
});
