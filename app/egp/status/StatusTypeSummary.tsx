import Link from "next/link";
import {
  buildStatusHref,
  type StatusFilterQuery,
  type TypeSummaryRow,
} from "@/lib/egpIngestStatusShared";
import { StatusTypeSummaryChart } from "./StatusTypeSummaryChart";

type StatusTypeSummaryProps = {
  rows: TypeSummaryRow[];
  filterQuery: StatusFilterQuery;
};

export function StatusTypeSummary({ rows, filterQuery }: StatusTypeSummaryProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">
        สรุปตามประเภทประกาศ
      </h2>

      <StatusTypeSummaryChart rows={rows} filterQuery={filterQuery} />

      <details className="group">
        <summary className="mb-2 cursor-pointer text-[11px] font-medium text-slate-600 hover:text-emerald-700">
          ดูตารางทั้งหมด
        </summary>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2 py-2 font-medium">ประเภท</th>
                <th className="px-2 py-2 text-center font-medium">สำเร็จ/ทั้งหมด</th>
                <th className="px-2 py-2 text-center font-medium">RSS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const tone =
                  row.totalCount === 0
                    ? "text-slate-300"
                    : row.hasPartialFailure
                      ? "font-semibold text-amber-700"
                      : row.successCount === row.totalCount
                        ? "font-semibold text-emerald-700"
                        : "font-semibold text-rose-700";

                return (
                  <tr
                    key={row.code}
                    className={
                      row.hasPartialFailure || row.hasEmptyFeed
                        ? "bg-amber-50/40 hover:bg-amber-50/70"
                        : "hover:bg-slate-50/80"
                    }
                  >
                    <td className="px-2 py-2">
                      {row.totalCount === 0 ? (
                        <span className="text-slate-400">
                          <span className="font-mono text-[10px]">{row.code}</span>{" "}
                          {row.label}
                        </span>
                      ) : (
                        <Link
                          href={buildStatusHref({
                            ...filterQuery,
                            announceType: row.code,
                          })}
                          className="block hover:text-emerald-700"
                          title={row.label}
                        >
                          <span className="font-mono text-[10px] text-slate-500">
                            {row.code}
                          </span>
                          <span className="ml-1 line-clamp-2">{row.label}</span>
                        </Link>
                      )}
                    </td>
                    <td className={`px-2 py-2 text-center ${tone}`}>
                      {row.totalCount === 0
                        ? "—"
                        : `${row.successCount}/${row.totalCount}`}
                    </td>
                    <td className="px-2 py-2 text-center text-slate-600">
                      {row.totalCount === 0
                        ? "—"
                        : row.sumItemsParsed.toLocaleString("th-TH")}
                      {row.hasEmptyFeed && (
                        <span className="mt-0.5 block text-[10px] text-amber-600">
                          feed ว่าง
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
