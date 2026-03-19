export const dynamic = "force-dynamic";

import Link from "next/link";
import { PdfParseButton } from "../PdfParseButton";

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
  winnerName: string | null;
  winnerAmountBaht: string | null;
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

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 md:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="space-y-2">
          <div className="text-xs text-slate-500">
            <Link
              href="/egp/announcements"
              className="text-emerald-700 hover:text-emerald-800"
            >
              ← กลับไปหน้ารายการประกาศ
            </Link>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            {data.title}
          </h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
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
            {data.winnerName && (
              <span>
                <span className="font-medium text-slate-800">
                  ผู้ที่ได้รับการคัดเลือก:
                </span>{" "}
                {data.winnerName}
              </span>
            )}
            {data.winnerAmountBaht && (
              <span>
                <span className="font-medium text-slate-800">
                  มูลค่าที่จัดหาได้:
                </span>{" "}
                {Number(data.winnerAmountBaht).toLocaleString("th-TH", {
                  style: "currency",
                  currency: "THB",
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            )}
          </div>
        </header>

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
                    <th className="px-4 py-2 text-left text-[11px] font-semibold text-slate-900">
                      ดึงข้อมูลจาก PDF
                    </th>
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
                      <td className="px-4 py-2 align-top">
                        <PdfParseButton
                          announcementId={type.id}
                          announceType={type.announceType}
                          canParse={Boolean(
                            type.link && /^https?:\/\//i.test(type.link),
                          )}
                        />
                      </td>
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

