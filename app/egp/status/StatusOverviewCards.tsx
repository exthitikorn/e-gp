import type { ReactNode } from "react";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock,
  List,
  Minus,
  Rss,
  XCircle,
} from "lucide-react";
import {
  formatIngestDayLabelFromDate,
  formatPreviousIngestDayLabelFromDate,
} from "@/lib/ingestDateTime";

function formatDurationMs(ms: number | null): string {
  if (ms == null) return "-";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function formatIngestDurationMs(ms: number | null): string {
  if (ms == null || ms <= 0) return "-";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)} วินาที`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes} นาที ${seconds} วินาที`;
}

type IngestDurationDelta = {
  text: string;
  className: string;
  icon: "up" | "down" | "same" | null;
};

function formatIngestDurationDelta(
  currentMs: number | null,
  previousMs: number | null,
  previousDayLabel: string | null,
): IngestDurationDelta | null {
  if (currentMs == null || currentMs <= 0) return null;

  const fromLabel = previousDayLabel ? `จาก ${previousDayLabel}` : "จากงานก่อนหน้า";

  if (previousMs == null || previousMs <= 0) {
    return {
      text: previousDayLabel
        ? `ไม่มีข้อมูล ${fromLabel}`
        : "ไม่มีงาน ingest ก่อนหน้า",
      className: "text-slate-500",
      icon: null,
    };
  }

  const diff = currentMs - previousMs;
  if (diff === 0) {
    return {
      text: previousDayLabel ? `เท่ากับ ${previousDayLabel}` : "เท่ากับงานก่อนหน้า",
      className: "text-slate-500",
      icon: "same",
    };
  }

  const deltaText = formatIngestDurationMs(Math.abs(diff));
  if (diff > 0) {
    return {
      text: `เพิ่มขึ้น ${deltaText} ${fromLabel}`,
      className: "text-amber-700",
      icon: "up",
    };
  }

  return {
    text: `ลดลง ${deltaText} ${fromLabel}`,
    className: "text-emerald-700",
    icon: "down",
  };
}

function IngestDurationDeltaIcon({
  icon,
  className,
}: {
  icon: IngestDurationDelta["icon"];
  className: string;
}) {
  if (icon === "up") {
    return <ArrowUp className={`h-3.5 w-3.5 shrink-0 ${className}`} aria-hidden />;
  }
  if (icon === "down") {
    return <ArrowDown className={`h-3.5 w-3.5 shrink-0 ${className}`} aria-hidden />;
  }
  if (icon === "same") {
    return <Minus className={`h-3.5 w-3.5 shrink-0 ${className}`} aria-hidden />;
  }
  return null;
}

type StatusOverviewCardProps = {
  label: string;
  labelClassName?: string;
  icon: ReactNode;
  value: ReactNode;
  valueClassName?: string;
  footer?: ReactNode;
};

function StatusOverviewCard({
  label,
  labelClassName = "text-slate-500",
  icon,
  value,
  valueClassName = "text-2xl font-semibold text-slate-900",
  footer,
}: StatusOverviewCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p
          className={`text-[11px] font-medium uppercase tracking-wide ${labelClassName}`}
        >
          {label}
        </p>
        <div className="shrink-0" aria-hidden>
          {icon}
        </div>
      </div>
      <p className={`mt-1 ${valueClassName}`}>{value}</p>
      {footer != null && <div className="mt-1 space-y-1">{footer}</div>}
    </div>
  );
}

type StatusOverviewCardsProps = {
  total: number;
  successCount: number;
  failedCount: number;
  successRate: number;
  sumItemsParsed: number;
  avgDurationMs: number | null;
  p95DurationMs: number | null;
  latestIngestDurationMs: number | null;
  latestIngestFinishedAt: Date | null;
  yesterdayLatestIngestDurationMs: number | null;
};

const cardIconClass = "h-4 w-4";

export function StatusOverviewCards({
  total,
  successCount,
  failedCount,
  successRate,
  sumItemsParsed,
  avgDurationMs,
  p95DurationMs,
  latestIngestDurationMs,
  latestIngestFinishedAt,
  yesterdayLatestIngestDurationMs,
}: StatusOverviewCardsProps) {
  const latestIngestDayLabel = latestIngestFinishedAt
    ? formatIngestDayLabelFromDate(latestIngestFinishedAt)
    : null;
  const previousIngestDayLabel = latestIngestFinishedAt
    ? formatPreviousIngestDayLabelFromDate(latestIngestFinishedAt)
    : null;
  const ingestDurationDelta = formatIngestDurationDelta(
    latestIngestDurationMs,
    yesterdayLatestIngestDurationMs,
    previousIngestDayLabel,
  );

  return (
    <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <StatusOverviewCard
        label="รายการทั้งหมด"
        icon={<List className={`${cardIconClass} text-slate-400`} />}
        value={total.toLocaleString("th-TH")}
        footer={<p className="text-xs text-slate-500">ตามตัวกรองที่เลือก</p>}
      />

      <StatusOverviewCard
        label="สำเร็จ"
        labelClassName="text-emerald-700"
        icon={<CheckCircle2 className={`${cardIconClass} text-emerald-600`} />}
        value={successCount.toLocaleString("th-TH")}
        valueClassName="text-2xl font-semibold text-emerald-800"
        footer={
          <p className="text-xs text-emerald-700">{successRate}% ของทั้งหมด</p>
        }
      />

      <StatusOverviewCard
        label="ล้มเหลว"
        labelClassName="text-rose-700"
        icon={<XCircle className={`${cardIconClass} text-rose-600`} />}
        value={failedCount.toLocaleString("th-TH")}
        valueClassName="text-2xl font-semibold text-rose-800"
        footer={
          <p className="text-xs text-rose-700">
            {total > 0 ? 100 - successRate : 0}% ของทั้งหมด
          </p>
        }
      />

      <StatusOverviewCard
        label="รายการ RSS รวม"
        labelClassName="text-sky-700"
        icon={<Rss className={`${cardIconClass} text-sky-600`} />}
        value={sumItemsParsed.toLocaleString("th-TH")}
        valueClassName="text-2xl font-semibold text-sky-900"
        footer={<p className="text-xs text-sky-700">จาก URL ที่ดึงสำเร็จ</p>}
      />

      <StatusOverviewCard
        label="เวลาเฉลี่ย / p95 ต่อ URL"
        icon={<Clock className={`${cardIconClass} text-slate-400`} />}
        value={formatDurationMs(
          avgDurationMs != null ? Math.round(avgDurationMs) : null,
        )}
        footer={
          <p className="text-xs text-slate-500">
            p95:{" "}
            {formatDurationMs(
              p95DurationMs != null ? Math.round(p95DurationMs) : null,
            )}
          </p>
        }
      />

      <StatusOverviewCard
        label={
          latestIngestDayLabel
            ? `ระยะเวลาในการ ingest ล่าสุด ${latestIngestDayLabel}`
            : "ระยะเวลาในการ ingest ล่าสุด"
        }
        icon={<Activity className={`${cardIconClass} text-slate-400`} />}
        value={formatIngestDurationMs(latestIngestDurationMs)}
        valueClassName="text-lg font-semibold text-slate-900 sm:text-xl"
        footer={
          <>
            {ingestDurationDelta && (
              <p
                className={`flex items-center justify-between gap-2 text-xs ${ingestDurationDelta.className}`}
                aria-label={ingestDurationDelta.text}
              >
                <span>{ingestDurationDelta.text}</span>
                <IngestDurationDeltaIcon
                  icon={ingestDurationDelta.icon}
                  className={ingestDurationDelta.className}
                />
              </p>
            )}
          </>
        }
      />
    </section>
  );
}
