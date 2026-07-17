import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("daily work item editor source contract", () => {
  it("supports adding, toggling, editing, and deleting real work item rows", () => {
    const source = readFileSync(
      resolve(process.cwd(), "app/project-setup/features/daily-report/daily-work-item-editor.tsx"),
      "utf8"
    );

    expect(source).toContain("เพิ่มงาน");
    expect(source).toContain("onToggleStatus");
    expect(source).toContain("onUpdateTitle");
    expect(source).toContain("onDelete");
    expect(source).toContain('type="checkbox"');
  });
});
