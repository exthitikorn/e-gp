"use client";

import { useState, useTransition } from "react";

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
  error?: string;
}

export function IngestButton() {
  const [isPending, startTransition] = useTransition();
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
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    startTransition(async () => {
      setSummaryStats(null);
      setTypeStats([]);
      setError(null);

      try {
        const response = await fetch("/api/egp/announcements/ingest", {
          method: "GET",
          cache: "no-store",
        });

        const data: IngestResult = await response.json();

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
      } catch {
        setError("เกิดข้อผิดพลาดระหว่างดึงข้อมูลจาก e-GP");
      }
    });
  };

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
      {error && (
        <p className="text-xs text-red-400">
          {error}
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

