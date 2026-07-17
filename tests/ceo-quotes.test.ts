import { describe, expect, it } from "vitest";

import { CEO_QUOTES, FEATURED_CEO_QUOTES, getRandomCeoQuotes } from "@/lib/ceo-quotes";

describe("CEO quotes", () => {
  it("ships exactly 100 unique Thai CEO quotes and features the first four", () => {
    expect(CEO_QUOTES).toHaveLength(100);
    expect(new Set(CEO_QUOTES).size).toBe(100);
    expect(FEATURED_CEO_QUOTES).toEqual(CEO_QUOTES.slice(0, 4));

    for (const quote of CEO_QUOTES) {
      expect(quote.trim().length).toBeGreaterThan(20);
      expect(quote).not.toMatch(/lorem|todo|placeholder/i);
    }
  });

  it("can pick four unique random featured quotes from the full 100 quote library", () => {
    const pickedQuotes = getRandomCeoQuotes(4, () => 0.37);

    expect(pickedQuotes).toHaveLength(4);
    expect(new Set(pickedQuotes).size).toBe(4);

    for (const quote of pickedQuotes) {
      expect(CEO_QUOTES).toContain(quote);
    }
  });
});
