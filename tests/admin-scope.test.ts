import { describe, expect, it } from "vitest";

describe("admin target company scope", () => {
  it("uses the authenticated admin company when no target is supplied", async () => {
    const { resolveAdminTargetCompanyId } = await import("@/lib/admin-scope");

    expect(resolveAdminTargetCompanyId(undefined, "company-a")).toBe("company-a");
    expect(resolveAdminTargetCompanyId("", "company-a")).toBe("company-a");
  });

  it("rejects a target company different from the authenticated admin", async () => {
    const { resolveAdminTargetCompanyId } = await import("@/lib/admin-scope");

    expect(() => resolveAdminTargetCompanyId("company-b", "company-a")).toThrow("ไม่มีสิทธิ์");
  });
});
