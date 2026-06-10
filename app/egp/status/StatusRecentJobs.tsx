import Link from "next/link";
import {
  buildStatusHref,
  type RecentJobRow,
  type StatusFilterQuery,
} from "@/lib/egpIngestStatusShared";
import { formatThaiDateTime } from "@/lib/ingestDateTime";

type StatusRecentJobsProps = {
  jobs: RecentJobRow[];
  filterQuery: StatusFilterQuery;
};

function formatDurationMs(ms: number): string {
  if (ms <= 0) return "-";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)} วินาที`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes} นาที ${seconds} วินาที`;
}

function truncateJobId(jobId: string, max = 12): string {
  if (jobId.length <= max) return jobId;
  return `${jobId.slice(0, max)}…`;
}

export function StatusRecentJobs({ jobs, filterQuery }: StatusRecentJobsProps) {
  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">
        งาน ingest ล่าสุด
      </h2>
      <p className="mb-3 text-[11px] text-slate-500">
        คลิกแถวเพื่อดู log ของงานนั้น
      </p>

      {jobs.length === 0 ? (
        <p className="text-sm text-slate-500">ยังไม่มีงาน ingest ในขอบเขตที่เลือก</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">งาน</th>
                <th className="px-3 py-2 font-medium">ช่วงเวลา</th>
                <th className="px-3 py-2 font-medium text-center">ระยะเวลา</th>
                <th className="px-3 py-2 font-medium text-center">URL</th>
                <th className="px-3 py-2 font-medium text-center">สำเร็จ</th>
                <th className="px-3 py-2 font-medium text-center">ล้มเหลว</th>
                <th className="px-3 py-2 font-medium text-center">RSS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.map((job) => {
                const href = buildStatusHref({
                  ...filterQuery,
                  jobId: job.jobId,
                  page: undefined,
                });

                return (
                  <tr key={job.jobId} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2">
                      <Link
                        href={href}
                        className="font-mono text-[10px] font-medium text-emerald-700 hover:text-emerald-800"
                        title={job.jobId}
                      >
                        {truncateJobId(job.jobId)}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <Link href={href} className="text-slate-700 hover:text-emerald-700">
                        {formatThaiDateTime(job.startedAt)}
                        {job.finishedAt.getTime() !== job.startedAt.getTime() && (
                          <> — {formatThaiDateTime(job.finishedAt)}</>
                        )}
                      </Link>
                    </td>
                    <td
                      className="whitespace-nowrap px-3 py-2 text-center text-slate-700"
                      title={
                        job.finishedAt.getTime() !== job.startedAt.getTime()
                          ? "เวลารวมตั้งแต่ URL แรกถึง URL สุดท้าย"
                          : "รวม duration ต่อ URL"
                      }
                    >
                      {formatDurationMs(job.durationMs)}
                    </td>
                    <td className="px-3 py-2 text-center text-slate-700">
                      {job.totalCount.toLocaleString("th-TH")}
                    </td>
                    <td className="px-3 py-2 text-center text-emerald-700">
                      {job.successCount.toLocaleString("th-TH")}
                    </td>
                    <td className="px-3 py-2 text-center text-rose-700">
                      {job.failedCount.toLocaleString("th-TH")}
                    </td>
                    <td className="px-3 py-2 text-center text-slate-700">
                      {job.sumItemsParsed.toLocaleString("th-TH")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
