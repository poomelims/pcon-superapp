import { exportProjectControlJson, importProjectControlJson } from "@/lib/project-control/import-export";
import { loadLocalData, saveLocalData } from "@/lib/project-control/local-repository";
import type { ProjectControlData } from "./types";

export type ProjectControlRepository = {
  load(): ProjectControlData;
  save(data: ProjectControlData): void;
  importJson(rawJson: string): ProjectControlData;
  exportJson(data: ProjectControlData): string;
};

export const browserProjectControlRepository: ProjectControlRepository = {
  load: loadLocalData,
  save: saveLocalData,
  importJson: importProjectControlJson,
  exportJson: exportProjectControlJson
};
