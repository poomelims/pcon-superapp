import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const workspaceSource = () => readFileSync(
  join(process.cwd(), "app", "project-setup", "workspace.tsx"),
  "utf8"
);

describe("privileged delete security source contract", () => {
  it("requires an Admin/Owner password recheck for privileged deletes", () => {
    const source = workspaceSource();

    expect(source).toContain("confirmPrivilegedDeletePassword");
    expect(source).toContain("กรอกรหัสผ่าน Admin/Owner อีกครั้ง");
    expect(source).toContain("signInWithPassword");
    expect(source).toContain("เฉพาะ Admin/Owner เท่านั้นที่ลบได้");
  });
});
