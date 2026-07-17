import { describe, expect, it, vi } from "vitest";

describe("runtime compatibility helpers", () => {
  it("uses native structuredClone when available", async () => {
    const nativeClone = vi.fn(<T>(value: T) => ({ ...(value as Record<string, unknown>) }) as T);
    const originalStructuredClone = globalThis.structuredClone;

    vi.stubGlobal("structuredClone", nativeClone);

    const { safeCloneSerializable } = await import("@/lib/runtime-compat");
    const payload = { id: "report-1", nested: { title: "Daily Report" } };
    const result = safeCloneSerializable(payload);

    expect(nativeClone).toHaveBeenCalledWith(payload);
    expect(result).toEqual(payload);

    vi.stubGlobal("structuredClone", originalStructuredClone);
  });

  it("falls back to JSON-safe cloning when structuredClone is unavailable", async () => {
    const originalStructuredClone = globalThis.structuredClone;

    vi.stubGlobal("structuredClone", undefined);

    const { safeCloneSerializable } = await import("@/lib/runtime-compat");
    const payload = { id: "report-1", nested: { title: "Daily Report" } };
    const result = safeCloneSerializable(payload);

    expect(result).toEqual(payload);
    expect(result).not.toBe(payload);
    expect(result.nested).not.toBe(payload.nested);

    vi.stubGlobal("structuredClone", originalStructuredClone);
  });

  it("sorts comparable values without using toSorted", async () => {
    const { sortWithCompare } = await import("@/lib/runtime-compat");

    const input = [{ id: "b", order: 2 }, { id: "a", order: 1 }];
    const result = sortWithCompare(input, (left, right) => left.order - right.order);

    expect(result).toEqual([{ id: "a", order: 1 }, { id: "b", order: 2 }]);
    expect(result).not.toBe(input);
  });
});
