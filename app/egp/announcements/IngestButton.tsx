"use client";

import { useEffect, useState, useTransition } from "react";

interface AgencyIngestSlice {
  agencyId: string;
  name: string;
  deptId: string | null;
  deptsubId: string | null;
  rssUses: "deptId" | "deptsubId" | null;
  created: number;
  updated: number;
  totalFromRss: number;
  byAnnounceType: Record<
    string,
    {
      created: number;
      updated: number;
      total: number;
    }
  >;
  error?: string;
}

interface IngestResult {
  created: number;
  updated: number;
  totalFromRss: number;
  byAnnounceType: Record<
    string,
    {
      created: number;
      updated: number;
      total: number;
    }
  >;
  byAgencies?: AgencyIngestSlice[];
  /** alias เดิมจาก API ingest */
  byDepartment?: AgencyIngestSlice[];
  error?: string;
}

export function IngestButton() {
  const [isPending, startTransition] = useTransition();
  const [isIngestVisible, setIsIngestVisible] = useState(false);
  const [summaryStats, setSummaryStats] = useState<{
    created: number;
    updated: number;
    totalFromRss: number;
  } | null>(null);
  const [typeStats, setTypeStats] = useState<
    Array<{
      type: string;
      created: number;
      updated: number;
      total: number;
    }>
  >([]);
  const [agencySlices, setAgencySlices] = useState<AgencyIngestSlice[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // ทางลัดสำหรับผู้ดูแลระบบ (เลี่ยง Alt+Shift เพราะชนกับสลับภาษาใน Windows)
      // รองรับ: Ctrl+Shift+G หรือ Ctrl+Alt+G
      const isG = event.key.toLowerCase() === "g";
      const isCtrlShiftG = event.ctrlKey && event.shiftKey && isG;
      const isCtrlAltG = event.ctrlKey && event.altKey && isG;
      if (isCtrlShiftG || isCtrlAltG) {
        event.preventDefault();
        setIsIngestVisible((prev) => !prev);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const handleClick = () => {
    startTransition(async () => {
      setSummaryStats(null);
      setTypeStats([]);
      setAgencySlices([]);
      setError(null);

      try {
        const response = await fetch("/api/egp/announcements/ingest", {
          method: "GET",
          cache: "no-store",
        });

        const data: IngestResult = await response.json();

        if (response.status === 422) {
          setError(
            data.error ||
              "ยังไม่มีหน่วยงานที่ status = 1 ในฐานข้อมูล — ให้เพิ่ม EgpAgency ก่อน",
          );
          return;
        }

        if (!response.ok || data.error) {
          setError(data.error || "ดึงข้อมูลไม่สำเร็จ");
          return;
        }

        setSummaryStats({
          created: data.created,
          updated: data.updated,
          totalFromRss: data.totalFromRss,
        });
        const sortedTypeStats = Object.entries(data.byAnnounceType ?? {})
          .map(([type, stats]) => ({
            type,
            created: stats.created,
            updated: stats.updated,
            total: stats.total,
          }))
          .sort((a, b) => b.total - a.total);
        setTypeStats(sortedTypeStats);
        setAgencySlices(data.byAgencies ?? data.byDepartment ?? []);
      } catch {
        setError("เกิดข้อผิดพลาดระหว่างดึงข้อมูลจาก e-GP");
      }
    });
  };

  function rssLabel(slice: AgencyIngestSlice): string {
    if (slice.rssUses === "deptId" && slice.deptId) {
      return `RSS: deptId ${slice.deptId}`;
    }
    if (slice.rssUses === "deptsubId" && slice.deptsubId) {
      return `RSS: deptsubId ${slice.deptsubId}`;
    }
    return "RSS: —";
  }

  return (
    <div className="mt-4 space-y-2">
      {isIngestVisible && (
        <button
          type="button"
          onClick={handleClick}
          disabled={isPending}
          className="inline-flex items-center rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-medium text-slate-950 shadow hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-700"
        >
          {isPending ? "กำลังดึงข้อมูลจาก e-GP..." : "ดึงข้อมูลจาก e-GP"}
        </button>
      )}
      {summaryStats && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
          <p className="mb-1 text-xs font-semibold text-emerald-700">
            ดึงข้อมูลสำเร็จ
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
              เพิ่ม {summaryStats.created} รายการ
            </span>
            <span className="rounded-full border border-sky-300 bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
              แก้ไข {summaryStats.updated} รายการ
            </span>
            <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
              รวมจาก RSS {summaryStats.totalFromRss} รายการ
            </span>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
      {agencySlices.length > 1 && (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="mb-2 text-xs font-semibold text-slate-700">
            สรุปตามหน่วยงาน
          </p>
          <ul className="space-y-2">
            {agencySlices.map((d) => (
              <li
                key={d.agencyId}
                className="rounded border border-slate-200 bg-slate-50 px-2 py-2 text-xs"
              >
                <div className="font-medium text-slate-800">{d.name}</div>
                <div className="text-[11px] text-slate-600">{rssLabel(d)}</div>
                {d.error ? (
                  <p className="mt-1 text-[11px] text-red-600">{d.error}</p>
                ) : (
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                    <span className="text-slate-600">RSS {d.totalFromRss} รายการ</span>
                    <span className="text-emerald-700">+{d.created}</span>
                    <span className="text-sky-700">~{d.updated}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {agencySlices.length === 1 && agencySlices[0]?.error && (
        <p className="text-xs text-amber-700">
          {agencySlices[0].name}: {agencySlices[0].error}
        </p>
      )}
      {typeStats.length > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-white p-3">
          <p className="mb-2 text-xs font-semibold text-slate-700">
            สรุปตามประเภทประกาศ
          </p>
          <ul className="space-y-1">
            {typeStats.map((item) => (
              <li
                key={item.type}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
              >
                <span className="font-medium text-slate-700">{item.type}</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                    รวม {item.total}
                  </span>
                  <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                    เพิ่ม {item.created}
                  </span>
                  <span className="rounded-full border border-sky-300 bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
                    แก้ไข {item.updated}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
