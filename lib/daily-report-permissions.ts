import { type MemberRole } from "@/lib/access-control";

export type DailyReportPermissions = {
  canSaveReport: boolean;
  canSavePdf: boolean;
  canPreviewPdf: boolean;
  canExportJson: boolean;
  canCreateReport: boolean;
  canDeleteReport: boolean;
  canUseFullDailyActions: boolean;
};

const fullDailyReportPermissions: DailyReportPermissions = {
  canSaveReport: true,
  canSavePdf: true,
  canPreviewPdf: true,
  canExportJson: true,
  canCreateReport: true,
  canDeleteReport: true,
  canUseFullDailyActions: true
};

const memberDailyReportPermissions: DailyReportPermissions = {
  canSaveReport: true,
  canSavePdf: true,
  canPreviewPdf: true,
  canExportJson: false,
  canCreateReport: false,
  canDeleteReport: false,
  canUseFullDailyActions: false
};

export function isOwnerLikeRole(role: MemberRole | string | null | undefined): boolean {
  return !role || role === "owner" || role === "admin";
}

export function resolveDailyReportPermissions(role: MemberRole | string | null | undefined): DailyReportPermissions {
  return isOwnerLikeRole(role) ? { ...fullDailyReportPermissions } : { ...memberDailyReportPermissions };
}
