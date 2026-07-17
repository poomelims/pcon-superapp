import { describe, expect, it } from "vitest";

import {
  createDailyReportPdfFilename,
  hasPrintableContent,
  shouldPruneDailyReportMedia,
  limitProblemIssuePhotos,
  limitDailyReportPhotos,
  MAX_DAILY_REPORT_PHOTOS,
  MAX_PROBLEM_ISSUE_PHOTOS
} from "@/lib/daily-report-media";

describe("daily report media helpers", () => {
  it("caps photo collections at 12 items", () => {
    const photos = Array.from({ length: MAX_DAILY_REPORT_PHOTOS + 3 }, (_, index) => index);
    expect(limitDailyReportPhotos(photos)).toHaveLength(MAX_DAILY_REPORT_PHOTOS);
  });

  it("caps problem issue photo collections at 4 items", () => {
    const photos = Array.from({ length: MAX_PROBLEM_ISSUE_PHOTOS + 2 }, (_, index) => index);
    expect(limitProblemIssuePhotos(photos)).toHaveLength(MAX_PROBLEM_ISSUE_PHOTOS);
  });

  it("builds the required Thai-date daily report pdf filename", () => {
    expect(createDailyReportPdfFilename("Athenee", "2026-05-28")).toBe("Athenee_280569_DailyReport.pdf");
  });

  it("normalizes project names in daily report pdf filenames", () => {
    expect(createDailyReportPdfFilename("Athenee Phase 1 / โซน A", "2026-05-28")).toBe(
      "Athenee_Phase_1_โซน_A_280569_DailyReport.pdf"
    );
    expect(createDailyReportPdfFilename("  ??  ", "2026-05-28")).toBe("Project_280569_DailyReport.pdf");
  });

  it("detects printable content only when data exists", () => {
    expect(hasPrintableContent("")).toBe(false);
    expect(hasPrintableContent("   ")).toBe(false);
    expect(hasPrintableContent("มีข้อมูล")).toBe(true);
  });

  it("prunes daily report media only after the 3-day retention window", () => {
    expect(shouldPruneDailyReportMedia("2026-05-06", "2026-05-10")).toBe(true);
    expect(shouldPruneDailyReportMedia("2026-05-07", "2026-05-10")).toBe(false);
    expect(shouldPruneDailyReportMedia("2026-05-10", "2026-05-10")).toBe(false);
  });
});
