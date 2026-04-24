"use client";

import { useMemo, useState } from "react";

type AgencyIncrease = {
  agencyId: string;
  agencyName: string;
  count: number;
};

function formatStat(value: number): string {
  return value.toLocaleString("th-TH");
}

export default function ProjectsAddedByAgencyModal({
  items,
}: {
  items: AgencyIncrease[];
}) {
  const [open, setOpen] = useState(false);
  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.count, 0),
    [items],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 inline-flex rounded-full border border-slate-300 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
      >
        ดูรายละเอียดรายหน่วยงาน
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  โครงการที่เพิ่มขึ้นเมื่อวาน (แยกตามหน่วยงาน)
                </p>
                <p className="text-xs text-slate-500">
                  รวมทั้งหมด {formatStat(total)} โครงการ
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                aria-label="ปิด"
              >
                ปิด
              </button>
            </div>

            <div className="max-h-80 overflow-auto rounded-lg border border-slate-200">
              {items.length === 0 ? (
                <p className="px-3 py-4 text-xs text-slate-500">
                  เมื่อวานไม่มีโครงการเพิ่มในทุกหน่วยงาน
                </p>
              ) : (
                <ul className="divide-y divide-slate-200">
                  {items.map((item) => (
                    <li
                      key={item.agencyId}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                    >
                      <span className="line-clamp-2 text-slate-700">
                        {item.agencyName}
                      </span>
                      <span className="shrink-0 font-semibold text-emerald-600">
                        เพิ่มขึ้น {formatStat(item.count)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
