export function safeCloneSerializable<T>(value: T): T {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

export function sortWithCompare<T>(items: readonly T[], compare: (left: T, right: T) => number): T[] {
  return [...items].sort(compare);
}
