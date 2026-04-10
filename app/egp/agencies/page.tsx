export const dynamic = "force-dynamic";

import Link from "next/link";
import prisma from "@/lib/db";
import AgenciesCrud, { type AgencyRow } from "./AgenciesCrud";

export default async function EgpAgenciesPage() {
  const rows = await prisma.egpAgency.findMany({
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });

  const initialAgencies: AgencyRow[] = rows.map((a) => ({
    id: a.id,
    name: a.name,
    deptId: a.deptId,
    deptsubId: a.deptsubId,
    status: a.status,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }));

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
            จัดการหน่วยงาน (e-GP RSS)
          </h1>
          <p className="text-sm text-slate-600">
            เพิ่ม แก้ไข หรือลบหน่วยงานที่ใช้ดึงข้อมูลประกาศจาก RSS — หน่วยที่สถานะ
            1 จะถูกรวมในการ ingest
          </p>
        </header>

        <AgenciesCrud initialAgencies={initialAgencies} />
      </div>
    </div>
  );
}
