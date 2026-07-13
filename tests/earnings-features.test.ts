import { describe, expect, it } from "vitest";
import {
  earningsTokenExchangeDisabledMessage,
  isEarningsTokenExchangeEnabled,
} from "../server/earnings-features.js";

describe("earnings-features", () => {
  it("disables token exchange by default", () => {
    const prev = process.env.EARNINGS_TOKEN_EXCHANGE_ENABLED;
    delete process.env.EARNINGS_TOKEN_EXCHANGE_ENABLED;
    expect(isEarningsTokenExchangeEnabled()).toBe(false);
    if (prev !== undefined) process.env.EARNINGS_TOKEN_EXCHANGE_ENABLED = prev;
  });

  it("enables token exchange when env flag is true", () => {
    const prev = process.env.EARNINGS_TOKEN_EXCHANGE_ENABLED;
    process.env.EARNINGS_TOKEN_EXCHANGE_ENABLED = "true";
    expect(isEarningsTokenExchangeEnabled()).toBe(true);
    if (prev !== undefined) process.env.EARNINGS_TOKEN_EXCHANGE_ENABLED = prev;
    else delete process.env.EARNINGS_TOKEN_EXCHANGE_ENABLED;
  });

  it("returns disabled message", () => {
    expect(earningsTokenExchangeDisabledMessage()).toContain("temporarily unavailable");
  });
});
