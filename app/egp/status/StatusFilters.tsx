"use client";

import Link from "next/link";
import { useRef } from "react";
import type { IngestStatusSearchParams } from "@/lib/egpIngestStatusShared";

type AgencyOption = {
  id: string;
  name: string;
};

type AnnounceTypeOption = {
  code: string;
  label: string;
};

type StatusFiltersProps = {
  formKey: string;
  resolvedSearchParams: IngestStatusSearchParams;
  agencies: AgencyOption[];
  announceTypeOptions: AnnounceTypeOption[];
};

export function StatusFilters({
  formKey,
  resolvedSearchParams,
  agencies,
  announceTypeOptions,
}: StatusFiltersProps) {
  const formRef = useRef<HTMLFormElement>(null);

  const submitOnFilterChange = () => {
    formRef.current?.requestSubmit();
  };

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white/90 p-4">
      <form
        key={formKey}
        ref={formRef}
        method="GET"
        action="/egp/status"
        className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 xl:items-end"
      >
        <div className="space-y-1">
          <label htmlFor="month" className="block text-xs font-medium text-slate-600">
            เดือน
          </label>
          <input
            id="month"
            name="month"
            type="month"
            defaultValue={resolvedSearchParams.month ?? ""}
            onChange={submitOnFilterChange}
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="agencyId" className="block text-xs font-medium text-slate-600">
            หน่วยงาน
          </label>
          <select
            id="agencyId"
            name="agencyId"
            defaultValue={resolvedSearchParams.agencyId ?? ""}
            onChange={submitOnFilterChange}
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
          >
            <option value="">ทั้งหมด</option>
            {agencies.map((agency) => (
              <option key={agency.id} value={agency.id}>
                {agency.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="status" className="block text-xs font-medium text-slate-600">
            ผลการดึง
          </label>
          <select
            id="status"
            name="status"
            defaultValue={resolvedSearchParams.status ?? ""}
            onChange={submitOnFilterChange}
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
          >
            <option value="">ทั้งหมด</option>
            <option value="success">สำเร็จ</option>
            <option value="failed">ล้มเหลว</option>
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="announceType" className="block text-xs font-medium text-slate-600">
            ประเภทประกาศ
          </label>
          <select
            id="announceType"
            name="announceType"
            defaultValue={resolvedSearchParams.announceType ?? ""}
            onChange={submitOnFilterChange}
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
          >
            <option value="">ทั้งหมด</option>
            {announceTypeOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:col-span-2 xl:col-span-1">
          <Link
            href="/egp/status"
            className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-400"
          >
            ล้างตัวกรอง
          </Link>
        </div>
      </form>
    </section>
  );
}
