import { describe, expect, it } from "vitest";

import {
  createCompanyCodeValue,
  isCompanyCodeUsable,
  normalizeCompanyCode,
  sanitizeEmail,
  validateCompanyRequestInput,
  validateRegisterInput
} from "@/lib/auth-platform";

describe("AUTH-1 platform helpers", () => {
  it("generates normalized hard-to-guess company codes", () => {
    const code = createCompanyCodeValue(() => new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));

    expect(code).toMatch(/^PCON-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(code.replace("PCON-", "")).not.toMatch(/[IO01]/);
    expect(normalizeCompanyCode(" pcon-abcd-efgh ")).toBe("PCON-ABCD-EFGH");
  });

  it("validates company code availability", () => {
    expect(isCompanyCodeUsable({ status: "active", usedCount: 1 })).toEqual({ ok: true });
    expect(isCompanyCodeUsable({ status: "inactive", usedCount: 0 })).toEqual({ ok: false, message: "รหัสบริษัทไม่พร้อมใช้งาน" });
    expect(isCompanyCodeUsable({ status: "active", usedCount: 2, maxUses: 2 })).toEqual({ ok: false, message: "รหัสบริษัทถูกใช้ครบแล้ว" });
    expect(isCompanyCodeUsable({ status: "active", usedCount: 0, expiresAt: "2026-01-01T00:00:00.000Z" }, new Date("2026-05-22"))).toEqual({
      ok: false,
      message: "รหัสบริษัทหมดอายุ"
    });
  });

  it("validates registration and company request input", () => {
    expect(validateRegisterInput({ email: " USER@GMAIL.COM ", password: "123456", confirmPassword: "123456", displayName: " คุณเอ " })).toMatchObject({
      email: "user@gmail.com",
      displayName: "คุณเอ"
    });
    expect(() => validateRegisterInput({ email: "bad", password: "123456", confirmPassword: "123456", displayName: "A" })).toThrow("อีเมลไม่ถูกต้อง");
    expect(() => validateRegisterInput({ email: "a@b.com", password: "123", confirmPassword: "123", displayName: "A" })).toThrow("Password");
    expect(() => validateRegisterInput({ email: "a@b.com", password: "123456", confirmPassword: "654321", displayName: "A" })).toThrow("ไม่ตรงกัน");

    expect(sanitizeEmail(" A@B.COM ")).toBe("a@b.com");
    expect(validateCompanyRequestInput({ companyName: " MTNC ", requesterEmail: "owner@example.com" })).toMatchObject({
      companyName: "MTNC",
      contactEmail: "owner@example.com"
    });
  });
});
