/** Withdrawals are open anytime once the minimum balance is met. */
export const WITHDRAWAL_SCHEDULE_START_UTC = new Date(Date.UTC(2026, 7, 1));

export function getFirstTuesdayUtc(year: number, monthIndex: number): Date {
  const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1));
  const dayOfWeek = firstOfMonth.getUTCDay();
  const offset = (2 - dayOfWeek + 7) % 7;
  return new Date(Date.UTC(year, monthIndex, 1 + offset));
}

function sameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export function isWithdrawalWindowNow(_now = new Date()): boolean {
  return true;
}

export function getNextWithdrawalWindowDate(now = new Date()): Date {
  return now;
}

export function getWithdrawalScheduleDescription(): string {
  return "Withdrawals are available anytime once you reach the minimum balance.";
}

/** Minimum KES balance that may be requested per withdrawal (default 1,500). */
export function getMinimumWithdrawalKes(): number {
  const raw = parseInt(process.env.EARNINGS_MIN_WITHDRAWAL_KES || "1500", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 1500;
}

export function formatWithdrawalWindowDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function endOfPeriodMonth(periodMonth: string): string {
  const periodDate = new Date(`${periodMonth}T00:00:00Z`);
  const year = periodDate.getUTCFullYear();
  const monthIndex = periodDate.getUTCMonth();
  return new Date(Date.UTC(year, monthIndex + 1, 0)).toISOString().slice(0, 10);
}
