"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DurationTrendRow } from "@/lib/egpIngestStatusShared";
import { formatIngestDayLabel } from "@/lib/formatIngestDayLabel";

type StatusDurationTrendChartProps = {
  data: DurationTrendRow[];
  showTrendScopeHint?: boolean;
};

function formatDurationMs(ms: number | null): string {
  if (ms == null) return "-";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function DurationTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;

  const avg = payload.find((p) => p.name === "เฉลี่ย")?.value;
  const p95 = payload.find((p) => p.name === "p95")?.value;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-slate-900">
        {formatIngestDayLabel(label)}
      </p>
      <p className="text-slate-700">เฉลี่ย: {formatDurationMs(avg ?? null)}</p>
      <p className="text-slate-700">p95: {formatDurationMs(p95 ?? null)}</p>
    </div>
  );
}

export function StatusDurationTrendChart({
  data,
  showTrendScopeHint = false,
}: StatusDurationTrendChartProps) {
  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">
        แนวโน้มระยะเวลาต่อ URL
      </h2>
      <p className="text-[10px] uppercase tracking-wide text-slate-500">
        {showTrendScopeHint && (
          <span className="mt-1 block normal-case text-sky-700">
            แสดง 31 วันล่าสุด (ตัวเลขสรุปด้านบนครอบคลุมทั้งหมด)
          </span>
        )}
      </p>
      <ul className="mb-4 mt-2 space-y-1 text-xs text-slate-600">
        <li className="flex gap-2">
          <span
            className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500"
            aria-hidden
          />
          <span>
            <span className="font-medium text-slate-700">เฉลี่ย</span>
            {" — "}
            ค่าเฉลี่ยระยะเวลาดึง RSS ต่อ URL ในวันนั้น
          </span>
        </li>
        <li className="flex gap-2">
          <span
            className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500"
            aria-hidden
          />
          <span>
            <span className="font-medium text-slate-700">p95</span>
            {" — "}
            95% ของ URL ใช้เวลาไม่เกินค่านี้
          </span>
        </li>
      </ul>

      {data.length === 0 ? (
        <p className="text-sm text-slate-500">ไม่มีข้อมูลระยะเวลารายวัน</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="day"
              tickFormatter={formatIngestDayLabel}
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={{ stroke: "#e2e8f0" }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={48}
            />
            <Tooltip content={<DurationTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Line
              type="monotone"
              dataKey="avgDurationMs"
              name="เฉลี่ย"
              stroke="#0ea5e9"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="p95DurationMs"
              name="p95"
              stroke="#6366f1"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
