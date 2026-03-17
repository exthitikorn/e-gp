import Link from "next/link";

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

export default function Home() {
  const now = new Date();
  const isRssOpen = isRssWindowOpenInBangkok(now);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-50">
      {/* light radial highlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.25),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(45,212,191,0.13),_transparent_55%)] opacity-80"
      />

      <main className="relative mx-auto flex min-h-screen max-w-6xl flex-col gap-14 px-6 pb-16 pt-10 md:gap-20 md:px-10 md:pb-24 md:pt-14 lg:flex-row lg:items-center">
        {/* Hero */}
        <section className="flex-1 space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/70 px-3 py-1 text-xs font-medium text-slate-200 shadow-[0_0_0_1px_rgba(15,23,42,0.9)] backdrop-blur">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/90 text-[10px] font-bold text-slate-950">
              e
            </span>
            <span className="text-emerald-300">ระบบจัดซื้อจัดจ้างภาครัฐ</span>
            <span className="h-1 w-1 rounded-full bg-slate-500" />
            <span className="text-slate-300">โปร่งใส ตรวจสอบได้ แบบเรียลไทม์</span>
          </div>

          <div className="space-y-6">
            <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-slate-50 sm:text-4xl lg:text-5xl">
              ศูนย์กลางการจัดซื้อจัดจ้าง
              <span className="block bg-gradient-to-r from-cyan-300 via-emerald-300 to-sky-400 bg-clip-text text-transparent">
                e-GP ภาครัฐรูปแบบใหม่
              </span>
            </h1>
            <p className="max-w-xl text-pretty text-sm leading-relaxed text-slate-300 sm:text-base">
              รวมกระบวนการจัดซื้อจัดจ้างทั้งหมดไว้ในที่เดียว ตั้งแต่ประกาศจัดซื้อ
              ยื่นข้อเสนอ อนุมัติสัญญา ไปจนถึงการติดตามสถานะ ลดขั้นตอนซ้ำซ้อน
              เพิ่มความโปร่งใส และอำนวยความสะดวกให้ทั้งหน่วยงานรัฐและผู้ประกอบการ
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link
              href="/egp/announcements"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-sky-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_45px_-18px_rgba(34,211,238,0.75)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_60px_-22px_rgba(45,212,191,0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 md:text-base"
            >
              เข้าใช้งานระบบ e-GP
              <span aria-hidden className="text-base">
                ↗
              </span>
            </Link>

            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full border border-slate-600/80 bg-slate-900/40 px-5 py-3 text-xs font-medium text-slate-200 shadow-sm transition hover:border-slate-400/80 hover:bg-slate-900/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:text-sm"
            >
              คู่มือการใช้งานสำหรับหน่วยงานรัฐ
            </button>
          </div>

          <dl className="grid grid-cols-2 gap-4 pt-4 text-xs text-slate-300 sm:grid-cols-3 sm:text-sm">
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 px-4 py-3 shadow-sm">
              <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                หน่วยงานที่ใช้งาน
              </dt>
              <dd className="mt-1 text-lg font-semibold text-slate-50 sm:text-xl">
                1,240+
              </dd>
            </div>
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 px-4 py-3 shadow-sm">
              <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                ปริมาณจัดซื้อ/ปี
              </dt>
              <dd className="mt-1 text-lg font-semibold text-sky-300 sm:text-xl">
                86,000+
              </dd>
            </div>
            <div className="col-span-2 rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-500/10 via-teal-400/5 to-cyan-400/10 px-4 py-3 shadow-[0_18px_45px_-18px_rgba(34,197,94,0.55)] sm:col-span-1">
              <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-200/90">
                รองรับมาตรฐาน พ.ร.บ. จัดซื้อจัดจ้าง
              </dt>
              <dd className="mt-1 text-sm font-semibold text-emerald-100 sm:text-base">
                โปร่งใส ตรวจสอบย้อนหลังได้ทุกรายการ
              </dd>
            </div>
          </dl>
        </section>

        {/* Right column: quick overview cards */}
        <section className="flex-1 space-y-4 lg:max-w-md">
          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/70 p-5 shadow-[0_24px_65px_-32px_rgba(15,23,42,1)] backdrop-blur">
            <header className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  ภาพรวมวันนี้
                </p>
                <p className="text-sm text-slate-300">
                  แดชบอร์ดสรุปข้อมูล
                </p>
              </div>
              <div className="text-right text-[11px] leading-snug text-slate-300">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium ring-1 ${
                    isRssOpen
                      ? "bg-emerald-500/10 text-emerald-300 ring-emerald-400/30"
                      : "bg-amber-500/10 text-amber-200 ring-amber-400/30"
                  }`}
                >
                  {isRssOpen ? "สถานะ RSS: เปิดเชื่อมต่อ" : "สถานะ RSS: ปิดชั่วคราว"}
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isRssOpen ? "bg-emerald-300" : "bg-amber-300"
                    }`}
                  />
                </span>
                <p className="mt-1">
                  ระบบ e-GP เปิดให้เชื่อมต่อ RSS ระหว่างเวลา 17.01 – 08.29 น.
                </p>
              </div>
            </header>

            <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
              <div className="space-y-1 rounded-2xl border border-slate-800/80 bg-slate-900/70 px-3.5 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                  ประกาศจัดซื้อใหม่
                </p>
                <p className="text-lg font-semibold text-slate-50 sm:text-xl">
                  -
                </p>
                <p className="text-[11px] text-emerald-300">
                  ข้อมูลจะดึงจากระบบจริง
                </p>
              </div>
              <div className="space-y-1 rounded-2xl border border-slate-800/80 bg-slate-900/70 px-3.5 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                  ใกล้ปิดรับข้อเสนอ
                </p>
                <p className="text-lg font-semibold text-slate-50 sm:text-xl">
                  -
                </p>
                <p className="text-[11px] text-sky-300">
                  ข้อมูลจะดึงจากระบบจริง
                </p>
              </div>
              <div className="space-y-1 rounded-2xl border border-slate-800/80 bg-slate-900/70 px-3.5 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                  สัญญาที่กำลังดำเนินงาน
                </p>
                <p className="text-lg font-semibold text-slate-50 sm:text-xl">
                  -
                </p>
                <p className="text-[11px] text-slate-300">
                  ข้อมูลจะดึงจากระบบจริง
                </p>
              </div>
              <div className="space-y-1 rounded-2xl border border-slate-800/80 bg-slate-900/70 px-3.5 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                  แจ้งเตือน
                </p>
                <p className="text-lg font-semibold text-amber-300 sm:text-xl">
                  -
                </p>
                <p className="text-[11px] text-amber-200">
                  ข้อมูลจะดึงจากระบบจริง
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-800/80 bg-slate-950/60 px-4 py-3 text-xs text-slate-300">
              <div>
                <p className="font-medium text-slate-100">
                  มองหาอะไรอยู่หรือไม่?
                </p>
                <p className="text-[11px] text-slate-400">
                  เข้าระบบเพื่อดูรายละเอียดประกาศและสัญญาทั้งหมด
                </p>
              </div>
              <Link
                href="/egp/announcements"
                className="hidden rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-950 shadow-sm transition hover:bg-white/90 md:inline-flex"
              >
                ไปยังหน้าประกาศ
              </Link>
            </div>
          </div>

          <div className="grid gap-3 text-xs text-slate-300 sm:grid-cols-2 sm:text-sm">
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 px-4 py-3">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">
                สำหรับหน่วยงานรัฐ
              </p>
              <p className="text-slate-100">
                วางแผนจัดซื้อทั้งปี อนุมัติเอกสาร และติดตามสถานะได้ในที่เดียว
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 px-4 py-3">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">
                สำหรับผู้ประกอบการ
              </p>
              <p className="text-slate-100">
                ค้นหาประกาศล่าสุด บันทึกโอกาส และยื่นข้อเสนอผ่านระบบออนไลน์
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
