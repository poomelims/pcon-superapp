import { describe, expect, it } from "vitest";

import {
  BuyinView,
  DashboardView,
  DailyReportView,
  HrView,
  PrintDailyReportSheet,
  ProjectInfoView
} from "@/app/project-setup/features/feature-loaders";

describe("Phase 1.5 feature loading contract", () => {
  it("exports one lazy boundary for each workspace feature", () => {
    const boundaries = {
      dashboard: DashboardView,
      project: ProjectInfoView,
      daily: DailyReportView,
      hr: HrView,
      buyin: BuyinView,
      pdf: PrintDailyReportSheet
    };

    for (const [feature, boundary] of Object.entries(boundaries)) {
      expect(boundary, `${feature} loader`).toBeDefined();
      expect(typeof (boundary as { render?: unknown }).render, `${feature} loader should remain lazy`).toBe("function");
    }
  });
});
