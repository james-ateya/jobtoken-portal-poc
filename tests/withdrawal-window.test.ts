import { describe, expect, it } from "vitest";
import {
  formatWithdrawalWindowDate,
  getFirstTuesdayUtc,
  getMinimumWithdrawalKes,
  getNextWithdrawalWindowDate,
  isWithdrawalWindowNow,
} from "../server/withdrawal-window";

describe("withdrawal window", () => {
  it("finds first Tuesday of August 2026", () => {
    const date = getFirstTuesdayUtc(2026, 7);
    expect(formatWithdrawalWindowDate(date)).toBe("2026-08-04");
  });

  it("opens only on the first Tuesday from August 2026", () => {
    expect(isWithdrawalWindowNow(new Date("2026-07-13T12:00:00Z"))).toBe(false);
    expect(isWithdrawalWindowNow(new Date("2026-08-04T12:00:00Z"))).toBe(true);
    expect(isWithdrawalWindowNow(new Date("2026-08-05T12:00:00Z"))).toBe(false);
  });

  it("returns August 2026 first Tuesday before schedule starts", () => {
    const next = getNextWithdrawalWindowDate(new Date("2026-07-13T12:00:00Z"));
    expect(formatWithdrawalWindowDate(next)).toBe("2026-08-04");
  });

  it("returns same month Tuesday when still before it", () => {
    const next = getNextWithdrawalWindowDate(new Date("2026-09-01T12:00:00Z"));
    expect(formatWithdrawalWindowDate(next)).toBe("2026-09-01");
  });

  it("returns next month Tuesday after window passes", () => {
    const next = getNextWithdrawalWindowDate(new Date("2026-09-02T12:00:00Z"));
    expect(formatWithdrawalWindowDate(next)).toBe("2026-10-06");
  });

  it("defaults minimum withdrawal to 5000 KES", () => {
    const previous = process.env.EARNINGS_MIN_WITHDRAWAL_KES;
    delete process.env.EARNINGS_MIN_WITHDRAWAL_KES;
    expect(getMinimumWithdrawalKes()).toBe(5000);
    process.env.EARNINGS_MIN_WITHDRAWAL_KES = previous;
  });
});
