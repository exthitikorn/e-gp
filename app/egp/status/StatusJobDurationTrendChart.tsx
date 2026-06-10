"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { IngestDurationTrendRow } from "@/lib/egpIngestStatusShared";

type StatusJobDurationTrendChartProps = {
  data: IngestDurationTrendRow[];
  showTrendScopeHint?: boolean;
};

type ChartRow = IngestDurationTrendRow & {
  label: string;
};

type DurationUnit = "ms" | "s" | "min";

function pickDurationUnit(maxMs: number): DurationUnit {
  if (maxMs < 1000) return "ms";
  if (maxMs < 60_000) return "s";
  return "min";
}

function formatDurationMs(ms: number, unit: DurationUnit): string {
  if (ms <= 0) return "-";
  if (unit === "ms") return `${Math.round(ms)} ms`;
  if (unit === "s") return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} วินาที`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  if (minutes === 0) return `${seconds} วินาที`;
  if (seconds === 0) return `${minutes} นาที`;
  return `${minutes} นาที ${seconds} วินาที`;
}

function formatDurationAxisTick(ms: number, unit: DurationUnit): string {
  if (unit === "ms") return String(Math.round(ms));
  if (unit === "s") return (ms / 1000).toFixed(ms < 10_000 ? 1 : 0);
  return (ms / 60_000).toFixed(1);
}

function formatJobAxisLabel(startedAt: Date): string {
  return startedAt.toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
  });
}

function IngestDurationTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ChartRow }>;
  unit: DurationUnit;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-slate-900">
        {formatJobAxisLabel(row.startedAt)}
      </p>
      <p className="text-slate-700">URL: {row.urlCount.toLocaleString("th-TH")}</p>
      <p className="text-slate-700">
        ระยะเวลา: {formatDurationMs(row.durationMs, unit)}
      </p>
    </div>
  );
}

export function StatusJobDurationTrendChart({
  data,
  showTrendScopeHint = false,
}: StatusJobDurationTrendChartProps) {
  const chartData: ChartRow[] = data.map((row) => ({
    ...row,
    label: formatJobAxisLabel(row.startedAt),
  }));

  const maxDurationMs = chartData.reduce(
    (max, row) => Math.max(max, row.durationMs),
    0,
  );
  const unit = pickDurationUnit(maxDurationMs);

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">
        แนวโน้มระยะเวลาต่อ ingest
      </h2>
      <p className="mb-4 text-[10px] uppercase tracking-wide text-slate-500">
        {showTrendScopeHint && (
          <span className="mt-1 block normal-case text-sky-700">
            แสดง 31 วันล่าสุด (ตัวเลขสรุปด้านบนครอบคลุมทั้งหมด)
          </span>
        )}
      </p>

      {chartData.length === 0 ? (
        <p className="text-sm text-slate-500">ไม่มีข้อมูลระยะเวลาต่อ ingest</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#64748b" }}
              axisLine={{ stroke: "#e2e8f0" }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#64748b" }}
              tickFormatter={(value) => formatDurationAxisTick(value, unit)}
              axisLine={false}
              tickLine={false}
              allowDecimals={unit !== "ms"}
              width={unit === "min" ? 40 : 48}
            />
            <Tooltip content={<IngestDurationTooltip unit={unit} />} />
            <Line
              type="monotone"
              dataKey="durationMs"
              name="ระยะเวลา"
              stroke="#0ea5e9"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
