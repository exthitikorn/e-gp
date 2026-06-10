import Link from "next/link";
import {
  buildStatusHref,
  type AgencySummaryRow,
  type StatusFilterQuery,
} from "@/lib/egpIngestStatusShared";
import { StatusAgencyTopChart } from "./StatusAgencyTopChart";

type StatusAgencySummaryProps = {
  rows: AgencySummaryRow[];
  filterQuery: StatusFilterQuery;
};

export function StatusAgencySummary({
  rows,
  filterQuery,
}: StatusAgencySummaryProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">
        สรุปตามหน่วยงาน
      </h2>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">ไม่มีข้อมูล</p>
      ) : (
        <>
          <StatusAgencyTopChart rows={rows} filterQuery={filterQuery} />

          <details className="group">
            <summary className="mb-2 cursor-pointer text-[11px] font-medium text-slate-600 hover:text-emerald-700">
              ดูตารางทั้งหมด
            </summary>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-2 font-medium">หน่วยงาน</th>
                    <th className="px-2 py-2 text-center font-medium">สำเร็จ/ทั้งหมด</th>
                    <th className="px-2 py-2 text-center font-medium">RSS</th>
                    <th className="px-2 py-2 text-center font-medium">อัตรา</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={row.agencyId} className="hover:bg-slate-50/80">
                      <td className="max-w-[10rem] px-2 py-2">
                        <Link
                          href={buildStatusHref({
                            ...filterQuery,
                            agencyId: row.agencyId,
                          })}
                          className="line-clamp-2 font-medium text-slate-800 hover:text-emerald-700"
                          title={row.agencyName}
                        >
                          {row.agencyName}
                        </Link>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span
                          className={
                            row.successCount === row.totalCount
                              ? "font-semibold text-emerald-700"
                              : row.successCount === 0
                                ? "font-semibold text-rose-700"
                                : "font-semibold text-amber-700"
                          }
                        >
                          {row.successCount}/{row.totalCount}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center text-slate-600">
                        {row.sumItemsParsed.toLocaleString("th-TH")}
                      </td>
                      <td className="px-2 py-2 text-center text-slate-600">
                        {row.successRate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
