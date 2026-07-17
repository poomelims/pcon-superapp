import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("dashboard first-time entry", () => {
  it("keeps one primary create action when no project exists", () => {
    const source = readFileSync(
      join(process.cwd(), "app", "project-setup", "features", "dashboard", "dashboard-view.tsx"),
      "utf8"
    );

    expect(source).toContain('data-dashboard-empty-state="first-project"');
    expect(source).toContain("entryGuidance.primaryAction");
    expect(source).not.toContain('onClick={onNewProject}>\n                สร้างโปรเจกต์ใหม่');
  });
});
