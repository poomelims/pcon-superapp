import { describe, expect, it } from "vitest";

import {
  canExportDailyReportPdf,
  calculatePdfImageLayout,
  calculatePdfPageSlices,
  getPdfExportOptions,
  pdfSafeColorsForClassName
} from "@/lib/daily-report-pdf";

describe("daily report pdf export helpers", () => {
  it("allows PDF export without opening preview when project, report, and export root exist", () => {
    expect(canExportDailyReportPdf({ hasProject: true, hasReport: true, hasExportRoot: true })).toBe(true);
    expect(canExportDailyReportPdf({ hasProject: false, hasReport: true, hasExportRoot: true })).toBe(false);
    expect(canExportDailyReportPdf({ hasProject: true, hasReport: false, hasExportRoot: true })).toBe(false);
    expect(canExportDailyReportPdf({ hasProject: true, hasReport: true, hasExportRoot: false })).toBe(false);
  });

  it("calculates A4 image pagination for short and long report captures", () => {
    expect(calculatePdfImageLayout({ canvasWidth: 1000, canvasHeight: 1200 })).toMatchObject({
      pageCount: 1,
      imageWidthMm: 190
    });

    const longLayout = calculatePdfImageLayout({ canvasWidth: 1000, canvasHeight: 4200 });

    expect(longLayout.pageCount).toBe(3);
    expect(longLayout.contentHeightMm).toBe(277);
    expect(longLayout.imageHeightMm).toBeCloseTo(798);
    expect(longLayout.pageYPositions).toEqual([10, -267, -544]);
  });

  it("chooses safe PDF page slices from section breakpoints", () => {
    const slices = calculatePdfPageSlices({
      canvasWidth: 1000,
      canvasHeight: 3000,
      breakpointsPx: [0, 900, 1800, 3000]
    });

    expect(slices).toEqual([
      { topPx: 0, heightPx: 900 },
      { topPx: 900, heightPx: 900 },
      { topPx: 1800, heightPx: 1200 }
    ]);
  });

  it("maps Tailwind v4 PDF colors to html2canvas-safe colors", () => {
    expect(pdfSafeColorsForClassName("bg-slate-950 text-white border-slate-950")).toMatchObject({
      backgroundColor: "#0f172a",
      borderColor: "#0f172a",
      color: "#ffffff"
    });

    expect(pdfSafeColorsForClassName("bg-red-50/40 text-red-700 border-red-100")).toMatchObject({
      backgroundColor: "#fef2f2",
      borderColor: "#fee2e2",
      color: "#b91c1c"
    });

    expect(pdfSafeColorsForClassName("h-full bg-teal-700")).toMatchObject({
      backgroundColor: "#0f766e"
    });
  });

  it("uses exact A4 export options for preview-matched PDF output", () => {
    expect(getPdfExportOptions("exact-a4")).toMatchObject({
      marginMm: 0,
      pageWidthMm: 210,
      pageHeightMm: 297,
      imageQuality: 0.95
    });

    const slices = calculatePdfPageSlices({
      canvasWidth: 794,
      canvasHeight: 2246,
      ...getPdfExportOptions("exact-a4")
    });

    expect(slices).toEqual([
      { topPx: 0, heightPx: 1123 },
      { topPx: 1123, heightPx: 1123 }
    ]);
  });

  it("starts a new PDF page at the nearest safe content breakpoint", () => {
    const slices = calculatePdfPageSlices({
      canvasWidth: 794,
      canvasHeight: 2500,
      breakpointsPx: [0, 900, 1500, 2500],
      ...getPdfExportOptions("exact-a4")
    });

    expect(slices).toEqual([
      { topPx: 0, heightPx: 900 },
      { topPx: 900, heightPx: 600 },
      { topPx: 1500, heightPx: 1000 }
    ]);
  });

  it("honors forced page breaks before later safe breakpoints", () => {
    const slices = calculatePdfPageSlices({
      canvasWidth: 794,
      canvasHeight: 2500,
      breakpointsPx: [0, 900, 1080, 1500, 2500],
      forcedBreakpointsPx: [900],
      ...getPdfExportOptions("exact-a4")
    });

    expect(slices).toEqual([
      { topPx: 0, heightPx: 900 },
      { topPx: 900, heightPx: 600 },
      { topPx: 1500, heightPx: 1000 }
    ]);
  });
});
