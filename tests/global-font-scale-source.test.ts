import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("global font scale", () => {
  it("uses a larger readable base font size across the app", () => {
    const globals = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

    expect(globals).toContain("--app-base-font-size: 18px");
    expect(globals).toContain("font-size: var(--app-base-font-size)");
  });
});
