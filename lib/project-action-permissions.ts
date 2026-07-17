import { isOwnerLikeRole } from "@/lib/daily-report-permissions";
import { type MemberRole } from "@/lib/access-control";

export type ProjectActionPermissions = {
  canSaveProject: boolean;
  canCreateProject: boolean;
  canSyncCloud: boolean;
  canLoadCloud: boolean;
  canSetCloudToken: boolean;
  canClearCloudToken: boolean;
  canExportJson: boolean;
  canImportJson: boolean;
  canDeleteProject: boolean;
  canDeleteBoq: boolean;
  canSeeProjectReadinessBadges: boolean;
  canUseFullProjectActions: boolean;
};

const fullProjectActionPermissions: ProjectActionPermissions = {
  canSaveProject: true,
  canCreateProject: true,
  canSyncCloud: true,
  canLoadCloud: true,
  canSetCloudToken: true,
  canClearCloudToken: true,
  canExportJson: true,
  canImportJson: true,
  canDeleteProject: true,
  canDeleteBoq: true,
  canSeeProjectReadinessBadges: true,
  canUseFullProjectActions: true
};

const memberProjectActionPermissions: ProjectActionPermissions = {
  canSaveProject: true,
  canCreateProject: true,
  canSyncCloud: true,
  canLoadCloud: true,
  canSetCloudToken: false,
  canClearCloudToken: false,
  canExportJson: false,
  canImportJson: false,
  canDeleteProject: false,
  canDeleteBoq: false,
  canSeeProjectReadinessBadges: false,
  canUseFullProjectActions: false
};

export function resolveProjectActionPermissions(role: MemberRole | string | null | undefined): ProjectActionPermissions {
  return isOwnerLikeRole(role) ? { ...fullProjectActionPermissions } : { ...memberProjectActionPermissions };
}
