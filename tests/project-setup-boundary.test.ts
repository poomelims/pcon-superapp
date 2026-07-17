import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("project setup route boundary", () => {
  it("keeps the route thin and moves browser state into the workspace client component", () => {
    const page = readFileSync(join(process.cwd(), "app", "project-setup", "page.tsx"), "utf8");
    const workspace = readFileSync(join(process.cwd(), "app", "project-setup", "workspace.tsx"), "utf8");

    const loader = readFileSync(join(process.cwd(), "app", "project-setup", "workspace-loader.tsx"), "utf8");

    expect(page).toContain('import { ProjectControlWorkspaceLoader } from "./workspace-loader"');
    expect(page).not.toContain('"use client"');
    expect(loader).toContain('dynamic(');
    expect(loader).toContain('import("./workspace")');
    expect(loader).toContain("ssr: false");
    expect(workspace).toContain('"use client"');
    expect(workspace).toContain("export function ProjectControlWorkspace");
  });
});
