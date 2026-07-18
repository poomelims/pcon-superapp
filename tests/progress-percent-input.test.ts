import { describe, expect, it } from "vitest";

import { commitProgressInputDraft, normalizeProgressInputDraft } from "@/app/project-setup/features/daily-report/progress-percent-input";

describe("Daily Report progress percent input", () => {
  it("keeps an empty draft while editing and removes leading zeroes", () => {
    expect(normalizeProgressInputDraft("")).toBe("");
    expect(normalizeProgressInputDraft("060")).toBe("60");
    expect(normalizeProgressInputDraft("0100")).toBe("100");
  });

  it("restores the previous value for an empty commit and clamps valid numbers", () => {
    expect(commitProgressInputDraft("", 60)).toBe(60);
    expect(commitProgressInputDraft("75", 60)).toBe(75);
    expect(commitProgressInputDraft("150", 60)).toBe(100);
  });
});
