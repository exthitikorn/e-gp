"use client";

import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildStatusHref,
  type DailyTrendRow,
  type StatusFilterQuery,
} from "@/lib/egpIngestStatusShared";
import { formatIngestDayLabel } from "@/lib/formatIngestDayLabel";

type StatusDailyTrendChartProps = {
  data: DailyTrendRow[];
  filterQuery: StatusFilterQuery;
  showTrendScopeHint?: boolean;
};

type TooltipPayloadItem = {
  name?: string;
  value?: number;
};

function DailyTrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;

  const success = payload.find((p) => p.name === "สำเร็จ")?.value ?? 0;
  const failed = payload.find((p) => p.name === "ล้มเหลว")?.value ?? 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-slate-900">
        {formatIngestDayLabel(label)}
      </p>
      <p className="text-emerald-700">สำเร็จ: {success.toLocaleString("th-TH")}</p>
      <p className="text-rose-700">ล้มเหลว: {failed.toLocaleString("th-TH")}</p>
      <p className="mt-1 border-t border-slate-100 pt-1 text-slate-600">
        รวม: {(success + failed).toLocaleString("th-TH")}
      </p>
      <p className="mt-1 text-[10px] text-slate-400">คลิกแท่งเพื่อกรองวันนี้</p>
    </div>
  );
}

export function StatusDailyTrendChart({
  data,
  filterQuery,
  showTrendScopeHint = false,
}: StatusDailyTrendChartProps) {
  const router = useRouter();

  const handleBarClick = (index: number, dataKey?: string) => {
    const barData = data[index];
    if (!barData?.day) return;
    const href = buildStatusHref({
      ...filterQuery,
      day: barData.day,
      status: dataKey === "failedCount" ? "failed" : undefined,
      page: undefined,
    });
    router.push(href);
  };

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">
        แนวโน้ม ingest รายวัน
      </h2>
      <p className="mb-4 text-[10px] uppercase tracking-wide text-slate-500">
        {showTrendScopeHint && (
          <span className="mt-1 block normal-case text-sky-700">
            แสดง 31 วันล่าสุด (ตัวเลขสรุปด้านบนครอบคลุมทั้งหมด)
          </span>
        )}
      </p>

      {data.length === 0 ? (
        <p className="text-sm text-slate-500">ไม่มีข้อมูลแนวโน้มรายวัน</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
              width={36}
            />
            <Tooltip content={<DailyTrendTooltip />} cursor={{ fill: "#f8fafc" }} />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              formatter={(value) => (
                <span className="text-slate-700">{value}</span>
              )}
            />
            <Bar
              dataKey="successCount"
              name="สำเร็จ"
              stackId="ingest"
              fill="#34d399"
              className="cursor-pointer"
              onClick={(_barData, index) => handleBarClick(index, "successCount")}
            />
            <Bar
              dataKey="failedCount"
              name="ล้มเหลว"
              stackId="ingest"
              fill="#fb7185"
              radius={[4, 4, 0, 0]}
              className="cursor-pointer"
              onClick={(_barData, index) => handleBarClick(index, "failedCount")}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
