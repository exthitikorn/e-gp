import Link from "next/link";
import { getLandingStats } from "@/lib/egpLandingStats";

function isRssWindowOpenInBangkok(date: Date): boolean {
  const utcHour = date.getUTCHours();
  const utcMinute = date.getUTCMinutes();

  const bangkokHour = (utcHour + 7) % 24;
  const bangkokMinute = utcMinute;

  const afterOpen =
    bangkokHour > 17 || (bangkokHour === 17 && bangkokMinute >= 1);
  const beforeClose =
    bangkokHour < 8 || (bangkokHour === 8 && bangkokMinute <= 29);

  return afterOpen || beforeClose;
}

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

export default async function Home() {
  const now = new Date();
  const isRssOpen = isRssWindowOpenInBangkok(now);
  const stats = await getLandingStats();

  return (
    <div className="relative min-h-screen overflow-hidden bg-linear-to-b from-slate-50 via-white to-slate-100 text-slate-900">
      {/* soft radial highlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_55%),radial-gradient(circle_at_bottom,rgba(45,212,191,0.12),transparent_55%)] opacity-90"
      />

      <main className="relative mx-auto flex min-h-screen max-w-7xl flex-col gap-14 px-6 pb-16 pt-10 md:gap-20 md:px-10 md:pb-24 md:pt-14 lg:flex-row lg:items-center">
        {/* Hero */}
        <section className="flex-1.1 space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm backdrop-blur">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/90 text-[10px] font-bold text-slate-950">
              e
            </span>
            <span className="text-emerald-600">
              ระบบจัดซื้อจัดจ้าง โรงพยาบาลราชพิพัฒน์
            </span>
            <span className="h-1 w-1 rounded-full bg-slate-500" />
            <span className="text-slate-500">
              โปร่งใส ตรวจสอบได้ เพื่อประชาชนและบุคลากร
            </span>
          </div>

          <div className="space-y-6">
            <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
              ศูนย์กลางโครงการจัดซื้อจัดจ้าง
              <span className="block bg-linear-to-r from-cyan-500 via-emerald-500 to-sky-500 bg-clip-text text-transparent">
                โรงพยาบาลราชพิพัฒน์
              </span>
            </h1>
            <p className="max-w-xl text-pretty text-sm leading-relaxed text-slate-600 sm:text-base">
              แสดงข้อมูลโครงการจัดซื้อจัดจ้างจากระบบ e-GP ของโรงพยาบาลราชพิพัฒน์
              ในที่เดียว ค้นหาและตรวจสอบย้อนหลังได้สะดวก ช่วยให้การจัดหาพัสดุ
              เวชภัณฑ์ และครุภัณฑ์ทางการแพทย์เป็นไปอย่างโปร่งใส และตรวจสอบได้
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link
              href="/egp/announcements"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-linear-to-r from-cyan-500 via-emerald-500 to-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_-18px_rgba(34,197,94,0.65)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_60px_-22px_rgba(34,197,94,0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 md:text-base"
            >
              ดูโครงการจัดซื้อจัดจ้างของโรงพยาบาล
              <span aria-hidden className="text-base">
                ↗
              </span>
            </Link>

            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white/80 px-5 py-3 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 sm:text-sm"
            >
              คู่มือการใช้งานสำหรับหน่วยงานโรงพยาบาล
            </button>
          </div>

          {/* <dl className="grid grid-cols-2 gap-4 pt-4 text-xs text-slate-300 sm:grid-cols-3 sm:text-sm">
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 px-4 py-3 shadow-sm">
              <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                หน่วยงานภายในที่ใช้งาน
              </dt>
              <dd className="mt-1 text-lg font-semibold text-slate-50 sm:text-xl">
                10+
              </dd>
            </div>
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 px-4 py-3 shadow-sm">
              <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                โครงการจัดซื้อ/ปี
              </dt>
              <dd className="mt-1 text-lg font-semibold text-sky-300 sm:text-xl">
                500+
              </dd>
            </div>
            <div className="col-span-2 rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-500/10 via-teal-400/5 to-cyan-400/10 px-4 py-3 shadow-[0_18px_45px_-18px_rgba(34,197,94,0.55)] sm:col-span-1">
              <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-200/90">
                รองรับมาตรฐาน พ.ร.บ. จัดซื้อจัดจ้างภาครัฐ
              </dt>
              <dd className="mt-1 text-sm font-semibold text-emerald-100 sm:text-base">
                โปร่งใส ตรวจสอบย้อนหลังได้ทุกรายการของโรงพยาบาล
              </dd>
            </div>
          </dl> */}
        </section>

        {/* Right column: quick overview cards */}
        <section className="flex-1 space-y-4 lg:max-w-xl">
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-[0_24px_65px_-32px_rgba(15,23,42,0.35)] backdrop-blur">
            <header className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                  ภาพรวมวันนี้
                </p>
                <p className="text-sm text-slate-600">
                  แดชบอร์ดสรุปข้อมูล
                </p>
              </div>
              <div className="text-right text-[11px] leading-snug text-slate-600">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium ring-1 ${
                    isRssOpen
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                      : "bg-amber-50 text-amber-700 ring-amber-200"
                  }`}
                >
                  {isRssOpen ? "สถานะ RSS: เปิดเชื่อมต่อ" : "สถานะ RSS: ปิดชั่วคราว"}
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isRssOpen ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                </span>
                <p className="mt-1">
                  ระบบ e-GP เปิดให้เชื่อมต่อ RSS ระหว่างเวลา 17.01 – 08.29 น.
                </p>
              </div>
            </header>

            <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
              <div className="space-y-1 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
                  จำนวนโครงการทั้งหมด
                </p>
                <p className="text-lg font-semibold text-slate-900 sm:text-xl">
                  {formatStat(stats.totalProjectsCount)}
                </p>
                <p className="text-[11px] text-slate-600">
                  รวมทุกโครงการในระบบ
                </p>
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

            <p className="mt-3 text-center text-[11px] text-slate-500">
              ในระบบ: โครงการ {formatStat(stats.totalProjectsCount)} รายการ •
              ประกาศ {formatStat(stats.totalAnnouncementsCount)} รายการ
            </p>
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              <div>
                <p className="font-medium text-slate-900">
                  มองหาประกาศของโรงพยาบาลราชพิพัฒน์อยู่หรือไม่?
                </p>
                <p className="text-[11px] text-slate-500">
                  เข้าระบบเพื่อดูรายละเอียดประกาศจัดซื้อจัดจ้างและสัญญาทั้งหมด
                </p>
              </div>
              <Link
                href="/egp/announcements"
                className="hidden rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-slate-50 shadow-sm transition hover:bg-black/80 md:inline-flex"
              >
                ไปยังหน้าประกาศ
              </Link>
            </div>
          </div>

          <div className="grid gap-3 text-xs text-slate-600 sm:grid-cols-2 sm:text-sm">
            <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                สำหรับหน่วยงานภายในโรงพยาบาล
              </p>
              <p className="text-slate-700">
                วางแผนจัดซื้อทั้งปี อนุมัติเอกสาร และติดตามสถานะโครงการของแต่ละหน่วยงานได้ในที่เดียว
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                สำหรับผู้ประกอบการ/คู่ค้า
              </p>
              <p className="text-slate-700">
                ค้นหาประกาศล่าสุดของโรงพยาบาลราชพิพัฒน์ และติดตามโอกาสในการยื่นข้อเสนอผ่านระบบ e-GP
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
