import { describe, expect, it } from "vitest";

import { MEMBER_ROLES, type MemberRole } from "@/lib/access-control";
import { resolveProjectActionPermissions } from "@/lib/project-action-permissions";

describe("project action permissions", () => {
  it.each(["owner", "admin"] satisfies MemberRole[])("%s can use every Project action", (role) => {
    expect(resolveProjectActionPermissions(role)).toEqual({
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
    });
  });

  it.each(MEMBER_ROLES.filter((role) => role !== "owner" && role !== "admin"))(
    "%s can save, sync, and load cloud without owner-only project actions",
    (role) => {
      expect(resolveProjectActionPermissions(role)).toEqual({
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
      });
    }
  );

  it("keeps local/no-session Project workspaces owner-like", () => {
    expect(resolveProjectActionPermissions(null).canUseFullProjectActions).toBe(true);
    expect(resolveProjectActionPermissions(undefined).canUseFullProjectActions).toBe(true);
  });
});
