import { describe, expect, it } from "vitest";

import { resolveDailyReportPermissions } from "@/lib/daily-report-permissions";
import { MEMBER_ROLES, type MemberRole } from "@/lib/access-control";

describe("daily report permissions", () => {
  it.each(["owner", "admin"] satisfies MemberRole[])("%s can use every Daily Report action", (role) => {
    expect(resolveDailyReportPermissions(role)).toEqual({
      canSaveReport: true,
      canSavePdf: true,
      canPreviewPdf: true,
      canExportJson: true,
      canCreateReport: true,
      canDeleteReport: true,
      canUseFullDailyActions: true
    });
  });

  it.each(MEMBER_ROLES.filter((role) => role !== "owner" && role !== "admin"))(
    "%s is treated as Member for Daily Report actions",
    (role) => {
      expect(resolveDailyReportPermissions(role)).toEqual({
        canSaveReport: true,
        canSavePdf: true,
        canPreviewPdf: true,
        canExportJson: false,
        canCreateReport: false,
        canDeleteReport: false,
        canUseFullDailyActions: false
      });
    }
  );

  it("keeps local/no-session workspaces owner-like", () => {
    expect(resolveDailyReportPermissions(null).canUseFullDailyActions).toBe(true);
    expect(resolveDailyReportPermissions(undefined).canUseFullDailyActions).toBe(true);
  });
});
