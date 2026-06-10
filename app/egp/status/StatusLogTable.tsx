import Link from "next/link";
import { getEgpAnnounceTypeLabel } from "@/lib/egpRss";
import { httpBucketParamToLabel } from "@/lib/egpErrorBreakdownColors";
import { formatIngestDayLabel } from "@/lib/formatIngestDayLabel";
import {
  buildStatusHref,
  type StatusFilterQuery,
} from "@/lib/egpIngestStatusShared";
import { formatThaiDateTime } from "@/lib/ingestDateTime";

type LogRow = {
  id: string;
  jobId: string | null;
  createdAt: Date;
  announceType: string | null;
  status: string;
  httpStatus: number | null;
  itemsParsed: number | null;
  durationMs: number | null;
  url: string;
  errorMessage: string | null;
  deptId: string | null;
  deptsubId: string | null;
  agency: { id: string; name: string };
};

type StatusLogTableProps = {
  logs: LogRow[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  filterQuery: StatusFilterQuery;
  filterSummary?: string[];
  createPageLink: (page: number) => string;
};

function formatDurationMs(ms: number | null): string {
  if (ms == null) return "-";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function truncateText(text: string, max = 72): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function getLogStatusBadgeClass(status: string): string {
  if (status === "success") {
    return "bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200";
  }
  if (status === "failed") {
    return "bg-rose-100 text-rose-700 ring-1 ring-inset ring-rose-200";
  }
  return "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200";
}

const disabledNavClass =
  "cursor-not-allowed rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-400";
const enabledNavClass =
  "rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:border-emerald-400 hover:text-emerald-700";

export function StatusLogTable({
  logs,
  currentPage,
  totalPages,
  totalCount,
  filterQuery,
  filterSummary = [],
  createPageLink,
}: StatusLogTableProps) {
  if (logs.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-6 text-sm text-slate-600">
        ยังไม่มี log ที่ตรงกับเงื่อนไข — ลองรัน ingest จากหน้าโครงการจัดซื้อจัดจ้าง
      </div>
    );
  }

  const prevDisabled = currentPage === 1;
  const nextDisabled = currentPage === totalPages;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">รายการ log</h2>
        <p className="mt-1 text-xs text-slate-600">
          ทั้งหมด{" "}
          <span className="font-semibold text-slate-900">
            {totalCount.toLocaleString("th-TH")}
          </span>{" "}
          รายการ — หน้า{" "}
          <span className="font-semibold text-slate-900">
            {currentPage} / {totalPages}
          </span>{" "}
          ({logs.length.toLocaleString("th-TH")} รายการในหน้านี้)
        </p>
        {filterSummary.length > 0 && (
          <p className="mt-1 text-[11px] text-slate-500">
            กรองเพิ่มเติม: {filterSummary.join(" · ")}
          </p>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">เวลาบันทึก</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">งาน</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">หน่วยงาน</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">ประเภท</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">สถานะ</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">HTTP</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">รายการ</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">ระยะเวลา</th>
              <th className="min-w-48 px-3 py-2.5 font-medium">URL / ข้อผิดพลาด</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((log) => (
              <tr key={log.id} className="align-top hover:bg-slate-50/80">
                <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                  {formatThaiDateTime(log.createdAt)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  {log.jobId ? (
                    <Link
                      href={buildStatusHref({
                        ...filterQuery,
                        jobId: log.jobId,
                        page: undefined,
                      })}
                      className="font-mono text-[10px] text-emerald-700 hover:text-emerald-800"
                      title={log.jobId}
                    >
                      {truncateText(log.jobId, 10)}
                    </Link>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="max-w-40 px-3 py-2.5">
                  <Link
                    href={buildStatusHref({
                      ...filterQuery,
                      agencyId: log.agency.id,
                      page: undefined,
                    })}
                    className="line-clamp-2 text-slate-800 hover:text-emerald-700"
                    title={log.agency.name}
                  >
                    {log.agency.name}
                  </Link>
                </td>
                <td className="max-w-56 px-3 py-2.5">
                  {log.announceType ? (
                    <span
                      className="line-clamp-2 text-[11px] text-slate-800"
                      title={`${log.announceType} — ${getEgpAnnounceTypeLabel(log.announceType)}`}
                    >
                      {getEgpAnnounceTypeLabel(log.announceType)}
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${getLogStatusBadgeClass(log.status)}`}
                  >
                    {log.status === "success"
                      ? "สำเร็จ"
                      : log.status === "failed"
                        ? "ล้มเหลว"
                        : log.status}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                  {log.httpStatus ?? "-"}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                  {log.itemsParsed != null
                    ? log.itemsParsed.toLocaleString("th-TH")
                    : "-"}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                  {formatDurationMs(log.durationMs)}
                </td>
                <td className="px-3 py-2.5">
                  <a
                    href={log.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block break-all font-mono text-[10px] text-sky-700 hover:text-sky-800"
                    title={log.url}
                  >
                    {truncateText(log.url)}
                  </a>
                  {log.errorMessage && (
                    <p className="mt-1 text-[11px] text-rose-600">{log.errorMessage}</p>
                  )}
                  {(log.deptId || log.deptsubId) && (
                    <p className="mt-1 text-[10px] text-slate-400">
                      {log.deptId && <>deptId={log.deptId} </>}
                      {log.deptsubId && <>deptsubId={log.deptsubId} </>}
                    </p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-xs">
          <span className="text-slate-500">
            หน้า{" "}
            <span className="font-semibold text-slate-900">{currentPage}</span> จาก{" "}
            <span className="font-semibold text-slate-900">{totalPages}</span>
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {prevDisabled ? (
              <span aria-disabled="true" className={disabledNavClass}>
                ก่อนหน้า
              </span>
            ) : (
              <Link
                href={createPageLink(currentPage - 1)}
                className={enabledNavClass}
              >
                ก่อนหน้า
              </Link>
            )}

            {(() => {
              const windowSize = 5;
              const half = Math.floor(windowSize / 2);
              let start = Math.max(1, currentPage - half);
              let end = start + windowSize - 1;

              if (end > totalPages) {
                end = totalPages;
                start = Math.max(1, end - windowSize + 1);
              }

              const pages = [];
              for (let p = start; p <= end; p += 1) {
                pages.push(p);
              }

              return pages.map((p) => (
                <Link
                  key={p}
                  href={createPageLink(p)}
                  aria-current={p === currentPage ? "page" : undefined}
                  className={`min-w-9 rounded-full px-2 py-1 text-center text-xs font-medium ${
                    p === currentPage
                      ? "bg-emerald-500 text-white"
                      : "border border-slate-300 text-slate-700 hover:border-emerald-400 hover:text-emerald-700"
                  }`}
                >
                  {p}
                </Link>
              ));
            })()}

            {nextDisabled ? (
              <span aria-disabled="true" className={disabledNavClass}>
                ถัดไป
              </span>
            ) : (
              <Link
                href={createPageLink(currentPage + 1)}
                className={enabledNavClass}
              >
                ถัดไป
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}

export function buildLogFilterSummary(
  searchParams: {
    jobId?: string;
    httpBucket?: string;
    errorCategory?: string;
    day?: string;
  },
): string[] {
  const summary: string[] = [];
  if (searchParams.jobId?.trim()) {
    summary.push(`งาน ${searchParams.jobId.trim().slice(0, 16)}`);
  }
  if (searchParams.httpBucket?.trim()) {
    summary.push(`HTTP ${httpBucketParamToLabel(searchParams.httpBucket.trim())}`);
  }
  if (searchParams.errorCategory?.trim()) {
    summary.push(
      `error ${decodeURIComponent(searchParams.errorCategory.trim()).slice(0, 48)}`,
    );
  }
  if (searchParams.day?.trim()) {
    summary.push(`วัน ${formatIngestDayLabel(searchParams.day.trim())}`);
  }
  return summary;
}
