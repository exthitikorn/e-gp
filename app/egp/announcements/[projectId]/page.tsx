export const dynamic = "force-dynamic";

import Link from "next/link";
// import { PdfParseButton } from "../PdfParseButton";

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

interface ProjectDetailPageProps {
  params: Promise<{
    projectId: string;
  }>;
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
}: ProjectDetailPageProps) {
  const resolvedParams = await params;
  const projectId = resolvedParams.projectId;

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
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 md:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="space-y-2">
          <div className="text-xs text-slate-500">
            <Link
              href="/egp/announcements"
              className="text-emerald-700 hover:text-emerald-800"
            >
              ← กลับไปหน้ารายการโครงการ
            </Link>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            {data.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
            {data.projectNumber && (
              <span>
                <span className="font-medium text-slate-800">
                  เลขที่โครงการ:
                </span>{" "}
                {data.projectNumber}
              </span>
            )}
            {data.methodId && (
              <span>
                <span className="font-medium text-slate-800">
                  วิธีการจัดหา:
                </span>{" "}
                {data.methodId}
              </span>
            )}
            {data.status && (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${getStatusBadgeClass(
                  data.status,
                )}`}
              >
                สถานะโครงการ: {data.status}
              </span>
            )}
            {data.bidDate && (
              <span>
                <span className="font-medium text-slate-800">
                  วันที่เสนอราคา:
                </span>{" "}
                {new Date(data.bidDate).toLocaleDateString("th-TH")}
              </span>
            )}
            {data.winnerName && (
              <span>
                <span className="font-medium text-slate-800">
                  ผู้ที่ได้รับการคัดเลือก:
                </span>{" "}
                {data.winnerName}
              </span>
            )}
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 text-xs text-slate-700 shadow-sm sm:p-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            ข้อมูลโครงการ
          </h2>
          <div className="grid gap-y-2 text-[11px] sm:grid-cols-2 sm:gap-x-6">
            <div className="flex">
              <div className="w-32 shrink-0 font-medium text-slate-800">
                เลขที่โครงการ
              </div>
              <div className="flex-1">
                {data.projectNumber ?? <span className="text-slate-400">-</span>}
              </div>
            </div>
            <div className="flex">
              <div className="w-32 shrink-0 font-medium text-slate-800">
                วิธีการจัดหา
              </div>
              <div className="flex-1">
                {data.methodId ?? <span className="text-slate-400">-</span>}
              </div>
            </div>
            <div className="flex">
              <div className="w-32 shrink-0 font-medium text-slate-800">
                วันที่เสนอราคา
              </div>
              <div className="flex-1">
                {data.bidDate ? (
                  new Date(data.bidDate).toLocaleDateString("th-TH")
                ) : (
                  <span className="text-slate-400">-</span>
                )}
              </div>
            </div>
            <div className="flex">
              <div className="w-32 shrink-0 font-medium text-slate-800">
                ผู้ที่ได้รับการคัดเลือก
              </div>
              <div className="flex-1">
                {data.winnerName ?? <span className="text-slate-400">-</span>}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-center shadow-sm">
            <div className="text-[11px] font-medium text-slate-600">
              ราคากลาง (centralPriceBaht)
            </div>
            <div className="mt-1 text-base font-semibold text-slate-900">
              {centralPrice !== null ? (
                centralPrice.toLocaleString("th-TH", {
                  style: "currency",
                  currency: "THB",
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              ) : (
                <span className="text-xs font-normal text-slate-400">-</span>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-center shadow-sm">
            <div className="text-[11px] font-medium text-slate-600">
              มูลค่าที่จัดหาได้
            </div>
            <div className="mt-1 text-base font-semibold text-slate-900">
              {winnerAmount !== null ? (
                winnerAmount.toLocaleString("th-TH", {
                  style: "currency",
                  currency: "THB",
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              ) : (
                <span className="text-xs font-normal text-slate-400">-</span>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-center shadow-sm">
            <div className="text-[11px] font-medium text-slate-600">
              ประหยัดได้ (ประมาณการ)
            </div>
            <div className="mt-1 text-base font-semibold text-slate-900">
              {savingAmount !== null ? (
                <>
                  {savingAmount.toLocaleString("th-TH", {
                    style: "currency",
                    currency: "THB",
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
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

        {data.types.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-6 text-sm text-slate-600">
            ยังไม่มีข้อมูลประกาศย่อยของโครงการนี้
          </div>
        ) : (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">
              รายการประกาศตามประเภท (announceType)
            </h2>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
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
                    {/* <th className="px-4 py-2 text-left text-[11px] font-semibold text-slate-900">
                      ดึงข้อมูลจาก PDF
                    </th> */}
                  </tr>
                </thead>
                <tbody>
                  {data.types.map((type) => (
                    <tr
                      key={type.id}
                      className="border-t border-slate-100 hover:bg-slate-50/80"
                    >
                      <td className="px-4 py-2 align-top">
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                          {type.announceType}
                        </span>
                      </td>
                      <td className="px-4 py-2 align-top">
                        {type.publishedAt ? (
                          <span className="text-[11px] text-slate-600">
                            {new Date(type.publishedAt).toLocaleString("th-TH")}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2 align-top">
                        {type.link && /^https?:\/\//i.test(type.link) ? (
                          <a
                            href={type.link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800"
                          >
                            เปิดในระบบ e-GP
                            <span aria-hidden>↗</span>
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            -
                          </span>
                        )}
                      </td>
                      {/* <td className="px-4 py-2 align-top">
                        <PdfParseButton
                          announcementId={type.id}
                          announceType={type.announceType}
                          canParse={Boolean(
                            type.link && /^https?:\/\//i.test(type.link),
                          )}
                        />
                      </td> */}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

