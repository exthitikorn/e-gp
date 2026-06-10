import Link from "next/link";
import {
  buildStatusHref,
  type ErrorBreakdown,
  type StatusFilterQuery,
} from "@/lib/egpIngestStatusShared";
import { StatusErrorBreakdownCharts } from "./StatusErrorBreakdownCharts";

type StatusErrorBreakdownProps = {
  data: ErrorBreakdown;
  filterQuery: StatusFilterQuery;
};

export function StatusErrorBreakdown({
  data,
  filterQuery,
}: StatusErrorBreakdownProps) {
  const failedHref = buildStatusHref({ ...filterQuery, status: "failed" });

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">ข้อผิดพลาด</h2>
        {data.totalFailed > 0 && (
          <Link
            href={failedHref}
            className="text-[11px] font-medium text-rose-700 hover:text-rose-800"
          >
            ดู log ล้มเหลว ({data.totalFailed.toLocaleString("th-TH")})
          </Link>
        )}
      </div>

      {data.totalFailed === 0 ? (
        <p className="text-sm text-slate-500">ไม่มีรายการล้มเหลวในขอบเขตที่เลือก</p>
      ) : (
        <StatusErrorBreakdownCharts data={data} filterQuery={filterQuery} />
      )}
    </section>
  );
}
