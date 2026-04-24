import Link from "next/link";
import { getLandingStats } from "@/lib/egpLandingStats";
import ProjectsAddedByAgencyModal from "./ProjectsAddedByAgencyModal";

/** ดึงสถิติจาก DB ทุกครั้งที่โหลดหน้า — ไม่แคชแบบ static หลัง build */
export const dynamic = "force-dynamic";

// function isRssWindowOpenInBangkok(date: Date): boolean {
//   const utcHour = date.getUTCHours();
//   const utcMinute = date.getUTCMinutes();

//   const bangkokHour = (utcHour + 7) % 24;
//   const bangkokMinute = utcMinute;

//   const afterOpen =
//     bangkokHour > 17 || (bangkokHour === 17 && bangkokMinute >= 1);
//   const beforeClose =
//     bangkokHour < 8 || (bangkokHour === 8 && bangkokMinute <= 29);

//   return afterOpen || beforeClose;
// }

function formatStat(value: number): string {
  return value.toLocaleString("th-TH");
}

function formatBaht(value: number): string {
  return value.toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatThaiDateTime(date: Date): string {
  return date.toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatThaiMonthYear(date: Date): string {
  return date.toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    month: "long",
    year: "numeric",
  });
}

function parseMonthParam(
  value: string | string[] | undefined,
  fallback: Date,
): Date {
  if (typeof value !== "string") {
    return fallback;
  }

  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return fallback;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    month < 1 ||
    month > 12
  ) {
    return fallback;
  }

  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
}

function toMonthParam(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ month?: string | string[] }>;
}) {
  const now = new Date();
  const resolvedSearchParams = await searchParams;
  const selectedMonth = parseMonthParam(resolvedSearchParams?.month, now);
  const prevMonth = new Date(
    Date.UTC(
      selectedMonth.getUTCFullYear(),
      selectedMonth.getUTCMonth() - 1,
      1,
      0,
      0,
      0,
      0,
    ),
  );
  const nextMonth = new Date(
    Date.UTC(
      selectedMonth.getUTCFullYear(),
      selectedMonth.getUTCMonth() + 1,
      1,
      0,
      0,
      0,
      0,
    ),
  );
  const stats = await getLandingStats({ calendarMonth: selectedMonth });
  const calendarByDate = new Map(
    stats.procurementCalendar.map((item) => [
      item.date.toISOString().slice(0, 10),
      item,
    ]),
  );

  const monthStart = new Date(
    Date.UTC(
      selectedMonth.getUTCFullYear(),
      selectedMonth.getUTCMonth(),
      1,
      0,
      0,
      0,
      0,
    ),
  );
  const monthEnd = new Date(
    Date.UTC(
      selectedMonth.getUTCFullYear(),
      selectedMonth.getUTCMonth() + 1,
      0,
      0,
      0,
      0,
      0,
    ),
  );
  const monthStartWeekday = monthStart.getUTCDay();
  const monthCalendarEntries = stats.procurementCalendar.reduce(
    (sum, item) => sum + item.totalCount,
    0,
  );
  const dayCells: Array<{
    date: Date | null;
    data: (typeof stats.procurementCalendar)[number] | null;
  }> = [];

  for (let i = 0; i < monthStartWeekday; i += 1) {
    dayCells.push({ date: null, data: null });
  }

  for (let day = 1; day <= monthEnd.getUTCDate(); day += 1) {
    const date = new Date(
      Date.UTC(
        selectedMonth.getUTCFullYear(),
        selectedMonth.getUTCMonth(),
        day,
        0,
        0,
        0,
        0,
      ),
    );
    const key = date.toISOString().slice(0, 10);
    dayCells.push({
      date,
      data: calendarByDate.get(key) ?? null,
    });
  }

  const projectsAddedYesterday = stats.projectsAddedYesterdayCount;
  const projectsAddedYesterdayText =
    projectsAddedYesterday > 0
      ? `เพิ่มขึ้น ${formatStat(projectsAddedYesterday)} จากเมื่อวาน`
      : "ไม่มีโครงการเพิ่มจากเมื่อวาน";
  const lastUpdatedText = stats.lastUpdatedAt
    ? `${formatThaiDateTime(stats.lastUpdatedAt)} น.`
    : "-";

  return (
    <div className="relative min-h-screen overflow-hidden bg-linear-to-b from-slate-50 via-white to-slate-100 text-slate-900">
      {/* soft radial highlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_55%),radial-gradient(circle_at_bottom,rgba(45,212,191,0.12),transparent_55%)] opacity-90"
      />

      <main className="relative mx-auto flex max-w-7xl flex-col gap-10 px-6 pb-8 pt-10 md:gap-12 md:px-10 md:pb-10 md:pt-14 lg:flex-row">
        {/* Hero */}
        <section className="flex-1.1 space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm backdrop-blur">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/90 text-[10px] font-bold text-white">
              e
            </span>
            <span className="text-emerald-600">ระบบจัดซื้อจัดจ้าง</span>
            <span className="h-1 w-1 rounded-full bg-slate-500" />
            <span className="text-slate-500">
              โปร่งใส ตรวจสอบได้ เพื่อประชาชนและบุคลากร
            </span>
          </div>

          <div className="space-y-6">
            <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
              ศูนย์กลางโครงการจัดซื้อจัดจ้าง
            </h1>
            <p className="max-w-xl text-pretty text-sm leading-relaxed text-slate-600 sm:text-base">
              แสดงข้อมูลโครงการจัดซื้อจัดจ้างจากระบบ e-GP ในที่เดียว
              ค้นหาและตรวจสอบย้อนหลังได้สะดวก ช่วยให้การจัดหาพัสดุ เวชภัณฑ์
              และครุภัณฑ์ทางการแพทย์เป็นไปอย่างโปร่งใส และตรวจสอบได้
            </p>
          </div>

          <div className="grid max-w-2xl grid-cols-1 gap-2 text-xs text-slate-700 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 shadow-sm backdrop-blur">
              <p className="text-[11px] text-slate-500">โครงการทั้งหมด</p>
              <p className="text-base font-semibold text-slate-900">
                {formatStat(stats.totalProjectsCount)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 shadow-sm backdrop-blur">
              <p className="text-[11px] text-slate-500">แจ้งเตือน 3 วัน</p>
              <p className="text-base font-semibold text-amber-600">
                {formatStat(stats.alertsCount)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 shadow-sm backdrop-blur">
              <p className="text-[11px] text-slate-500">อัปเดตล่าสุด</p>
              <p className="text-sm font-semibold text-slate-900">{lastUpdatedText}</p>
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link
              href="/egp/announcements"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-linear-to-r from-cyan-500 via-emerald-500 to-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_-18px_rgba(34,197,94,0.65)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_60px_-22px_rgba(34,197,94,0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 md:text-base"
            >
              ดูโครงการจัดซื้อจัดจ้าง
              <span aria-hidden className="text-base">
                ↗
              </span>
            </Link>

            <Link
              href="/api-description"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white/80 px-5 py-3 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 sm:text-sm"
            >
              API description
            </Link>

            <Link
              href="#procurement-calendar"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white/80 px-5 py-3 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 sm:text-sm"
            >
              ดูปฏิทินจัดซื้อจัดจ้าง
            </Link>
          </div>
        </section>

        {/* Right column: quick overview cards */}
        <section className="flex-1 space-y-4 lg:max-w-xl">
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-[0_24px_65px_-32px_rgba(15,23,42,0.35)] backdrop-blur">
            <header className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-600">แดชบอร์ดสรุปข้อมูล</p>
                <p className="text-xs text-slate-500">ภาพรวมล่าสุดแบบอ่านเร็ว</p>
              </div>
            </header>

            <div className="mb-3 grid grid-cols-1 gap-2 text-[11px] text-slate-600 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                รายการในปฏิทินเดือนนี้:{" "}
                <span className="font-semibold text-slate-900">
                  {formatStat(monthCalendarEntries)}
                </span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                รายการล่าสุด:{" "}
                <span className="font-semibold text-slate-900">
                  {lastUpdatedText}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 sm:text-sm">
              <div className="space-y-1 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
                  จำนวนโครงการทั้งหมด
                </p>
                <p className="text-lg font-semibold text-slate-900 sm:text-xl">
                  {formatStat(stats.totalProjectsCount)}
                </p>
                <p
                  className={`text-[11px] ${
                    projectsAddedYesterday > 0 ? "text-emerald-600" : "text-slate-600"
                  }`}
                >
                  {projectsAddedYesterdayText}
                </p>
                <ProjectsAddedByAgencyModal
                  items={stats.projectsAddedYesterdayByAgency}
                />
              </div>
              <div className="space-y-1 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
                  ประหยัดได้เท่าไหร่
                </p>
                <p className="text-lg font-semibold text-slate-900 sm:text-xl">
                  {formatBaht(stats.savingsBahtTotal)}
                </p>
                <p className="text-[11px] text-emerald-600">
                  ประมาณการจากราคากลาง vs ราคาผู้ชนะ
                </p>
              </div>
              <div className="space-y-1 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
                  สัญญาที่กำลังดำเนินงาน
                </p>
                <p className="text-lg font-semibold text-slate-900 sm:text-xl">
                  {formatStat(stats.activeContractsCount)}
                </p>
                <p className="text-[11px] text-slate-500">
                  โครงการที่ประกาศผู้ชนะการเสนอราคา
                </p>
              </div>
              <div className="space-y-1 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
                  แจ้งเตือนใกล้ถึงวันเสนอราคา
                </p>
                <p className="text-lg font-semibold text-amber-500 sm:text-xl">
                  {formatStat(stats.alertsCount)}
                </p>
                <p className="text-[11px] text-amber-600">
                  โครงการที่ bidDate อยู่ใน 3 วันถัดไป
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <section
        id="procurement-calendar"
        className="relative mx-auto mt-2 mb-16 w-full max-w-7xl scroll-mt-24 px-6 md:mt-3 md:px-10"
      >
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 text-xs text-slate-700 shadow-[0_24px_65px_-32px_rgba(15,23,42,0.35)] backdrop-blur">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-800 md:text-xl">
              ปฏิทินจัดซื้อจัดจ้าง
            </h2>
            <Link
              href="/"
              className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              กลับเดือนปัจจุบัน
            </Link>
          </div>

          <div className="mb-2 flex justify-center text-[11px] text-slate-500">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-2 py-1 shadow-sm">
              <Link
                href={`/?month=${toMonthParam(prevMonth)}`}
                aria-label="เดือนก่อนหน้า"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-base font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
              >
                &#x2039;
              </Link>
              <span className="min-w-36 text-center text-[11px] font-medium text-slate-700">
                {formatThaiMonthYear(selectedMonth)}
              </span>
              <Link
                href={`/?month=${toMonthParam(nextMonth)}`}
                aria-label="เดือนถัดไป"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-base font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
              >
                &#x203A;
              </Link>
            </div>
          </div>
          <div className="mb-2 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-700">
              แผนการจัดซื้อ
            </span>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-700">
              ร่างประชาพิจารณ์ TOR
            </span>
            <span className="rounded-full bg-sky-100 px-2.5 py-1 font-medium text-sky-700">
              ประกาศเชิญชวน
            </span>
          </div>
          <div className="overflow-x-auto pb-1">
            <div className="min-w-[680px]">
              <div className="grid grid-cols-7 gap-1 text-[11px]">
                {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((day) => (
                  <div
                    key={day}
                    className="rounded-md bg-slate-100 px-1 py-1 text-center font-medium text-slate-600"
                  >
                    {day}
                  </div>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {dayCells.map((cell, index) => {
                  if (!cell.date) {
                    return (
                      <div
                        key={`empty-${index}`}
                        className="aspect-square rounded-md border border-transparent bg-slate-50/40"
                      />
                    );
                  }

                  const isToday =
                    cell.date.toISOString().slice(0, 10) ===
                    now.toISOString().slice(0, 10);

                  return (
                    <div
                      key={cell.date.toISOString()}
                      className={`min-h-[104px] rounded-md border p-1.5 sm:min-h-[112px] ${
                        isToday
                          ? "border-emerald-300 bg-emerald-50"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <p className="text-xs font-semibold leading-none text-slate-700">
                        {cell.date.getUTCDate()}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(cell.data?.planCount ?? 0) > 0 ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium leading-none text-emerald-700">
                            แผนการจัดซื้อ (
                            {formatStat(cell.data?.planCount ?? 0)})
                          </span>
                        ) : null}
                        {(cell.data?.torDraftCount ?? 0) > 0 ? (
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium leading-none text-amber-700">
                            ร่างประชาพิจารณ์ TOR (
                            {formatStat(cell.data?.torDraftCount ?? 0)})
                          </span>
                        ) : null}
                        {(cell.data?.invitationCount ?? 0) > 0 ? (
                          <span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-medium leading-none text-sky-700">
                            ประกาศเชิญชวน (
                            {formatStat(cell.data?.invitationCount ?? 0)})
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {stats.procurementCalendar.length === 0 ? (
            <p className="mt-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
              ไม่พบข้อมูลย้อนหลังที่เข้ากลุ่มแผนการจัดซื้อ, ร่าง TOR
              หรือประกาศเชิญชวน
            </p>
          ) : null}
          <div className="mt-3 flex flex-col gap-1 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>
              *
              ร่างประชาพิจารณ์และประกาศเชิญชวนอัพเดทข้อมูลตามรอบดึงข้อมูลจากกรมบัญชีกลาง
            </p>
            <p>
              ข้อมูลปรับปรุง ณ {lastUpdatedText}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
