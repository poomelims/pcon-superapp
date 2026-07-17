export type MobileWorkspaceTabId = "dashboard" | "daily" | "info" | "hr" | "buyin";

export type MobilePrimaryTab = {
  id: Extract<MobileWorkspaceTabId, "dashboard" | "daily" | "info">;
  label: string;
  icon: "dashboard" | "daily" | "project";
};

const mobilePrimaryTabs: MobilePrimaryTab[] = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "daily", label: "Daily Report", icon: "daily" },
  { id: "info", label: "Project", icon: "project" }
];

export function getMobilePrimaryTabs(): MobilePrimaryTab[] {
  return mobilePrimaryTabs.map((tab) => ({ ...tab }));
}

export function isMobilePrimaryTab(value: MobileWorkspaceTabId): value is MobilePrimaryTab["id"] {
  return value === "dashboard" || value === "daily" || value === "info";
}
