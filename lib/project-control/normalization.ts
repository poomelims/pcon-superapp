import { importProjectControlJson } from "@/lib/project-control/storage-core";
import type { ProjectControlData } from "@/lib/project-control/types";

/** Normalize unknown legacy JSON through the same guardrails used by Import. */
export function normalizeProjectControlData(value: unknown, today?: string): ProjectControlData {
  return importProjectControlJson(JSON.stringify(value), today);
}
