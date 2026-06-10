"use client";

import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildStatusHref,
  type ErrorBreakdown,
  type StatusFilterQuery,
  type TopErrorRow,
} from "@/lib/egpIngestStatusShared";
import {
  httpBucketLabelToParam,
  prepareHttpBucketChartData,
} from "@/lib/egpErrorBreakdownColors";

type StatusErrorBreakdownChartsProps = {
  data: ErrorBreakdown;
  filterQuery: StatusFilterQuery;
};

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}

function HttpDonutTooltip({
  active,
  payload,
  totalFailed,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number }>;
  totalFailed: number;
}) {
  if (!active || !payload?.length) return null;

  const item = payload[0];
  const count = item.value ?? 0;
  const percent =
    totalFailed > 0 ? Math.round((count / totalFailed) * 100) : 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-slate-900">{item.name}</p>
      <p className="text-slate-700">จำนวน: {count.toLocaleString("th-TH")}</p>
      <p className="text-slate-500">{percent}% ของข้อผิดพลาดทั้งหมด</p>
      <p className="mt-1 text-[10px] text-slate-400">คลิกเพื่อกรอง log</p>
    </div>
  );
}

function TopErrorTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: TopErrorRow }>;
}) {
  if (!active || !payload?.length) return null;

  const row = payload[0].payload;
  if (!row) return null;

  return (
    <div className="max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-slate-900">{row.category}</p>
      <p className="text-rose-700">
        จำนวน: {row.count.toLocaleString("th-TH")}
      </p>
      {row.sample && (
        <p className="mt-1 border-t border-slate-100 pt-1 text-slate-500">
          {truncateText(row.sample, 80)}
        </p>
      )}
      <p className="mt-1 text-[10px] text-slate-400">คลิกเพื่อกรอง log</p>
    </div>
  );
}

function renderHttpLegend(value: string, entry: { payload?: { count?: number } }) {
  const count = entry.payload?.count ?? 0;
  return (
    <span className="text-slate-700">
      {value} ({count.toLocaleString("th-TH")})
    </span>
  );
}

export function StatusErrorBreakdownCharts({
  data,
  filterQuery,
}: StatusErrorBreakdownChartsProps) {
  const router = useRouter();
  const httpChartData = prepareHttpBucketChartData(data.httpBuckets);
  const topErrorsChartData = [...data.topErrors].reverse();
  const barChartHeight = Math.min(
    300,
    Math.max(180, topErrorsChartData.length * 36),
  );

  const handleHttpClick = (_: unknown, index: number) => {
    const entry = httpChartData[index];
    if (!entry) return;
    const httpBucket = httpBucketLabelToParam(entry.label);
    if (!httpBucket) return;
    router.push(
      buildStatusHref({
        ...filterQuery,
        status: "failed",
        httpBucket,
        page: undefined,
      }),
    );
  };

  const handleErrorClick = (row: TopErrorRow) => {
    router.push(
      buildStatusHref({
        ...filterQuery,
        status: "failed",
        errorCategory: encodeURIComponent(row.category),
        page: undefined,
      }),
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-[10px] uppercase tracking-wide text-slate-500">
          HTTP status
        </p>
        {httpChartData.length === 0 ? (
          <p className="text-sm text-slate-500">ไม่มีข้อมูล HTTP status</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={httpChartData}
                dataKey="count"
                nameKey="label"
                innerRadius="55%"
                outerRadius="80%"
                paddingAngle={2}
                className="cursor-pointer"
                onClick={handleHttpClick}
              >
                {httpChartData.map((entry) => (
                  <Cell key={entry.label} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                content={<HttpDonutTooltip totalFailed={data.totalFailed} />}
              />
              <Legend
                formatter={renderHttpLegend}
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      <div>
        <p className="mb-2 text-[10px] uppercase tracking-wide text-slate-500">
          ข้อความที่พบบ่อย
        </p>
        {topErrorsChartData.length === 0 ? (
          <p className="text-sm text-slate-500">
            ไม่มีข้อความ error ที่จัดกลุ่มได้
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={barChartHeight}>
            <BarChart
              data={topErrorsChartData}
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
                dataKey="category"
                width={150}
                tick={{ fontSize: 10, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value: string) => truncateText(value, 28)}
              />
              <Tooltip content={<TopErrorTooltip />} cursor={{ fill: "#f8fafc" }} />
              <Bar
                dataKey="count"
                name="จำนวน"
                fill="#fb7185"
                radius={[0, 4, 4, 0]}
                className="cursor-pointer"
                onClick={(_data, index) => {
                  const row = topErrorsChartData[index];
                  if (row) handleErrorClick(row);
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
