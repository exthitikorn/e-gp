import { XMLParser } from "fast-xml-parser";

type AnnouncementItem = {
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
};

type EgpRssResponse = {
  rss?: {
    channel?: {
      title?: string;
      description?: string;
      item?: AnnouncementItem | AnnouncementItem[];
    };
  };
};

const EGP_RSS_BASE_URL =
  "http://process3.gprocurement.go.th/EPROCRssFeedWeb/egpannouncerss.xml";

const DEFAULT_DEPT_ID = "0304"; // TODO: เปลี่ยนเป็น deptId ของหน่วยงานที่อยู่ในกรุงเทพฯ ตามที่คุณต้องการ

async function fetchAnnouncements(
  deptId: string = DEFAULT_DEPT_ID,
): Promise<AnnouncementItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const url = `${EGP_RSS_BASE_URL}?deptId=${encodeURIComponent(deptId)}`;

    const res = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error(
        "ไม่สามารถดึงข้อมูล RSS จาก e-GP ได้",
        res.status,
        res.statusText,
      );
      return [];
    }

    const xml = await res.text();

    const parser = new XMLParser({
      ignoreAttributes: false,
      trimValues: true,
    });

    const parsed = parser.parse(xml) as EgpRssResponse;
    const items = parsed.rss?.channel?.item;

    if (!items) {
      return [];
    }

    return Array.isArray(items) ? items : [items];
  } catch (error) {
    console.error("ดึง RSS จาก e-GP ไม่สำเร็จ:", error);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export default async function AnnouncementsPage() {
  // หมายเหตุ: ตอนนี้ผูกไว้กับ deptId เดียว (DEFAULT_DEPT_ID)
  // ถ้าต้องการเลือกหลายหน่วยงานหรือเลือกจังหวัดกรุงเทพแบบ dynamic
  // สามารถต่อยอดให้รับค่า query / config ภายหลังได้
  const announcements = await fetchAnnouncements();

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50 md:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            ประกาศจัดซื้อจัดจ้างจากระบบ e-GP
          </h1>
          <p className="text-sm text-slate-300 sm:text-base">
            แสดงข้อมูลประกาศจากหน่วยงานภาครัฐในกรุงเทพฯ ผ่าน RSS ของระบบ e-GP
            (ข้อมูลล่าสุดสูงสุด 20 รายการ ตามข้อกำหนดของกรมบัญชีกลาง)
          </p>
          <p className="text-xs text-slate-400">
            * ขณะนี้ตั้งค่าเป็นตัวอย่าง deptId = {DEFAULT_DEPT_ID}{" "}
            (โปรดเปลี่ยนเป็นรหัสหน่วยงานจริงของคุณ)
          </p>
        </header>

        {announcements.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-6 text-sm text-slate-300">
            ยังไม่มีข้อมูลประกาศที่สามารถดึงได้ในขณะนี้ หรือไม่สามารถเชื่อมต่อ
            RSS ของ e-GP ได้
          </div>
        ) : (
          <ul className="space-y-4">
            {announcements.map((item, index) => (
              <li
                key={`${item.link ?? item.title}-${index}`}
                className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-4 shadow-sm transition hover:border-emerald-400/60 hover:bg-slate-900"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-sm font-semibold text-slate-50 sm:text-base">
                      {item.title}
                    </h2>
                    {item.pubDate && (
                      <span className="whitespace-nowrap rounded-full bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-200">
                        {item.pubDate}
                      </span>
                    )}
                  </div>

                  {item.description && (
                    <p className="text-xs leading-relaxed text-slate-300 sm:text-sm">
                      {item.description}
                    </p>
                  )}

                  {item.link && (
                    <div className="mt-2">
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-300 hover:text-emerald-200"
                      >
                        เปิดดูรายละเอียดในระบบ e-GP
                        <span aria-hidden>↗</span>
                      </a>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

