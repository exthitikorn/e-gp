"use client";

import Link from "next/link";
import { useRef } from "react";

type AgencyOption = {
  id: string;
  name: string;
};

type SearchParams = {
  q?: string;
  projectNumber?: string;
  methodId?: string;
  status?: string;
  agencyId?: string;
};

type AnnouncementsFiltersProps = {
  formKey: string;
  resolvedSearchParams: SearchParams;
  agencies: AgencyOption[];
};

export function AnnouncementsFilters({
  formKey,
  resolvedSearchParams,
  agencies,
}: AnnouncementsFiltersProps) {
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
        action="/egp/announcements"
        className="grid gap-4 text-sm sm:grid-cols-5 sm:items-end"
      >
        <div className="space-y-1 sm:col-span-1 sm:flex sm:flex-col sm:items-stretch sm:gap-2">
          <label htmlFor="q" className="block text-xs font-medium text-slate-600">
            คีย์เวิร์ด
          </label>
          <input
            id="q"
            name="q"
            type="text"
            defaultValue={resolvedSearchParams.q}
            placeholder="เช่น จัดซื้อครุภัณฑ์, ก่อสร้างถนน"
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
          />
        </div>
        <div className="space-y-1 sm:col-span-1">
          <label
            htmlFor="projectNumber"
            className="block text-xs font-medium text-slate-600"
          >
            เลขที่โครงการ
          </label>
          <input
            id="projectNumber"
            name="projectNumber"
            type="text"
            defaultValue={resolvedSearchParams.projectNumber}
            placeholder="เช่น 6701-001-0001"
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
          />
        </div>
        <div className="space-y-1 sm:col-span-1">
          <label htmlFor="methodId" className="block text-xs font-medium text-slate-600">
            วิธีการจัดหา
          </label>
          <select
            id="methodId"
            name="methodId"
            defaultValue={resolvedSearchParams.methodId ?? ""}
            onChange={submitOnFilterChange}
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
          >
            <option value="">ทั้งหมด</option>
            <option value="e-bidding">e-bidding</option>
            <option value="e-market">e-market</option>
            <option value="เฉพาะเจาะจง">เฉพาะเจาะจง</option>
            <option value="คัดเลือก">คัดเลือก</option>
          </select>
        </div>
        <div className="space-y-1 sm:col-span-1">
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
        <div className="space-y-1 sm:col-span-1">
          <label htmlFor="status" className="block text-xs font-medium text-slate-600">
            สถานะโครงการ
          </label>
          <select
            id="status"
            name="status"
            defaultValue={resolvedSearchParams.status ?? ""}
            onChange={submitOnFilterChange}
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
          >
            <option value="">ทั้งหมด</option>
            <option value="ยกเลิก">ยกเลิกโครงการ</option>
            <option value="ผู้ชนะการเสนอราคา">ประกาศผู้ชนะการเสนอราคา</option>
            <option value="หนังสือเชิญชวน/ประกาศเชิญชวน">
              หนังสือเชิญชวน/ประกาศเชิญชวน
            </option>
          </select>
        </div>
        <div className="sm:col-span-5 flex items-end justify-end gap-2">
          <Link
            href="/egp/announcements"
            className="inline-flex items-center rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 shadow-sm hover:border-rose-400 hover:bg-rose-100 hover:text-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
          >
            ล้างเงื่อนไข
          </Link>
        </div>
      </form>
    </section>
  );
}
