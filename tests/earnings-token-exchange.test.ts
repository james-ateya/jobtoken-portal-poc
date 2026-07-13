import { describe, expect, it } from "vitest";
import { tokensForKesAmount } from "../server/earnings-token-exchange";

describe("tokensForKesAmount", () => {
  it("converts whole tokens only", () => {
    const result = tokensForKesAmount(150);
    expect(result.tokens).toBeGreaterThanOrEqual(1);
    expect(result.kesDebited).toBe(result.tokens * 20);
  });

  it("returns zero tokens below one token worth", () => {
    const result = tokensForKesAmount(10);
    expect(result.tokens).toBe(0);
    expect(result.kesDebited).toBe(0);
  });
});
