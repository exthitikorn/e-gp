export const dynamic = "force-dynamic";

import Link from "next/link";
import { IngestButton } from "./IngestButton";

type SearchParams = {
  q?: string;
  page?: string;
  projectNumber?: string;
  methodId?: string;
  status?: string;
};

interface SearchPageProps {
  searchParams?: Promise<SearchParams>;
}

type ProjectSearchItem = {
  id: string;
  projectNumber: string | null;
  methodId: string | null;
  status: string | null;
  title: string;
  updatedAt: string;
};

type ProjectSearchResponse = {
  items: ProjectSearchItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function getStatusBadgeClass(status: string): string {
  const normalized = status.trim();

  if (/ยกเลิก/u.test(normalized)) {
    return "bg-rose-100 text-rose-700 ring-1 ring-inset ring-rose-200";
  }

  if (/ผู้ชนะการเสนอราคา|ผู้ได้รับการคัดเลือก|อนุมัติ/u.test(normalized)) {
    return "bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200";
  }

  return "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200";
}

async function fetchProjectsFromApi(
  params: URLSearchParams,
): Promise<ProjectSearchResponse> {
  const query = params.toString();
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(
    `${baseUrl}/api/egp/projects/search?${query}`,
    {
      cache: "no-store",
    },
  );

  if (!res.ok) {
    throw new Error("ไม่สามารถดึงข้อมูลโครงการจากฐานข้อมูลได้");
  }

  return res.json();
}

export default async function AnnouncementsPage({
  searchParams,
}: SearchPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const params = new URLSearchParams();

  if (resolvedSearchParams.q) {
    params.set("q", resolvedSearchParams.q);
  }
  if (resolvedSearchParams.projectNumber) {
    params.set("projectNumber", resolvedSearchParams.projectNumber);
  }
  if (resolvedSearchParams.methodId) {
    params.set("methodId", resolvedSearchParams.methodId);
  }
  if (resolvedSearchParams.status) {
    params.set("status", resolvedSearchParams.status);
  }
  if (resolvedSearchParams.page) {
    params.set("page", resolvedSearchParams.page);
  }

  const data = await fetchProjectsFromApi(params);
  const projects = data.items;
  const currentPage = data.page;
  const totalPages = data.totalPages;

  const formKey = params.toString();

  const createPageLink = (page: number) => {
    const urlParams = new URLSearchParams(params.toString());

    if (page <= 1) {
      urlParams.delete("page");
    } else {
      urlParams.set("page", String(page));
    }

    const query = urlParams.toString();
    return query ? `/egp/announcements?${query}` : "/egp/announcements";
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 md:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 space-y-2">
          <div className="text-sm text-slate-500">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-emerald-700 hover:text-emerald-800"
            >
              ← กลับหน้า landing
            </Link>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            โครงการจัดซื้อจัดจ้าง
          </h1>
          <div className="space-y-2">
            <p className="text-sm text-slate-600 sm:text-base">
              เก็บข้อมูลโครงการและประกาศจากระบบ e-GP ของหน่วยงาน
              ตั้งแต่วันที่เริ่มใช้งาน RSS สามารถค้นหาย้อนหลังได้ตลอดเวลา
            </p>
            <IngestButton />
          </div>
        </header>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white/90 p-4">
          <form
            key={formKey}
            method="GET"
            action="/egp/announcements"
            className="grid gap-4 text-sm sm:grid-cols-4 sm:items-end"
          >
            <div className="space-y-1 sm:col-span-1 sm:flex sm:flex-col sm:items-stretch sm:gap-2">
              <label
                htmlFor="q"
                className="block text-xs font-medium text-slate-600"
              >
                คีย์เวิร์ด (ชื่อโครงการ / เลขที่ / วิธีการ / สถานะ)
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
              <label
                htmlFor="methodId"
                className="block text-xs font-medium text-slate-600"
              >
                วิธีการจัดหา
              </label>
              <select
                id="methodId"
                name="methodId"
                defaultValue={resolvedSearchParams.methodId ?? ""}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
              >
                <option value="">ทั้งหมด</option>
                <option value="e-bidding">e-bidding</option>
                <option value="e-market">e-market</option>
                <option value="เฉพาะเจาะจง">เฉพาะเจาะจง</option>
              </select>
            </div>
            <div className="space-y-1 sm:col-span-1">
              <label
                htmlFor="status"
                className="block text-xs font-medium text-slate-600"
              >
                สถานะโครงการ
              </label>
              <select
                id="status"
                name="status"
                defaultValue={resolvedSearchParams.status ?? ""}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
              >
                <option value="">ทั้งหมด</option>
                <option value="ยกเลิก">ยกเลิกโครงการ</option>
                <option value="ผู้ชนะการเสนอราคา">ประกาศผู้ชนะการเสนอราคา</option>
                <option value="หนังสือเชิญชวน/ประกาศเชิญชวน">หนังสือเชิญชวน/ประกาศเชิญชวน</option>
              </select>
            </div>
            <div className="sm:col-span-4 flex items-end justify-end gap-2">
              <Link
                href="/egp/announcements"
                className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:border-slate-400 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              >
                ล้างเงื่อนไข
              </Link>
              <button
                type="submit"
                className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              >
                ค้นหา
              </button>
            </div>
          </form>
          <p className="mt-3 text-xs text-slate-500">
            * การค้นหาใช้ข้อมูลที่ระบบดึงจาก RSS e-GP มาบันทึกไว้ในฐานข้อมูลของ
            หน่วยงานแล้ว
          </p>
        </section>

        {projects.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-6 text-sm text-slate-600">
            ยังไม่มีข้อมูลโครงการที่ตรงกับเงื่อนไขที่ค้นหา
          </div>
        ) : (
          <div className="space-y-3 text-xs text-slate-600">
            <p>
              พบทั้งหมด{" "}
              <span className="font-semibold text-emerald-600">
                {data.total}
              </span>{" "}
              โครงการ แสดงหน้า{" "}
              <span className="font-semibold text-slate-900">
                {data.page} / {data.totalPages}
              </span>
            </p>
            <ul className="space-y-4">
              {projects.map((item) => {
                const detailBaseHref = `/egp/announcements/${encodeURIComponent(
                  item.projectNumber ?? item.id,
                )}`;
                const detailHref = formKey
                  ? `${detailBaseHref}?${formKey}`
                  : detailBaseHref;
                return (
                  <li key={item.id}>
                    <Link
                      href={detailHref}
                      className="block rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-emerald-400/60 hover:bg-emerald-50/40"
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                          <h2 className="text-sm font-semibold text-slate-900 sm:text-base">
                            {item.title}
                          </h2>
                          {item.status ? (
                            <span
                              className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium ${getStatusBadgeClass(
                                item.status,
                              )}`}
                            >
                              {item.status}
                            </span>
                          ) : (
                            <span className="whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                              อัปเดตล่าสุด{" "}
                              {new Date(item.updatedAt).toLocaleString("th-TH")}
                            </span>
                          )}
                        </div>

                        {(item.projectNumber || item.methodId) && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600 sm:text-xs">
                            {item.projectNumber && (
                              <span>
                                <span className="font-medium text-slate-800">
                                  เลขที่โครงการ:
                                </span>{" "}
                                {item.projectNumber}
                              </span>
                            )}
                            {item.methodId && (
                              <span>
                                <span className="font-medium text-slate-800">
                                  วิธีการจัดหา:
                                </span>{" "}
                                {item.methodId}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {totalPages > 1 && (
              <nav className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">
                    หน้า{" "}
                    <span className="font-semibold text-slate-900">
                      {currentPage}
                    </span>{" "}
                    จาก{" "}
                    <span className="font-semibold text-slate-900">
                      {totalPages}
                    </span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={createPageLink(Math.max(1, currentPage - 1))}
                    aria-disabled={currentPage === 1}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      currentPage === 1
                        ? "cursor-not-allowed border border-slate-200 text-slate-400"
                        : "border border-slate-300 text-slate-700 hover:border-emerald-400 hover:text-emerald-700"
                    }`}
                  >
                    ก่อนหน้า
                  </Link>

                  {(() => {
                    const windowSize = 5;
                    const half = Math.floor(windowSize / 2);
                    let start = Math.max(1, currentPage - half);
                    let end = start + windowSize - 1;

                    if (end > totalPages) {
                      end = totalPages;
                      start = Math.max(1, end - windowSize + 1);
                    }

                    const pages = [];
                    for (let page = start; page <= end; page += 1) {
                      pages.push(page);
                    }

                    return pages.map((page) => (
                      <Link
                        key={page}
                        href={createPageLink(page)}
                        aria-current={page === currentPage ? "page" : undefined}
                        className={`min-w-9 rounded-full px-2 py-1 text-center text-xs font-medium ${
                          page === currentPage
                            ? "bg-emerald-500 text-white"
                            : "border border-slate-300 text-slate-700 hover:border-emerald-400 hover:text-emerald-700"
                        }`}
                      >
                        {page}
                      </Link>
                    ));
                  })()}

                  <Link
                    href={createPageLink(Math.min(totalPages, currentPage + 1))}
                    aria-disabled={currentPage === totalPages}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      currentPage === totalPages
                        ? "cursor-not-allowed border border-slate-200 text-slate-400"
                        : "border border-slate-300 text-slate-700 hover:border-emerald-400 hover:text-emerald-700"
                    }`}
                  >
                    ถัดไป
                  </Link>
                </div>
              </nav>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

