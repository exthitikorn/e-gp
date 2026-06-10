const BANGKOK = "Asia/Bangkok";
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

export function formatThaiDateTime(date: Date | null): string {
  if (!date) return "-";
  return date.toLocaleString("th-TH", { timeZone: BANGKOK });
}

export function formatDayKeyBangkok(date: Date): string {
  const bangkok = new Date(date.getTime() + BANGKOK_OFFSET_MS);
  const y = bangkok.getUTCFullYear();
  const m = String(bangkok.getUTCMonth() + 1).padStart(2, "0");
  const d = String(bangkok.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Normalize MySQL DATE / Prisma raw day values to YYYY-MM-DD (Bangkok). */
export function normalizeTrendDayKey(day: unknown): string {
  if (day instanceof Date) {
    return formatDayKeyBangkok(day);
  }
  const text = String(day);
  const iso = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return formatDayKeyBangkok(parsed);
  }
  return text.slice(0, 10);
}

function parseYearMonthDay(
  value: string,
  pattern: RegExp,
): { year: number; month: number; day: number } | null {
  const match = value.trim().match(pattern);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = match[3] != null ? Number(match[3]) : 1;

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  return { year, month, day };
}

/** Midnight Bangkok on the given calendar day, as UTC Date. */
function bangkokMidnightUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - BANGKOK_OFFSET_MS);
}

export function getBangkokMonthRange(
  monthParam: string | undefined,
): { gte: Date; lt: Date } | null {
  const parts = parseYearMonthDay(monthParam ?? "", /^(\d{4})-(\d{2})$/);
  if (!parts) return null;

  const gte = bangkokMidnightUtc(parts.year, parts.month, 1);
  const nextMonth = parts.month === 12 ? 1 : parts.month + 1;
  const nextYear = parts.month === 12 ? parts.year + 1 : parts.year;
  const lt = bangkokMidnightUtc(nextYear, nextMonth, 1);
  return { gte, lt };
}

export function getBangkokDayRange(
  dayParam: string | undefined,
): { gte: Date; lt: Date } | null {
  const parts = parseYearMonthDay(dayParam ?? "", /^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return null;

  const gte = bangkokMidnightUtc(parts.year, parts.month, parts.day);
  const nextDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  const lt = bangkokMidnightUtc(
    nextDay.getUTCFullYear(),
    nextDay.getUTCMonth() + 1,
    nextDay.getUTCDate(),
  );
  return { gte, lt };
}

/** Start of today in Bangkok, as UTC Date. */
export function getBangkokTodayStartUtc(now = new Date()): Date {
  const key = formatDayKeyBangkok(now);
  const parts = parseYearMonthDay(key, /^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return now;
  return bangkokMidnightUtc(parts.year, parts.month, parts.day);
}

/** Calendar yesterday in Bangkok [gte, lt), as UTC Dates. */
export function getBangkokYesterdayRange(now = new Date()): { gte: Date; lt: Date } {
  const todayStart = getBangkokTodayStartUtc(now);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
  return { gte: yesterdayStart, lt: todayStart };
}

/** Calendar day before `reference` in Bangkok [gte, lt), as UTC Dates. */
export function getBangkokPreviousDayRange(reference: Date): { gte: Date; lt: Date } {
  const dayStart = getBangkokTodayStartUtc(reference);
  const previousStart = new Date(dayStart);
  previousStart.setUTCDate(previousStart.getUTCDate() - 1);
  return { gte: previousStart, lt: dayStart };
}

export function getBangkokTrendSinceUtc(
  days: number,
  now = new Date(),
): Date {
  const todayStart = getBangkokTodayStartUtc(now);
  const since = new Date(todayStart);
  since.setUTCDate(since.getUTCDate() - (days - 1));
  return since;
}

export function formatIngestDayLabel(day: string): string {
  const parts = parseYearMonthDay(day, /^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return day;
  const date = bangkokMidnightUtc(parts.year, parts.month, parts.day);
  return date.toLocaleDateString("th-TH", {
    timeZone: BANGKOK,
    day: "numeric",
    month: "short",
  });
}

export function formatIngestDayLabelFromDate(date: Date): string {
  return formatIngestDayLabel(formatDayKeyBangkok(date));
}

export function formatPreviousIngestDayLabelFromDate(date: Date): string {
  const { gte } = getBangkokPreviousDayRange(date);
  return formatIngestDayLabel(formatDayKeyBangkok(gte));
}

export function formatThaiMonthYearFromBangkokParts(
  year: number,
  month: number,
): string {
  const date = bangkokMidnightUtc(year, month, 1);
  return date.toLocaleDateString("th-TH", {
    timeZone: BANGKOK,
    month: "long",
    year: "numeric",
  });
}
