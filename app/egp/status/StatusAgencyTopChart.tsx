"use client";

import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildStatusHref,
  type AgencySummaryRow,
  type StatusFilterQuery,
} from "@/lib/egpIngestStatusShared";

const TOP_N = 10;

type StatusAgencyTopChartProps = {
  rows: AgencySummaryRow[];
  filterQuery: StatusFilterQuery;
};

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}

export function StatusAgencyTopChart({
  rows,
  filterQuery,
}: StatusAgencyTopChartProps) {
  const router = useRouter();

  const chartData = rows
    .filter((row) => row.totalCount > 0 && row.successCount < row.totalCount)
    .slice(0, TOP_N)
    .map((row) => ({
      ...row,
      failedCount: row.totalCount - row.successCount,
    }));

  if (chartData.length === 0) {
    return (
      <p className="mb-4 text-sm text-slate-500">
        ไม่มีหน่วยงานที่มีรายการล้มเหลว
      </p>
    );
  }

  const height = Math.min(320, Math.max(160, chartData.length * 32));

  return (
    <div className="mb-4">
      <p className="mb-2 text-[10px] uppercase tracking-wide text-slate-500">
        Top {TOP_N} หน่วยงานที่ล้มเหลวมากสุด
      </p>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e2e8f0"
            horizontal={false}
          />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={{ stroke: "#e2e8f0" }}
            tickLine={false}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="agencyName"
            width={150}
            tick={{ fontSize: 10, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: string) => truncateText(value, 22)}
          />
          <Tooltip
            formatter={(value) => [
              Number(value ?? 0).toLocaleString("th-TH"),
              "ล้มเหลว",
            ]}
          />
          <Bar
            dataKey="failedCount"
            fill="#fb7185"
            radius={[0, 4, 4, 0]}
            className="cursor-pointer"
            onClick={(_data, index) => {
              const row = chartData[index];
              if (!row) return;
              router.push(
                buildStatusHref({
                  ...filterQuery,
                  agencyId: row.agencyId,
                  status: "failed",
                  page: undefined,
                }),
              );
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
