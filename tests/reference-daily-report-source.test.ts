import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "app/project-setup/features/daily-report/daily-report-view.tsx"), "utf8");
const sectionSource = readFileSync(resolve(process.cwd(), "app/project-setup/features/daily-report/daily-quick-section.tsx"), "utf8");

describe("reference daily report source contract", () => {
  it("contains the compact today summary and numbered field-first sections", () => {
    expect(source).toContain('data-daily-reference-summary');
    expect(source).toContain("number={dailySectionMeta.work.number}");
    expect(source).toContain("number={dailySectionMeta.plan.number}");
    expect(source).toContain("number={dailySectionMeta.photos.number}");
    expect(source).toContain('title="รูปงานประจำวัน"');
    expect(source).toContain("data-daily-report-photo-input");
    expect(sectionSource).toContain("data-daily-reference-section-number={number}");
    expect(source).toContain("วันนี้");
    expect(source).toContain("เปลี่ยนวันที่");
  });
});
