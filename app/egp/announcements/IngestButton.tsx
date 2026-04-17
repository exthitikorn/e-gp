"use client";

import { useState, useTransition } from "react";

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

const ingestToken = process.env.NEXT_PUBLIC_EGP_INGEST_SECRET;

export function IngestButton() {
  const [isPending, startTransition] = useTransition();
  const [isResultVisible, setIsResultVisible] = useState(false);
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

  const handleClick = () => {
    startTransition(async () => {
      setSummaryStats(null);
      setTypeStats([]);
      setAgencySlices([]);
      setError(null);
      setIsResultVisible(false);

      try {
        const ingestUrl = new URL(
          "/api/egp/announcements/ingest",
          window.location.origin,
        );
        if (ingestToken) {
          ingestUrl.searchParams.set("token", ingestToken);
        }

        const response = await fetch(ingestUrl.toString(), {
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
          if (response.status === 401 && !ingestToken) {
            setError(
              "Unauthorized: กรุณาตั้งค่า NEXT_PUBLIC_EGP_INGEST_SECRET ให้ตรงกับ EGP_INGEST_SECRET",
            );
            return;
          }
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
        setIsResultVisible(true);
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
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-medium text-slate-950 shadow hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-700"
      >
        {isPending ? "กำลังดึงข้อมูลจาก e-GP..." : "ดึงข้อมูลจาก e-GP"}
      </button>
      {summaryStats && isResultVisible && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-emerald-700">ดึงข้อมูลสำเร็จ</p>
            <button
              type="button"
              onClick={() => setIsResultVisible(false)}
              className="inline-flex h-5 w-5 items-center justify-center rounded border border-emerald-300 bg-white text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
              aria-label="ปิดสรุปผล"
            >
              ×
            </button>
          </div>
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
      {agencySlices.length > 1 && isResultVisible && (
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
      {typeStats.length > 0 && isResultVisible && (
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
