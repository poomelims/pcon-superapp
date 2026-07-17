import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const pdfViewSource = () => readFileSync(
  join(process.cwd(), "app", "project-setup", "features", "pdf", "daily-report-sheet.tsx"),
  "utf8"
);
const pdfExportSource = () => readFileSync(
  join(process.cwd(), "lib", "daily-report-pdf.ts"),
  "utf8"
);

describe("daily report PDF document layout source", () => {
  it("keeps financial values out of the PDF document", () => {
    const source = pdfViewSource();

    expect(source).not.toContain("BOQ");
    expect(source).not.toContain("Contract");
    expect(source).not.toContain("Budget");
    expect(source).not.toContain("formatCurrency");
    expect(source).not.toContain("calculateOverallBoqTotal");
  });

  it("marks safe PDF sections for export slicing", () => {
    const source = pdfViewSource();

    expect(source).toContain("data-pdf-section=\"true\"");
  });

  it("keeps deterministic gallery markers for problem and site photos", () => {
    const source = pdfViewSource();

    expect(source).toContain("data-pdf-gallery={galleryId}");
    expect(source).toContain("data-pdf-photo-card=\"true\"");
    expect(source).toContain("data-pdf-force-page-break={forcePageBreakBefore ? \"before\" : undefined}");
    expect(source).toContain("galleryId=\"problem-photos\"");
    expect(source).toContain("galleryId=\"site-photos\"");
    expect(source).toContain("report.photos.slice(0, MAX_DAILY_REPORT_PHOTOS)");
  });

  it("uses live reporter props and project site contact fields in the PDF info grid", () => {
    const source = pdfViewSource();

    expect(source).toContain("reporterName");
    expect(source).toContain("reporterPhone");
    expect(source).toContain('{ label: "ผู้ทำรายการ", value: reporterName || "-" }');
    expect(source).toContain('{ label: "เบอร์โทรผู้ทำรายการ", value: reporterPhone || "-" }');
    expect(source).toContain('{ label: "ผู้ติดต่อไซต์", value: project.customer.siteContact || "-" }');
    expect(source).toContain('{ label: "เบอร์โทรผู้ติดต่อไซต์", value: project.customer.phone || "-" }');
    expect(source).not.toContain("report.preparedByPhone");
  });

  it("passes PDF section and photo breakpoints into export slicing", () => {
    const source = pdfExportSource();

    expect(source).toContain("collectPdfBreakpoints");
    expect(source).toContain("[data-pdf-section=\"true\"]");
    expect(source).toContain("[data-pdf-photo-card=\"true\"]");
    expect(source).toContain("[data-pdf-force-page-break=\"before\"]");
    expect(source).toContain("breakpointsPx:");
    expect(source).toContain("forcedBreakpointsPx");
  });
});
