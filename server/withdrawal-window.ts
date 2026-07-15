/** Withdrawal requests open on the first Tuesday of each month from August 2026. */
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

export function isWithdrawalWindowNow(now = new Date()): boolean {
  if (now < WITHDRAWAL_SCHEDULE_START_UTC) return false;
  const firstTuesday = getFirstTuesdayUtc(now.getUTCFullYear(), now.getUTCMonth());
  return sameUtcDay(now, firstTuesday);
}

export function getNextWithdrawalWindowDate(now = new Date()): Date {
  if (now < WITHDRAWAL_SCHEDULE_START_UTC) {
    return getFirstTuesdayUtc(2026, 7);
  }

  const firstTuesdayThisMonth = getFirstTuesdayUtc(
    now.getUTCFullYear(),
    now.getUTCMonth()
  );

  if (sameUtcDay(now, firstTuesdayThisMonth)) {
    return firstTuesdayThisMonth;
  }

  if (now.getTime() < firstTuesdayThisMonth.getTime()) {
    return firstTuesdayThisMonth;
  }

  const nextMonthIndex = now.getUTCMonth() + 1;
  const year = nextMonthIndex > 11 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
  const monthIndex = nextMonthIndex % 12;
  return getFirstTuesdayUtc(year, monthIndex);
}

export function getWithdrawalScheduleDescription(): string {
  return "First Tuesday of each month (from August 2026)";
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
