import { formatThaiMonthYearFromBangkokParts } from "@/lib/ingestDateTime";

export type IngestStatusSearchParams = {
  agencyId?: string;
  status?: string;
  jobId?: string;
  announceType?: string;
  month?: string;
  page?: string;
  httpBucket?: string;
  errorCategory?: string;
  day?: string;
};

export type StatusFilterQuery = {
  month?: string;
  agencyId?: string;
  jobId?: string;
  announceType?: string;
  status?: string;
  httpBucket?: string;
  errorCategory?: string;
  day?: string;
};

export function hasExplicitDateFilter(
  params: Pick<IngestStatusSearchParams, "month" | "day">,
): boolean {
  return Boolean(params.month?.trim() || params.day?.trim());
}

export type IngestOverview = {
  total: number;
  successCount: number;
  failedCount: number;
  successRate: number;
  avgDurationMs: number | null;
  sumItemsParsed: number;
  lastIngestAt: Date | null;
};

export type RecentJobRow = {
  jobId: string;
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  successCount: number;
  failedCount: number;
  totalCount: number;
  sumItemsParsed: number;
};

export type AgencySummaryRow = {
  agencyId: string;
  agencyName: string;
  successCount: number;
  totalCount: number;
  sumItemsParsed: number;
  successRate: number;
};

export type TypeSummaryRow = {
  code: string;
  label: string;
  successCount: number;
  totalCount: number;
  sumItemsParsed: number;
  hasPartialFailure: boolean;
  hasEmptyFeed: boolean;
};

export type HttpStatusBucket = {
  label: string;
  count: number;
};

export type TopErrorRow = {
  category: string;
  sample: string;
  count: number;
};

export type ErrorBreakdown = {
  httpBuckets: HttpStatusBucket[];
  topErrors: TopErrorRow[];
  totalFailed: number;
};

export type DailyTrendRow = {
  day: string;
  successCount: number;
  failedCount: number;
  totalCount: number;
};

export type DurationTrendRow = {
  day: string;
  avgDurationMs: number | null;
  p95DurationMs: number | null;
};

export type IngestDurationTrendRow = {
  jobId: string;
  startedAt: Date;
  durationMs: number;
  urlCount: number;
};

export type PerformanceStats = {
  avgDurationMs: number | null;
  p95DurationMs: number | null;
  dailyTrend: DailyTrendRow[];
  durationTrend: DurationTrendRow[];
  ingestDurationTrend: IngestDurationTrendRow[];
};

export function buildStatusQueryString(
  parts: IngestStatusSearchParams & { page?: string },
): string {
  const params = new URLSearchParams();
  if (parts.month?.trim()) params.set("month", parts.month.trim());
  if (parts.agencyId) params.set("agencyId", parts.agencyId);
  if (parts.status) params.set("status", parts.status);
  if (parts.jobId?.trim()) params.set("jobId", parts.jobId.trim());
  if (parts.announceType?.trim()) {
    params.set("announceType", parts.announceType.trim());
  }
  if (parts.httpBucket?.trim()) params.set("httpBucket", parts.httpBucket.trim());
  if (parts.errorCategory?.trim()) {
    params.set("errorCategory", parts.errorCategory.trim());
  }
  if (parts.day?.trim()) params.set("day", parts.day.trim());
  if (parts.page && parts.page !== "1") params.set("page", parts.page);
  return params.toString();
}

export function buildStatusHref(
  parts: IngestStatusSearchParams & { page?: string },
): string {
  const query = buildStatusQueryString(parts);
  return query ? `/egp/status?${query}` : "/egp/status";
}

export function buildStatusHrefWithout(
  parts: IngestStatusSearchParams,
  omit: keyof IngestStatusSearchParams,
): string {
  const next = { ...parts };
  delete next[omit];
  if (omit !== "page") delete next.page;
  return buildStatusHref(next);
}

export function formatThaiMonthYearFromParam(monthParam: string): string | null {
  const match = monthParam.trim().match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  return formatThaiMonthYearFromBangkokParts(year, month);
}
