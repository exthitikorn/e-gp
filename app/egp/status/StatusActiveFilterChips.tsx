"use client";

import Link from "next/link";
import {
  buildStatusHrefWithout,
  formatThaiMonthYearFromParam,
  type IngestStatusSearchParams,
} from "@/lib/egpIngestStatusShared";
import { httpBucketParamToLabel } from "@/lib/egpErrorBreakdownColors";
import { formatIngestDayLabel } from "@/lib/formatIngestDayLabel";
import { getEgpAnnounceTypeLabel } from "@/lib/egpRss";

type AgencyOption = { id: string; name: string };

type ActiveFilterChip = {
  key: keyof IngestStatusSearchParams;
  label: string;
};

type StatusActiveFilterChipsProps = {
  searchParams: IngestStatusSearchParams;
  agencies: AgencyOption[];
};

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}

function buildChips(
  searchParams: IngestStatusSearchParams,
  agencies: AgencyOption[],
): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];

  if (searchParams.month?.trim()) {
    const label =
      formatThaiMonthYearFromParam(searchParams.month) ?? searchParams.month;
    chips.push({ key: "month", label: `เดือน ${label}` });
  }

  if (searchParams.agencyId) {
    const agency = agencies.find((a) => a.id === searchParams.agencyId);
    chips.push({
      key: "agencyId",
      label: `หน่วยงาน ${agency?.name ?? searchParams.agencyId}`,
    });
  }

  if (searchParams.status === "success") {
    chips.push({ key: "status", label: "เฉพาะสำเร็จ" });
  }
  if (searchParams.status === "failed") {
    chips.push({ key: "status", label: "เฉพาะล้มเหลว" });
  }

  if (searchParams.announceType?.trim()) {
    chips.push({
      key: "announceType",
      label: `ประเภท ${getEgpAnnounceTypeLabel(searchParams.announceType)}`,
    });
  }

  if (searchParams.httpBucket?.trim()) {
    chips.push({
      key: "httpBucket",
      label: `HTTP ${httpBucketParamToLabel(searchParams.httpBucket.trim())}`,
    });
  }

  if (searchParams.errorCategory?.trim()) {
    chips.push({
      key: "errorCategory",
      label: `error ${truncateText(decodeURIComponent(searchParams.errorCategory.trim()), 32)}`,
    });
  }

  if (searchParams.day?.trim()) {
    chips.push({
      key: "day",
      label: `วัน ${formatIngestDayLabel(searchParams.day.trim())}`,
    });
  }

  if (searchParams.jobId?.trim()) {
    chips.push({
      key: "jobId",
      label: `งาน ${truncateText(searchParams.jobId.trim(), 16)}`,
    });
  }

  return chips;
}

export function StatusActiveFilterChips({
  searchParams,
  agencies,
}: StatusActiveFilterChipsProps) {
  const chips = buildChips(searchParams, agencies);
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={buildStatusHrefWithout(searchParams, chip.key)}
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100"
          title="คลิกเพื่อลบตัวกรองนี้"
        >
          <span>{chip.label}</span>
          <span aria-hidden className="text-emerald-600">
            ×
          </span>
        </Link>
      ))}
    </div>
  );
}
