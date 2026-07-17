import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("daily report mobile tool priority", () => {
  it("groups secondary tools so save remains the primary mobile action", () => {
    const source = readFileSync(
      join(process.cwd(), "app", "project-setup", "features", "daily-report", "daily-report-view.tsx"),
      "utf8"
    );

    expect(source).toContain("เครื่องมือเพิ่มเติม");
    expect(source).toContain("data-daily-secondary-tools");
  });
});
