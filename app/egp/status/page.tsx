export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  ALL_EGP_ANNOUNCE_TYPES,
  getEgpAnnounceTypeLabel,
} from "@/lib/egpRss";
import {
  buildStatusHref,
  buildStatusQueryString,
  hasExplicitDateFilter,
  type IngestStatusSearchParams,
  type StatusFilterQuery,
} from "@/lib/egpIngestStatusShared";
import {
  buildIngestLogWhere,
  getIngestStatusDashboardData,
  getIngestStatusLogsPage,
} from "@/lib/egpIngestStatusStats";
import { StatusActiveFilters } from "./StatusActiveFilters";
import { StatusAgencySummary } from "./StatusAgencySummary";
import { StatusErrorBreakdown } from "./StatusErrorBreakdown";
import { StatusFilters } from "./StatusFilters";
import { buildLogFilterSummary, StatusLogTable } from "./StatusLogTable";
import { StatusDailyTrendChart } from "./StatusDailyTrendChart";
import { StatusDurationTrendChart } from "./StatusDurationTrendChart";
import { StatusJobDurationTrendChart } from "./StatusJobDurationTrendChart";
import { StatusOverviewCards } from "./StatusOverviewCards";
import { StatusTypeSummary } from "./StatusTypeSummary";

interface StatusPageProps {
  searchParams?: Promise<IngestStatusSearchParams>;
}

export default async function EgpStatusPage({ searchParams }: StatusPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const activeMonth = resolvedSearchParams.month?.trim() || undefined;

  const where = buildIngestLogWhere(resolvedSearchParams);

  const [dashboard, logsPage] = await Promise.all([
    getIngestStatusDashboardData(resolvedSearchParams),
    getIngestStatusLogsPage(resolvedSearchParams, where),
  ]);
  const agencies = dashboard.agencies;

  const announceTypeOptions = ALL_EGP_ANNOUNCE_TYPES.map((code) => ({
    code,
    label: getEgpAnnounceTypeLabel(code),
  }));

  const filterQuery: StatusFilterQuery = {
    month: activeMonth,
    agencyId: resolvedSearchParams.agencyId,
    jobId: resolvedSearchParams.jobId?.trim(),
    announceType: resolvedSearchParams.announceType?.trim(),
    status: resolvedSearchParams.status,
    httpBucket: resolvedSearchParams.httpBucket?.trim(),
    errorCategory: resolvedSearchParams.errorCategory?.trim(),
    day: resolvedSearchParams.day?.trim(),
  };

  const showTrendScopeHint = !hasExplicitDateFilter(resolvedSearchParams);

  const formKey = buildStatusQueryString(resolvedSearchParams);

  const createPageLink = (targetPage: number) =>
    buildStatusHref({
      ...resolvedSearchParams,
      page: targetPage <= 1 ? undefined : String(targetPage),
    });

  const {
    overview,
    recentJobs,
    yesterdayLatestIngestDurationMs,
    agencySummary,
    typeSummary,
    errorBreakdown,
    performance,
  } = dashboard;
  const { logs, total, currentPage, totalPages } = logsPage;
  const logFilterSummary = buildLogFilterSummary(resolvedSearchParams);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-emerald-700 hover:text-emerald-800"
            >
              ← กลับหน้า landing
            </Link>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                สถานะการดึง RSS (Ingest Log)
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Dashboard ตรวจสอบ ingest — ความสำเร็จ ข้อผิดพลาด และประสิทธิภาพ
              </p>
            </div>
            <p className="text-xs text-slate-500">
              log ตามตัวกรอง:{" "}
              <span className="font-semibold text-slate-800">
                {total.toLocaleString("th-TH")}
              </span>{" "}
              รายการ
            </p>
          </div>
          <StatusActiveFilters
            searchParams={resolvedSearchParams}
            agencies={agencies}
          />
          <StatusFilters
            formKey={formKey}
            resolvedSearchParams={resolvedSearchParams}
            agencies={agencies}
            announceTypeOptions={announceTypeOptions}
          />
        </header>

        <StatusOverviewCards
          total={overview.total}
          successCount={overview.successCount}
          failedCount={overview.failedCount}
          successRate={overview.successRate}
          sumItemsParsed={overview.sumItemsParsed}
          avgDurationMs={overview.avgDurationMs}
          p95DurationMs={performance.p95DurationMs}
          latestIngestDurationMs={recentJobs[0]?.durationMs ?? null}
          latestIngestFinishedAt={recentJobs[0]?.finishedAt ?? null}
          yesterdayLatestIngestDurationMs={yesterdayLatestIngestDurationMs}
        />

        <StatusDailyTrendChart
          data={performance.dailyTrend}
          filterQuery={filterQuery}
          showTrendScopeHint={showTrendScopeHint}
        />

        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <StatusDurationTrendChart
            data={performance.durationTrend}
            showTrendScopeHint={showTrendScopeHint}
          />
          <StatusJobDurationTrendChart
            data={performance.ingestDurationTrend}
            showTrendScopeHint={showTrendScopeHint}
          />
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <StatusAgencySummary rows={agencySummary} filterQuery={filterQuery} />
          <StatusTypeSummary rows={typeSummary} filterQuery={filterQuery} />
        </div>

        <div className="mb-6">
          <StatusErrorBreakdown
            data={errorBreakdown}
            filterQuery={filterQuery}
          />
        </div>

        <StatusLogTable
          logs={logs}
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={total}
          filterQuery={filterQuery}
          filterSummary={logFilterSummary}
          createPageLink={createPageLink}
        />
      </div>
    </div>
  );
}
