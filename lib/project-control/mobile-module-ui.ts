export type MobileSectionTone = "empty" | "in-progress" | "complete";

export type MobileModuleSectionMeta = {
  id: string;
  number: number;
  title: string;
  completed: number;
  total: number;
  tone: MobileSectionTone;
  statusLabel: string;
};

export type MobileContextAction = {
  label: string;
  disabled?: boolean;
  busy?: boolean;
};

export function getMobileSectionMeta(input: {
  id: string;
  number: number;
  title: string;
  completed: number;
  total: number;
}): MobileModuleSectionMeta {
  const total = Math.max(0, input.total);
  const completed = Math.min(total, Math.max(0, input.completed));
  const tone: MobileSectionTone = total > 0 && completed >= total ? "complete" : completed > 0 ? "in-progress" : "empty";

  return {
    ...input,
    completed,
    total,
    tone,
    statusLabel: tone === "complete" ? `${total}/${total} เสร็จสมบูรณ์` : `${completed}/${total} ไม่สมบูรณ์`
  };
}
