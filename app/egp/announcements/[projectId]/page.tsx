export const dynamic = "force-dynamic";

import Link from "next/link";
import { PdfParseButton } from "../PdfParseButton";

function formatThaiDate(dateString: string | null): string | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("th-TH");
}

function formatThaiDateTime(dateString: string | null): string | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("th-TH");
}

function formatThaiBaht(amount: number | null): string | null {
  if (amount === null) return null;
  return amount.toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

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

type SearchParams = {
  q?: string;
  page?: string;
  projectNumber?: string;
  methodId?: string;
  status?: string;
};

interface ProjectDetailPageProps {
  params: Promise<{
    projectId: string;
  }>;
  searchParams?: Promise<SearchParams>;
}

interface ProjectDetailResponse {
  id: string;
  projectNumber: string | null;
  title: string;
  methodId: string | null;
  centralPriceBaht: string | null;
  winnerName: string | null;
  winnerAmountBaht: string | null;
  bidDate: string | null;
  status: string | null;
  agency: {
    id: string;
    name: string;
    deptId: string | null;
    deptsubId: string | null;
  };
  types: {
    id: string;
    announceType: string;
    rawDescription: string;
    link: string;
    publishedAt: string | null;
  }[];
}

async function fetchProjectDetail(
  projectId: string,
): Promise<ProjectDetailResponse> {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  const res = await fetch(
    `${baseUrl}/api/egp/announcements/project/${encodeURIComponent(projectId)}`,
    {
      cache: "no-store",
    },
  );

  if (!res.ok) {
    throw new Error("ไม่สามารถดึงรายละเอียดโครงการได้");
  }

  return res.json();
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: ProjectDetailPageProps) {
  const resolvedParams = await params;
  const projectId = resolvedParams.projectId;

  const resolvedSearchParams = (await searchParams) ?? {};
  const backParams = new URLSearchParams();

  if (resolvedSearchParams.q) {
    backParams.set("q", resolvedSearchParams.q);
  }
  if (resolvedSearchParams.projectNumber) {
    backParams.set("projectNumber", resolvedSearchParams.projectNumber);
  }
  if (resolvedSearchParams.methodId) {
    backParams.set("methodId", resolvedSearchParams.methodId);
  }
  if (resolvedSearchParams.status) {
    backParams.set("status", resolvedSearchParams.status);
  }
  if (resolvedSearchParams.page) {
    backParams.set("page", resolvedSearchParams.page);
  }

  const backHref = backParams.toString()
    ? `/egp/announcements?${backParams.toString()}`
    : "/egp/announcements";

  const data = await fetchProjectDetail(projectId);

  const centralPrice =
    data.centralPriceBaht !== null ? Number(data.centralPriceBaht) : null;
  const winnerAmount =
    data.winnerAmountBaht !== null ? Number(data.winnerAmountBaht) : null;

  const savingAmount =
    centralPrice !== null && winnerAmount !== null
      ? centralPrice - winnerAmount
      : null;

  const savingPercent =
    centralPrice !== null && winnerAmount !== null && centralPrice !== 0
      ? (savingAmount! / centralPrice) * 100
      : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Link
        href={backHref}
        className="fixed bottom-5 left-1/2 z-40 inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-xs font-medium text-slate-700 shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:border-emerald-300 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 sm:bottom-6"
      >
        <span aria-hidden>←</span>
        กลับไปหน้ารายการ
      </Link>

      <div className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-5 md:px-8">
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 sm:text-xs">
              {data.projectNumber ? (
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium">
                  เลขที่โครงการ: {data.projectNumber}
                </span>
              ) : null}
              {data.status ? (
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 font-medium ${getStatusBadgeClass(
                    data.status,
                  )}`}
                >
                  {data.status}
                </span>
              ) : null}
            </div>
            <h1 className="text-balance text-xl font-semibold leading-snug tracking-tight text-slate-900 sm:text-2xl">
              {data.title}
            </h1>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
        <section
          id="summary"
          className="mb-6 grid gap-3 sm:grid-cols-3"
          aria-label="สรุปโครงการ"
        >
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-emerald-200">
            <div className="text-[11px] font-medium text-slate-600">
              ราคากลาง
            </div>
            <div className="mt-1 text-base font-semibold text-slate-900">
              {formatThaiBaht(centralPrice) ?? (
                <span className="text-xs font-normal text-slate-400">-</span>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-emerald-200">
            <div className="text-[11px] font-medium text-slate-600">
              วงเงินผู้ชนะ/วงเงินจัดหาได้
            </div>
            <div className="mt-1 text-base font-semibold text-slate-900">
              {formatThaiBaht(winnerAmount) ?? (
                <span className="text-xs font-normal text-slate-400">-</span>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 px-4 py-3 shadow-sm">
            <div className="text-[11px] font-medium text-slate-600">
              ประหยัดได้ (ประมาณการ)
            </div>
            <div className="mt-1 text-base font-semibold text-slate-900">
              {formatThaiBaht(savingAmount) ? (
                <>
                  {formatThaiBaht(savingAmount)}
                  {savingPercent !== null && (
                    <span className="ml-1 text-xs font-medium text-emerald-700">
                      ({savingPercent.toFixed(2)}%)
                    </span>
                  )}
                </>
              ) : (
                <span className="text-xs font-normal text-slate-400">-</span>
              )}
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">
              รายละเอียดโครงการ
            </h2>
            <p className="text-[11px] text-slate-500">
              แหล่งข้อมูล: ฐานข้อมูลที่ดึงจาก RSS e-GP
            </p>
          </div>

          <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2 sm:gap-3">
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <dt className="text-[11px] font-medium text-slate-600">
                หน่วยงาน
              </dt>
              <dd className="mt-0.5 min-w-0 text-slate-900">
                {data.agency.name}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <dt className="text-[11px] font-medium text-slate-600">
                เลขที่โครงการ
              </dt>
              <dd className="mt-0.5 min-w-0 text-slate-900">
                {data.projectNumber ?? (
                  <span className="text-slate-400">-</span>
                )}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <dt className="text-[11px] font-medium text-slate-600">
                วิธีการจัดหา
              </dt>
              <dd className="mt-0.5 min-w-0 text-slate-900">
                {data.methodId ?? <span className="text-slate-400">-</span>}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <dt className="text-[11px] font-medium text-slate-600">
                วันที่เสนอราคา
              </dt>
              <dd className="mt-0.5 min-w-0 text-slate-900">
                {formatThaiDate(data.bidDate) ?? (
                  <span className="text-slate-400">-</span>
                )}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <dt className="text-[11px] font-medium text-slate-600">
                ผู้ได้รับการคัดเลือก
              </dt>
              <dd className="mt-0.5 min-w-0 text-slate-900">
                {data.winnerName ?? <span className="text-slate-400">-</span>}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <dt className="text-[11px] font-medium text-slate-600">
                สถานะ
              </dt>
              <dd className="mt-1 min-w-0 text-slate-900">
                {data.status ? (
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${getStatusBadgeClass(
                      data.status,
                    )}`}
                  >
                    {data.status}
                  </span>
                ) : (
                  <span className="text-slate-400">-</span>
                )}
              </dd>
            </div>
          </dl>
        </section>

        {data.types.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600 shadow-sm">
            ยังไม่มีข้อมูลประกาศย่อยของโครงการนี้
          </div>
        ) : (
          <section id="documents" className="space-y-4" aria-label="ประกาศและเอกสาร">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  ประกาศและเอกสารที่เกี่ยวข้อง
                </h2>
                <p className="mt-1 text-[11px] text-slate-500">
                  เปิดลิงก์ไป e-GP หรืออ่าน/บันทึกข้อมูลจากไฟล์ PDF (ถ้ามี)
                </p>
              </div>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
                ทั้งหมด {data.types.length} รายการ
              </span>
            </div>

            <div className="grid gap-3 sm:hidden">
              {data.types.map((type) => {
                const canOpen = Boolean(type.link && /^https?:\/\//i.test(type.link));
                return (
                  <div
                    key={type.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                        {type.announceType}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {formatThaiDateTime(type.publishedAt) ?? "-"}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2">
                      {type.rawDescription ? (
                        <p className="line-clamp-2 text-[11px] text-slate-600">
                          {type.rawDescription}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        {canOpen ? (
                          <a
                            href={type.link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 shadow-sm hover:border-emerald-300 hover:bg-emerald-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                          >
                            เปิดใน e-GP ↗
                          </a>
                        ) : (
                          <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500">
                            ไม่มีลิงก์ e-GP
                          </span>
                        )}
                      </div>
                      <div>
                        <PdfParseButton
                          announcementId={type.id}
                          announceType={type.announceType}
                          canParse={canOpen}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm sm:block">
              <table className="min-w-full border-collapse text-xs text-slate-700">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold text-slate-900">
                      ประเภทประกาศ
                    </th>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold text-slate-900">
                      วันที่เผยแพร่
                    </th>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold text-slate-900">
                      ลิงก์ e-GP
                    </th>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold text-slate-900">
                      อ่าน/บันทึกจากเอกสาร
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.types.map((type) => {
                    const canOpen = Boolean(
                      type.link && /^https?:\/\//i.test(type.link),
                    );
                    return (
                      <tr
                        key={type.id}
                        className="border-t border-slate-100 hover:bg-slate-50/80"
                      >
                        <td className="px-4 py-2 align-top">
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                            {type.announceType}
                          </span>
                        </td>
                        <td className="px-4 py-2 align-top">
                          {formatThaiDateTime(type.publishedAt) ? (
                            <span className="text-[11px] text-slate-600">
                              {formatThaiDateTime(type.publishedAt)}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2 align-top">
                          {canOpen && type.link ? (
                            <a
                              href={type.link}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800"
                            >
                              เปิดใน e-GP
                              <span aria-hidden>↗</span>
                            </a>
                          ) : (
                            <span className="text-[11px] text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2 align-top">
                          <PdfParseButton
                            announcementId={type.id}
                            announceType={type.announceType}
                            canParse={canOpen}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

