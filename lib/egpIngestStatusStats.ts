import "server-only";

import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import {
  formatDayKeyBangkok,
  getBangkokDayRange,
  getBangkokMonthRange,
  getBangkokTrendSinceUtc,
  getBangkokPreviousDayRange,
  normalizeTrendDayKey,
} from "@/lib/ingestDateTime";
import type {
  AgencySummaryRow,
  DailyTrendRow,
  ErrorBreakdown,
  IngestOverview,
  IngestStatusSearchParams,
  PerformanceStats,
  RecentJobRow,
  TypeSummaryRow,
} from "@/lib/egpIngestStatusShared";
import {
  ALL_EGP_ANNOUNCE_TYPES,
  getEgpAnnounceTypeLabel,
} from "@/lib/egpRss";

export type {
  AgencySummaryRow,
  DailyTrendRow,
  DurationTrendRow,
  ErrorBreakdown,
  HttpStatusBucket,
  IngestDurationTrendRow,
  IngestOverview,
  IngestStatusSearchParams,
  PerformanceStats,
  RecentJobRow,
  StatusFilterQuery,
  TopErrorRow,
  TypeSummaryRow,
} from "@/lib/egpIngestStatusShared";

export {
  buildStatusHref,
  buildStatusHrefWithout,
  buildStatusQueryString,
  formatThaiMonthYearFromParam,
  hasExplicitDateFilter,
} from "@/lib/egpIngestStatusShared";

export type IngestStatusDashboardData = {
  where: Prisma.EgpIngestUrlLogWhereInput;
  agencies: { id: string; name: string }[];
  overview: IngestOverview;
  recentJobs: RecentJobRow[];
  yesterdayLatestIngestDurationMs: number | null;
  agencySummary: AgencySummaryRow[];
  typeSummary: TypeSummaryRow[];
  errorBreakdown: ErrorBreakdown;
  performance: PerformanceStats;
};

const PAGE_SIZE = 10;
const RECENT_JOBS_LIMIT = 5;
const TOP_ERRORS_LIMIT = 8;
const DAILY_TREND_LIMIT = 31;
const INGEST_DURATION_TREND_LIMIT = 20;

function buildHttpBucketWhere(
  httpBucket: string,
): Prisma.EgpIngestUrlLogWhereInput | null {
  const value = httpBucket.trim();
  if (!value) return null;

  if (value === "network") return { httpStatus: null };
  if (value === "2xx") return { httpStatus: { gte: 200, lt: 300 } };
  if (value === "4xx") return { httpStatus: { gte: 400, lt: 500 } };
  if (value === "5xx") return { httpStatus: { gte: 500, lt: 600 } };

  const code = Number(value);
  if (Number.isFinite(code)) return { httpStatus: code };

  return null;
}

function buildErrorCategoryWhere(
  categoryParam: string,
): Prisma.EgpIngestUrlLogWhereInput {
  const category = decodeURIComponent(categoryParam.trim());

  if (category === "Rate limit (429)") {
    return {
      OR: [
        { httpStatus: 429 },
        { errorMessage: { contains: "429" } },
        { errorMessage: { contains: "too many requests" } },
      ],
    };
  }

  if (category === "Timeout / aborted") {
    return {
      OR: [
        { errorMessage: { contains: "AbortError" } },
        { errorMessage: { contains: "aborted" } },
        { errorMessage: { contains: "timeout" } },
        { errorMessage: { contains: "ETIMEDOUT" } },
        { errorMessage: { contains: "timed out" } },
      ],
    };
  }

  if (category === "Network error") {
    return {
      OR: [
        { errorMessage: { contains: "ECONNRESET" } },
        { errorMessage: { contains: "ECONNREFUSED" } },
        { errorMessage: { contains: "ENOTFOUND" } },
        { errorMessage: { contains: "network" } },
        { errorMessage: { contains: "fetch failed" } },
      ],
    };
  }

  if (category === "HTTP 200 (unexpected failure)") {
    return { httpStatus: 200 };
  }

  if (category === "Unknown error") {
    return { OR: [{ errorMessage: null }, { errorMessage: "" }] };
  }

  const serverMatch = category.match(/^HTTP (\d+) \(server error\)$/);
  if (serverMatch) return { httpStatus: Number(serverMatch[1]) };

  const clientMatch = category.match(/^HTTP (\d+) \(client error\)$/);
  if (clientMatch) return { httpStatus: Number(clientMatch[1]) };

  const needle = category.endsWith("…") ? category.slice(0, -1) : category;
  return { errorMessage: { contains: needle } };
}

export function buildIngestLogWhere(
  resolved: IngestStatusSearchParams,
): Prisma.EgpIngestUrlLogWhereInput {
  const where: Prisma.EgpIngestUrlLogWhereInput = {};

  if (resolved.agencyId) {
    where.agencyId = resolved.agencyId;
  }

  if (resolved.status === "success" || resolved.status === "failed") {
    where.status = resolved.status;
  }

  if (resolved.jobId?.trim()) {
    where.jobId = { contains: resolved.jobId.trim() };
  }

  if (resolved.announceType?.trim()) {
    where.announceType = resolved.announceType.trim();
  }

  if (resolved.httpBucket?.trim()) {
    const httpWhere = buildHttpBucketWhere(resolved.httpBucket);
    if (httpWhere) Object.assign(where, httpWhere);
  }

  if (resolved.errorCategory?.trim()) {
    const categoryWhere = buildErrorCategoryWhere(resolved.errorCategory);
    where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), categoryWhere];
  }

  const dayRange = getBangkokDayRange(resolved.day);
  const monthRange = getBangkokMonthRange(resolved.month);
  if (dayRange) {
    where.createdAt = { gte: dayRange.gte, lt: dayRange.lt };
  } else if (monthRange) {
    where.createdAt = { gte: monthRange.gte, lt: monthRange.lt };
  }

  return where;
}

export function categorizeError(
  message: string | null,
  httpStatus: number | null,
): string {
  if (httpStatus != null) {
    if (httpStatus === 429) return "Rate limit (429)";
    if (httpStatus >= 500) return `HTTP ${httpStatus} (server error)`;
    if (httpStatus >= 400) return `HTTP ${httpStatus} (client error)`;
    if (httpStatus === 200) return "HTTP 200 (unexpected failure)";
  }

  const text = (message ?? "").trim();
  if (!text) return "Unknown error";

  if (/AbortError|aborted|timeout|ETIMEDOUT|timed out/i.test(text)) {
    return "Timeout / aborted";
  }
  if (/ECONNRESET|ECONNREFUSED|ENOTFOUND|network|fetch failed/i.test(text)) {
    return "Network error";
  }
  if (/429|too many requests/i.test(text)) return "Rate limit (429)";

  const shortened = text
    .replace(/https?:\/\/[^\s]+/gi, "[url]")
    .slice(0, 120);
  return shortened.length < text.length ? `${shortened}…` : shortened;
}

function httpBucketLabel(httpStatus: number | null): string {
  if (httpStatus == null) return "ไม่มี HTTP (network)";
  if (httpStatus >= 200 && httpStatus < 300) return "2xx";
  if (httpStatus >= 400 && httpStatus < 500) return "4xx";
  if (httpStatus >= 500) return "5xx";
  return `HTTP ${httpStatus}`;
}

function trendWhere(
  baseWhere: Prisma.EgpIngestUrlLogWhereInput,
): Prisma.EgpIngestUrlLogWhereInput {
  if (baseWhere.createdAt) return baseWhere;

  const since = getBangkokTrendSinceUtc(DAILY_TREND_LIMIT);

  return {
    ...baseWhere,
    createdAt: { gte: since },
  };
}

function percentile95(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const offset = Math.floor(0.95 * (sorted.length - 1));
  return sorted[offset] ?? null;
}

function computeIngestDurationMs(
  startedAt: Date,
  finishedAt: Date,
  sumDurationMs: number,
): number {
  const wallDurationMs = finishedAt.getTime() - startedAt.getTime();
  return wallDurationMs > 0 ? wallDurationMs : sumDurationMs;
}

function sqlWhere(clauses: Prisma.Sql[]): Prisma.Sql {
  if (clauses.length === 0) return Prisma.sql`1 = 1`;
  return Prisma.join(clauses, " AND ");
}

function buildHttpBucketSql(httpBucket: string): Prisma.Sql | null {
  const value = httpBucket.trim();
  if (!value) return null;
  if (value === "network") return Prisma.sql`httpStatus IS NULL`;
  if (value === "2xx") return Prisma.sql`httpStatus >= 200 AND httpStatus < 300`;
  if (value === "4xx") return Prisma.sql`httpStatus >= 400 AND httpStatus < 500`;
  if (value === "5xx") return Prisma.sql`httpStatus >= 500 AND httpStatus < 600`;
  const code = Number(value);
  if (Number.isFinite(code)) return Prisma.sql`httpStatus = ${code}`;
  return null;
}

function buildErrorCategorySql(categoryParam: string): Prisma.Sql | null {
  const category = decodeURIComponent(categoryParam.trim());

  if (category === "Rate limit (429)") {
    return Prisma.sql`(httpStatus = 429 OR errorMessage LIKE '%429%' OR errorMessage LIKE '%too many requests%')`;
  }
  if (category === "Timeout / aborted") {
    return Prisma.sql`(errorMessage LIKE '%AbortError%' OR errorMessage LIKE '%aborted%' OR errorMessage LIKE '%timeout%' OR errorMessage LIKE '%ETIMEDOUT%' OR errorMessage LIKE '%timed out%')`;
  }
  if (category === "Network error") {
    return Prisma.sql`(errorMessage LIKE '%ECONNRESET%' OR errorMessage LIKE '%ECONNREFUSED%' OR errorMessage LIKE '%ENOTFOUND%' OR errorMessage LIKE '%network%' OR errorMessage LIKE '%fetch failed%')`;
  }
  if (category === "HTTP 200 (unexpected failure)") {
    return Prisma.sql`httpStatus = 200`;
  }
  if (category === "Unknown error") {
    return Prisma.sql`(errorMessage IS NULL OR errorMessage = '')`;
  }

  const serverMatch = category.match(/^HTTP (\d+) \(server error\)$/);
  if (serverMatch) return Prisma.sql`httpStatus = ${Number(serverMatch[1])}`;

  const clientMatch = category.match(/^HTTP (\d+) \(client error\)$/);
  if (clientMatch) return Prisma.sql`httpStatus = ${Number(clientMatch[1])}`;

  const needle = category.endsWith("…") ? category.slice(0, -1) : category;
  return Prisma.sql`errorMessage LIKE ${`%${needle}%`}`;
}

function buildIngestLogSqlClauses(
  resolved: IngestStatusSearchParams,
  options?: { forceStatus?: string; trendSince?: Date },
): Prisma.Sql[] {
  const clauses: Prisma.Sql[] = [];

  if (options?.forceStatus) {
    clauses.push(Prisma.sql`status = ${options.forceStatus}`);
  } else if (resolved.status === "success" || resolved.status === "failed") {
    clauses.push(Prisma.sql`status = ${resolved.status}`);
  }

  if (resolved.agencyId) {
    clauses.push(Prisma.sql`agencyId = ${resolved.agencyId}`);
  }

  if (resolved.jobId?.trim()) {
    clauses.push(Prisma.sql`jobId LIKE ${`%${resolved.jobId.trim()}%`}`);
  }

  if (resolved.announceType?.trim()) {
    clauses.push(Prisma.sql`announceType = ${resolved.announceType.trim()}`);
  }

  if (resolved.httpBucket?.trim()) {
    const httpSql = buildHttpBucketSql(resolved.httpBucket.trim());
    if (httpSql) clauses.push(httpSql);
  }

  if (resolved.errorCategory?.trim()) {
    const errorSql = buildErrorCategorySql(resolved.errorCategory);
    if (errorSql) clauses.push(errorSql);
  }

  const dayRange = getBangkokDayRange(resolved.day);
  const monthRange = getBangkokMonthRange(resolved.month);
  if (dayRange) {
    clauses.push(
      Prisma.sql`createdAt >= ${dayRange.gte} AND createdAt < ${dayRange.lt}`,
    );
  } else if (monthRange) {
    clauses.push(
      Prisma.sql`createdAt >= ${monthRange.gte} AND createdAt < ${monthRange.lt}`,
    );
  } else if (options?.trendSince) {
    clauses.push(Prisma.sql`createdAt >= ${options.trendSince}`);
  }

  return clauses;
}

function errorCategorySql(): Prisma.Sql {
  return Prisma.sql`
    CASE
      WHEN httpStatus = 429 THEN 'Rate limit (429)'
      WHEN httpStatus >= 500 THEN CONCAT('HTTP ', httpStatus, ' (server error)')
      WHEN httpStatus >= 400 AND httpStatus < 500 THEN CONCAT('HTTP ', httpStatus, ' (client error)')
      WHEN httpStatus = 200 THEN 'HTTP 200 (unexpected failure)'
      WHEN TRIM(COALESCE(errorMessage, '')) = '' THEN 'Unknown error'
      WHEN LOWER(errorMessage) REGEXP 'aborterror|aborted|timeout|etimedout|timed out' THEN 'Timeout / aborted'
      WHEN LOWER(errorMessage) REGEXP 'econnreset|econnrefused|enotfound|network|fetch failed' THEN 'Network error'
      WHEN LOWER(errorMessage) REGEXP '429|too many requests' THEN 'Rate limit (429)'
      ELSE LEFT(COALESCE(errorMessage, 'Unknown error'), 120)
    END
  `;
}

async function getIngestOverview(
  where: Prisma.EgpIngestUrlLogWhereInput,
): Promise<IngestOverview> {
  const [total, successCount, failedCount, durationAgg, itemsAgg, lastRow] =
    await Promise.all([
      prisma.egpIngestUrlLog.count({ where }),
      prisma.egpIngestUrlLog.count({ where: { ...where, status: "success" } }),
      prisma.egpIngestUrlLog.count({ where: { ...where, status: "failed" } }),
      prisma.egpIngestUrlLog.aggregate({
        where: { ...where, durationMs: { not: null } },
        _avg: { durationMs: true },
      }),
      prisma.egpIngestUrlLog.aggregate({
        where: { ...where, status: "success" },
        _sum: { itemsParsed: true },
      }),
      prisma.egpIngestUrlLog.findFirst({
        where,
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

  return {
    total,
    successCount,
    failedCount,
    successRate: total > 0 ? Math.round((successCount / total) * 100) : 0,
    avgDurationMs: durationAgg._avg.durationMs,
    sumItemsParsed: itemsAgg._sum.itemsParsed ?? 0,
    lastIngestAt: lastRow?.createdAt ?? null,
  };
}

async function getRecentJobs(
  searchParams: IngestStatusSearchParams,
  limit = RECENT_JOBS_LIMIT,
): Promise<RecentJobRow[]> {
  const whereSql = sqlWhere([
    ...buildIngestLogSqlClauses(searchParams),
    Prisma.sql`jobId IS NOT NULL`,
  ]);

  const rows = await prisma.$queryRaw<
    Array<{
      jobId: string;
      startedAt: Date;
      finishedAt: Date;
      totalCount: bigint;
      successCount: bigint;
      failedCount: bigint;
      sumItemsParsed: bigint | null;
      sumDurationMs: bigint | null;
    }>
  >(Prisma.sql`
    SELECT
      jobId,
      MIN(createdAt) AS startedAt,
      MAX(createdAt) AS finishedAt,
      COUNT(*) AS totalCount,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successCount,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failedCount,
      SUM(CASE WHEN status = 'success' THEN COALESCE(itemsParsed, 0) ELSE 0 END) AS sumItemsParsed,
      SUM(COALESCE(durationMs, 0)) AS sumDurationMs
    FROM EgpIngestUrlLog
    WHERE ${whereSql}
    GROUP BY jobId
    ORDER BY MAX(createdAt) DESC
    LIMIT ${limit}
  `);

  return rows.map((row) => mapIngestJobAggregateRow(row));
}

function mapIngestJobAggregateRow(row: {
  jobId: string;
  startedAt: Date;
  finishedAt: Date;
  successCount: bigint;
  failedCount: bigint;
  totalCount: bigint;
  sumItemsParsed: bigint | null;
  sumDurationMs: bigint | null;
}): RecentJobRow {
  const startedAt = new Date(row.startedAt);
  const finishedAt = new Date(row.finishedAt);
  const sumDurationMs = Number(row.sumDurationMs ?? 0);

  return {
    jobId: row.jobId,
    startedAt,
    finishedAt,
    durationMs: computeIngestDurationMs(startedAt, finishedAt, sumDurationMs),
    successCount: Number(row.successCount),
    failedCount: Number(row.failedCount),
    totalCount: Number(row.totalCount),
    sumItemsParsed: Number(row.sumItemsParsed ?? 0),
  };
}

async function getLatestIngestJobDurationForDayRange(
  searchParams: IngestStatusSearchParams,
  dayRange: { gte: Date; lt: Date },
): Promise<number | null> {
  const filterParams: IngestStatusSearchParams = {
    ...searchParams,
    day: undefined,
    month: undefined,
    jobId: undefined,
  };

  const whereSql = sqlWhere([
    ...buildIngestLogSqlClauses(filterParams),
    Prisma.sql`jobId IS NOT NULL`,
    Prisma.sql`createdAt >= ${dayRange.gte} AND createdAt < ${dayRange.lt}`,
  ]);

  const rows = await prisma.$queryRaw<
    Array<{
      jobId: string;
      startedAt: Date;
      finishedAt: Date;
      totalCount: bigint;
      successCount: bigint;
      failedCount: bigint;
      sumItemsParsed: bigint | null;
      sumDurationMs: bigint | null;
    }>
  >(Prisma.sql`
    SELECT
      jobId,
      MIN(createdAt) AS startedAt,
      MAX(createdAt) AS finishedAt,
      COUNT(*) AS totalCount,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successCount,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failedCount,
      SUM(CASE WHEN status = 'success' THEN COALESCE(itemsParsed, 0) ELSE 0 END) AS sumItemsParsed,
      SUM(COALESCE(durationMs, 0)) AS sumDurationMs
    FROM EgpIngestUrlLog
    WHERE ${whereSql}
    GROUP BY jobId
    ORDER BY MAX(createdAt) DESC
    LIMIT 1
  `);

  const row = rows[0];
  if (!row) return null;
  return mapIngestJobAggregateRow(row).durationMs;
}

async function getLatestIngestJobFinishedAt(
  searchParams: IngestStatusSearchParams,
): Promise<Date | null> {
  const filterParams: IngestStatusSearchParams = {
    ...searchParams,
    day: undefined,
    month: undefined,
    jobId: undefined,
  };

  const whereSql = sqlWhere([
    ...buildIngestLogSqlClauses(filterParams),
    Prisma.sql`jobId IS NOT NULL`,
  ]);

  const rows = await prisma.$queryRaw<Array<{ finishedAt: Date }>>(Prisma.sql`
    SELECT MAX(createdAt) AS finishedAt
    FROM EgpIngestUrlLog
    WHERE ${whereSql}
    GROUP BY jobId
    ORDER BY MAX(createdAt) DESC
    LIMIT 1
  `);

  return rows[0]?.finishedAt ?? null;
}

async function getYesterdayLatestIngestDurationMs(
  searchParams: IngestStatusSearchParams,
): Promise<number | null> {
  if (searchParams.jobId?.trim()) return null;

  const latestFinishedAt = await getLatestIngestJobFinishedAt(searchParams);
  if (!latestFinishedAt) return null;

  return getLatestIngestJobDurationForDayRange(
    searchParams,
    getBangkokPreviousDayRange(latestFinishedAt),
  );
}

async function getAgencySummary(
  where: Prisma.EgpIngestUrlLogWhereInput,
  agencyNames: Map<string, string>,
): Promise<AgencySummaryRow[]> {
  const grouped = await prisma.egpIngestUrlLog.groupBy({
    by: ["agencyId", "status"],
    where,
    _count: { _all: true },
    _sum: { itemsParsed: true },
  });

  const map = new Map<string, AgencySummaryRow>();

  for (const row of grouped) {
    let entry = map.get(row.agencyId);
    if (!entry) {
      entry = {
        agencyId: row.agencyId,
        agencyName: agencyNames.get(row.agencyId) ?? row.agencyId,
        successCount: 0,
        totalCount: 0,
        sumItemsParsed: 0,
        successRate: 0,
      };
      map.set(row.agencyId, entry);
    }

    entry.totalCount += row._count._all;
    if (row.status === "success") {
      entry.successCount += row._count._all;
      entry.sumItemsParsed += row._sum.itemsParsed ?? 0;
    }
  }

  const rows = Array.from(map.values()).map((row) => ({
    ...row,
    successRate:
      row.totalCount > 0
        ? Math.round((row.successCount / row.totalCount) * 100)
        : 0,
  }));

  return rows.sort((a, b) => {
    const failRateA =
      a.totalCount > 0 ? (a.totalCount - a.successCount) / a.totalCount : 0;
    const failRateB =
      b.totalCount > 0 ? (b.totalCount - b.successCount) / b.totalCount : 0;
    if (failRateB !== failRateA) return failRateB - failRateA;
    return a.agencyName.localeCompare(b.agencyName, "th");
  });
}

async function getAnnounceTypeSummary(
  where: Prisma.EgpIngestUrlLogWhereInput,
): Promise<TypeSummaryRow[]> {
  const grouped = await prisma.egpIngestUrlLog.groupBy({
    by: ["announceType", "status"],
    where: { ...where, announceType: { not: null } },
    _count: { _all: true },
    _sum: { itemsParsed: true },
  });

  const byCode = new Map<
    string,
    { successCount: number; totalCount: number; sumItemsParsed: number }
  >();

  for (const row of grouped) {
    const code = row.announceType;
    if (!code) continue;

    let entry = byCode.get(code);
    if (!entry) {
      entry = { successCount: 0, totalCount: 0, sumItemsParsed: 0 };
      byCode.set(code, entry);
    }

    entry.totalCount += row._count._all;
    if (row.status === "success") {
      entry.successCount += row._count._all;
      entry.sumItemsParsed += row._sum.itemsParsed ?? 0;
    }
  }

  return ALL_EGP_ANNOUNCE_TYPES.map((code) => {
    const stats = byCode.get(code) ?? {
      successCount: 0,
      totalCount: 0,
      sumItemsParsed: 0,
    };

    return {
      code,
      label: getEgpAnnounceTypeLabel(code),
      successCount: stats.successCount,
      totalCount: stats.totalCount,
      sumItemsParsed: stats.sumItemsParsed,
      hasPartialFailure:
        stats.totalCount > 0 && stats.successCount < stats.totalCount,
      hasEmptyFeed:
        stats.successCount > 0 && stats.sumItemsParsed === 0,
    };
  });
}

async function getErrorBreakdown(
  searchParams: IngestStatusSearchParams,
  where: Prisma.EgpIngestUrlLogWhereInput,
): Promise<ErrorBreakdown> {
  const failedWhere: Prisma.EgpIngestUrlLogWhereInput = {
    ...where,
    status: "failed",
  };
  const failedSql = sqlWhere(
    buildIngestLogSqlClauses(searchParams, { forceStatus: "failed" }),
  );

  const [totalFailed, httpGrouped, topErrorRows] = await Promise.all([
    prisma.egpIngestUrlLog.count({ where: failedWhere }),
    prisma.egpIngestUrlLog.groupBy({
      by: ["httpStatus"],
      where: failedWhere,
      _count: { _all: true },
    }),
    prisma.$queryRaw<
      Array<{ category: string; count: bigint; sample: string | null }>
    >(Prisma.sql`
      SELECT
        category,
        COUNT(*) AS count,
        SUBSTRING(MIN(errorMessage), 1, 160) AS sample
      FROM (
        SELECT
          ${errorCategorySql()} AS category,
          errorMessage
        FROM EgpIngestUrlLog
        WHERE ${failedSql}
      ) AS categorized
      GROUP BY category
      ORDER BY count DESC
      LIMIT ${TOP_ERRORS_LIMIT}
    `),
  ]);

  const httpMap = new Map<string, number>();
  for (const row of httpGrouped) {
    const label = httpBucketLabel(row.httpStatus);
    httpMap.set(label, (httpMap.get(label) ?? 0) + row._count._all);
  }

  const httpBuckets = Array.from(httpMap.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const topErrors = topErrorRows.map((row) => ({
    category: row.category,
    sample: row.sample?.slice(0, 160) ?? row.category,
    count: Number(row.count),
  }));

  return { httpBuckets, topErrors, totalFailed };
}

async function getP95DurationMs(
  where: Prisma.EgpIngestUrlLogWhereInput,
): Promise<number | null> {
  const durationWhere = { ...where, durationMs: { not: null } };
  const count = await prisma.egpIngestUrlLog.count({ where: durationWhere });
  if (count === 0) return null;

  const offset = Math.floor(0.95 * (count - 1));
  const row = await prisma.egpIngestUrlLog.findFirst({
    where: durationWhere,
    orderBy: { durationMs: "asc" },
    skip: offset,
    select: { durationMs: true },
  });

  return row?.durationMs ?? null;
}

async function getPerformanceStats(
  searchParams: IngestStatusSearchParams,
  where: Prisma.EgpIngestUrlLogWhereInput,
): Promise<PerformanceStats> {
  const trendScope = trendWhere(where);
  const hasDateFilter = Boolean(
    searchParams.month?.trim() || searchParams.day?.trim(),
  );
  const trendSince = hasDateFilter
    ? undefined
    : getBangkokTrendSinceUtc(DAILY_TREND_LIMIT);
  const trendSql = sqlWhere(buildIngestLogSqlClauses(searchParams, { trendSince }));

  const [durationAgg, p95DurationMs, dailyRows, durationAvgRows, durationP95Rows, ingestJobGroups] =
    await Promise.all([
      prisma.egpIngestUrlLog.aggregate({
        where: { ...where, durationMs: { not: null } },
        _avg: { durationMs: true },
      }),
      getP95DurationMs(where),
      prisma.$queryRaw<
        Array<{ day: string; status: string; cnt: bigint }>
      >(Prisma.sql`
        SELECT
          DATE(DATE_ADD(createdAt, INTERVAL 7 HOUR)) AS day,
          status,
          COUNT(*) AS cnt
        FROM EgpIngestUrlLog
        WHERE ${trendSql}
        GROUP BY day, status
        ORDER BY day ASC
      `),
      prisma.$queryRaw<
        Array<{ day: string; avgDurationMs: number | null }>
      >(Prisma.sql`
        SELECT
          DATE(DATE_ADD(createdAt, INTERVAL 7 HOUR)) AS day,
          ROUND(AVG(durationMs)) AS avgDurationMs
        FROM EgpIngestUrlLog
        WHERE ${trendSql} AND durationMs IS NOT NULL
        GROUP BY day
        ORDER BY day ASC
      `),
      prisma.egpIngestUrlLog.findMany({
        where: { ...trendScope, durationMs: { not: null } },
        select: { createdAt: true, durationMs: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.egpIngestUrlLog.groupBy({
        by: ["jobId"],
        where: { ...trendScope, jobId: { not: null } },
        _min: { createdAt: true },
        _max: { createdAt: true },
        _count: { _all: true },
        _sum: { durationMs: true },
      }),
    ]);

  const dayMap = new Map<string, DailyTrendRow>();
  for (const row of dailyRows) {
    const day = normalizeTrendDayKey(row.day);
    let entry = dayMap.get(day);
    if (!entry) {
      entry = { day, successCount: 0, failedCount: 0, totalCount: 0 };
      dayMap.set(day, entry);
    }
    const count = Number(row.cnt);
    entry.totalCount += count;
    if (row.status === "success") entry.successCount += count;
    else if (row.status === "failed") entry.failedCount += count;
  }

  const dailyTrend = Array.from(dayMap.values())
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(-DAILY_TREND_LIMIT);

  const durationByDay = new Map<string, number[]>();
  for (const row of durationP95Rows) {
    if (row.durationMs == null) continue;
    const day = formatDayKeyBangkok(row.createdAt);
    const bucket = durationByDay.get(day) ?? [];
    bucket.push(row.durationMs);
    durationByDay.set(day, bucket);
  }

  const durationTrend = durationAvgRows
    .map((row) => {
      const day = normalizeTrendDayKey(row.day);
      return {
        day,
        avgDurationMs:
          row.avgDurationMs != null ? Math.round(Number(row.avgDurationMs)) : null,
        p95DurationMs: percentile95(durationByDay.get(day) ?? []),
      };
    })
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(-DAILY_TREND_LIMIT);

  const ingestDurationTrend = ingestJobGroups
    .filter((g) => g.jobId && g._min.createdAt && g._max.createdAt)
    .map((g) => {
      const startedAt = g._min.createdAt!;
      const finishedAt = g._max.createdAt!;
      return {
        jobId: g.jobId!,
        startedAt,
        durationMs: computeIngestDurationMs(
          startedAt,
          finishedAt,
          g._sum.durationMs ?? 0,
        ),
        urlCount: g._count._all,
      };
    })
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
    .slice(-INGEST_DURATION_TREND_LIMIT);

  return {
    avgDurationMs: durationAgg._avg.durationMs,
    p95DurationMs,
    dailyTrend,
    durationTrend,
    ingestDurationTrend,
  };
}

export async function getIngestStatusDashboardData(
  searchParams: IngestStatusSearchParams,
): Promise<IngestStatusDashboardData> {
  const where = buildIngestLogWhere(searchParams);

  const agencies = await prisma.egpAgency.findMany({
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { id: true, name: true },
  });
  const agencyNames = new Map(agencies.map((a) => [a.id, a.name]));

  const [
    overview,
    recentJobs,
    agencySummary,
    typeSummary,
    errorBreakdown,
    performance,
    yesterdayLatestIngestDurationMs,
  ] = await Promise.all([
    getIngestOverview(where),
    getRecentJobs(searchParams),
    getAgencySummary(where, agencyNames),
    getAnnounceTypeSummary(where),
    getErrorBreakdown(searchParams, where),
    getPerformanceStats(searchParams, where),
    getYesterdayLatestIngestDurationMs(searchParams),
  ]);

  return {
    where,
    agencies: agencies.map((a) => ({ id: a.id, name: a.name })),
    overview,
    recentJobs,
    yesterdayLatestIngestDurationMs,
    agencySummary,
    typeSummary,
    errorBreakdown,
    performance,
  };
}

export async function getIngestStatusLogsPage(
  searchParams: IngestStatusSearchParams,
  where: Prisma.EgpIngestUrlLogWhereInput,
) {
  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);

  const [total, logs] = await Promise.all([
    prisma.egpIngestUrlLog.count({ where }),
    prisma.egpIngestUrlLog.findMany({
      where,
      include: {
        agency: { select: { id: true, name: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  return { logs, total, totalPages, currentPage, pageSize: PAGE_SIZE };
}

export { PAGE_SIZE as INGEST_STATUS_PAGE_SIZE };
