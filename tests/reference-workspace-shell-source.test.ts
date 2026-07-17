import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workspaceSource = readFileSync(resolve(process.cwd(), "app/project-setup/workspace.tsx"), "utf8");
const mobileShellSource = readFileSync(resolve(process.cwd(), "app/project-setup/mobile-shell-ui.tsx"), "utf8");

describe("reference workspace shell source contract", () => {
  it("exposes the reference three-tab mobile navigation and hamburger menu", () => {
    expect(mobileShellSource).toContain("data-mobile-reference-tabs");
    expect(workspaceSource).toContain('label: "Project / BOQ"');
    expect(workspaceSource).toContain('aria-label="เมนูเพิ่มเติม"');
    expect(workspaceSource).not.toContain('data-mobile-main-modules\n                  className="sticky');
  });
});
