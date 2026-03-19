"use client";

import { useState, useTransition } from "react";

interface IngestResult {
  created: number;
  updated: number;
  totalFromRss: number;
  error?: string;
}

export function IngestButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    startTransition(async () => {
      setMessage(null);
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

        setMessage(
          `ดึงข้อมูลสำเร็จ: เพิ่ม ${data.created} รายการ, แก้ไข ${data.updated} รายการ`,
        );
      } catch {
        setError("เกิดข้อผิดพลาดระหว่างดึงข้อมูลจาก e-GP");
      }
    });
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-medium text-slate-950 shadow hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-700"
      >
        {isPending ? "กำลังดึงข้อมูลจาก e-GP..." : "ดึงข้อมูลจาก e-GP"}
      </button>
      {message && (
        <span className="text-xs text-emerald-300">
          {message}
        </span>
      )}
      {error && (
        <span className="text-xs text-red-400">
          {error}
        </span>
      )}
    </div>
  );
}

