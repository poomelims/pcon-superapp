import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

test("HR save callbacks expose boolean success contracts", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app/project-setup/workspace.tsx"), "utf8");
  expect(source).toContain("function saveCrew(nextCrew: Crew): boolean");
  expect(source).toContain("function saveLaborExpense(nextExpense: LaborExpense): boolean");
});
