import prisma from "@/lib/db";

/** จำนวนวันย้อนหลังสำหรับนับ "ประกาศจัดซื้อใหม่" */
const NEW_ANNOUNCEMENT_DAYS = 7;

/** จำนวนวันในอนาคตที่ถือว่า "ใกล้ปิดรับข้อเสนอ" (bidDate อยู่ในช่วงนี้) */
const CLOSING_SOON_DAYS = 14;

/** จำนวนวันในอนาคตที่ถือว่า "แจ้งเตือน" (bidDate ใกล้มาก) */
const ALERT_DAYS = 3;

export interface LandingStats {
  /** ประกาศจัดซื้อใหม่ (publishedAt ใน 7 วันล่าสุด) */
  newAnnouncementsCount: number;
  /** โครงการที่ใกล้ปิดรับข้อเสนอ (bidDate ใน 14 วันถัดไป, ยังไม่ยกเลิก) */
  closingSoonCount: number;
  /** สัญญาที่กำลังดำเนินงาน (มีผู้ชนะและยังไม่ยกเลิก) */
  activeContractsCount: number;
  /** แจ้งเตือน: โครงการที่ bidDate อยู่ใน 3 วันถัดไป */
  alertsCount: number;
  /** จำนวนโครงการทั้งหมด */
  totalProjectsCount: number;
  /** จำนวนประกาศทั้งหมด */
  totalAnnouncementsCount: number;
}

/**
 * ดึงสถิติสำหรับหน้า Landing จาก EgpProject และ EgpAnnouncement
 * ใช้ใน Server Component (app/page.tsx)
 */
export async function getLandingStats(): Promise<LandingStats> {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - NEW_ANNOUNCEMENT_DAYS);
  const closingSoonEnd = new Date(todayStart);
  closingSoonEnd.setUTCDate(closingSoonEnd.getUTCDate() + CLOSING_SOON_DAYS);
  const alertEnd = new Date(todayStart);
  alertEnd.setUTCDate(alertEnd.getUTCDate() + ALERT_DAYS);

  const [
    newAnnouncementsCount,
    closingSoonCount,
    activeContractsCount,
    alertsCount,
    totalProjectsCount,
    totalAnnouncementsCount,
  ] = await Promise.all([
    prisma.egpAnnouncement.count({
      where: {
        publishedAt: {
          gte: sevenDaysAgo,
          lte: now,
        },
      },
    }),
    prisma.egpProject.count({
      where: {
        bidDate: { gte: now, lte: closingSoonEnd },
        cancelDate: null,
      },
    }),
    prisma.egpProject.count({
      where: {
        winnerName: { not: null },
        cancelDate: null,
      },
    }),
    prisma.egpProject.count({
      where: {
        bidDate: { gte: now, lte: alertEnd },
        cancelDate: null,
      },
    }),
    prisma.egpProject.count(),
    prisma.egpAnnouncement.count(),
  ]);

  return {
    newAnnouncementsCount,
    closingSoonCount,
    activeContractsCount,
    alertsCount,
    totalProjectsCount,
    totalAnnouncementsCount,
  };
}
