import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { APP_PACKAGE_VERSION, APP_VERSION } from "@/lib/app-version";

describe("app version", () => {
  it("exposes v1.3.7 as the visible app patch version while package uses 1.3.7", () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { version: string };
    expect(APP_VERSION).toBe("1.3.7");
    expect(APP_PACKAGE_VERSION).toBe("1.3.7");
    expect(packageJson.version).toBe(APP_PACKAGE_VERSION);
  });
});
