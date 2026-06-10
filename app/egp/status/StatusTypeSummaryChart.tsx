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
  type StatusFilterQuery,
  type TypeSummaryRow,
} from "@/lib/egpIngestStatusShared";

type ChartRow = TypeSummaryRow & {
  failedCount: number;
};

type StatusTypeSummaryChartProps = {
  rows: TypeSummaryRow[];
  filterQuery: StatusFilterQuery;
};

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}

export function StatusTypeSummaryChart({
  rows,
  filterQuery,
}: StatusTypeSummaryChartProps) {
  const router = useRouter();
  const chartData: ChartRow[] = rows
    .filter((row) => row.totalCount > 0)
    .map((row) => ({
      ...row,
      failedCount: row.totalCount - row.successCount,
    }));

  if (chartData.length === 0) {
    return (
      <p className="mb-4 text-sm text-slate-500">ไม่มีข้อมูลประเภทประกาศ</p>
    );
  }

  const height = Math.min(360, Math.max(160, chartData.length * 32));

  return (
    <div className="mb-4">
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
            dataKey="label"
            width={150}
            tick={{ fontSize: 10, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: string) => truncateText(value, 24)}
          />
          <Tooltip
            formatter={(value, name) => [
              Number(value ?? 0).toLocaleString("th-TH"),
              name === "successCount" ? "สำเร็จ" : "ล้มเหลว",
            ]}
          />
          <Bar
            dataKey="successCount"
            stackId="type"
            fill="#34d399"
            name="successCount"
            className="cursor-pointer"
            onClick={(_data, index) => {
              const row = chartData[index];
              if (!row) return;
              router.push(
                buildStatusHref({
                  ...filterQuery,
                  announceType: row.code,
                  page: undefined,
                }),
              );
            }}
          />
          <Bar
            dataKey="failedCount"
            stackId="type"
            fill="#fb7185"
            name="failedCount"
            radius={[0, 4, 4, 0]}
            className="cursor-pointer"
            onClick={(_data, index) => {
              const row = chartData[index];
              if (!row) return;
              router.push(
                buildStatusHref({
                  ...filterQuery,
                  announceType: row.code,
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
