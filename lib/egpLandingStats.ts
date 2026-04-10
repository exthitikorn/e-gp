import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";

/** จำนวนวันย้อนหลังสำหรับนับ "ประกาศจัดซื้อใหม่" */
const NEW_ANNOUNCEMENT_DAYS = 7;

/** จำนวนวันในอนาคตที่ถือว่า "ใกล้ปิดรับข้อเสนอ" (bidDate อยู่ในช่วงนี้) */
const CLOSING_SOON_DAYS = 14;

/** จำนวนวันในอนาคตที่ถือว่า "แจ้งเตือน" (bidDate ใกล้มาก) */
const ALERT_DAYS = 3;

function decimalToNumber(value: Prisma.Decimal | null): number {
  if (!value) return 0;
  return value.toNumber();
}

export interface LandingStats {
  /** ประกาศจัดซื้อใหม่ (publishedAt ใน 7 วันล่าสุด) */
  newAnnouncementsCount: number;
  /** โครงการที่ใกล้ปิดรับข้อเสนอ (bidDate ใน 14 วันถัดไป, ยังไม่ยกเลิก) */
  closingSoonCount: number;
  /** สัญญาที่กำลังดำเนินงาน (มีผู้ชนะและยังไม่ยกเลิก) */
  activeContractsCount: number;
  /** แจ้งเตือน: โครงการที่ bidDate อยู่ใน 3 วันถัดไป */
  alertsCount: number;
  /** ประหยัดได้ทั้งหมด (ประมาณการ): sum(centralPriceBaht - winnerAmountBaht) */
  savingsBahtTotal: number;
  /** จำนวนโครงการทั้งหมด */
  totalProjectsCount: number;
  /** จำนวนประกาศทั้งหมด */
  totalAnnouncementsCount: number;
  /** ปฏิทินจัดซื้อจัดจ้างย้อนหลังรายวัน แยกตามประเภทประกาศ */
  procurementCalendar: Array<{
    date: Date;
    planCount: number;
    torDraftCount: number;
    invitationCount: number;
    totalCount: number;
  }>;
  /** วันที่เวลาปรับปรุงข้อมูลล่าสุด (สูงสุดจาก project/announcement) */
  lastUpdatedAt: Date | null;
}

export interface GetLandingStatsOptions {
  calendarMonth?: Date;
}

/**
 * ดึงสถิติสำหรับหน้า Landing จาก EgpProject และ EgpAnnouncement
 * ใช้ใน Server Component (app/page.tsx)
 */
export async function getLandingStats(
  options?: GetLandingStatsOptions,
): Promise<LandingStats> {
  const now = new Date();
  const calendarMonth = options?.calendarMonth ?? now;
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - NEW_ANNOUNCEMENT_DAYS);
  const closingSoonEnd = new Date(todayStart);
  closingSoonEnd.setUTCDate(closingSoonEnd.getUTCDate() + CLOSING_SOON_DAYS);
  const alertEnd = new Date(todayStart);
  alertEnd.setUTCDate(alertEnd.getUTCDate() + ALERT_DAYS);
  const calendarStart = new Date(
    Date.UTC(
      calendarMonth.getUTCFullYear(),
      calendarMonth.getUTCMonth(),
      1,
      0,
      0,
      0,
      0,
    ),
  );
  const calendarEnd = new Date(
    Date.UTC(
      calendarMonth.getUTCFullYear(),
      calendarMonth.getUTCMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    ),
  );

  const activeSavingsWhere = {
    winnerName: { not: null },
    cancelDate: null,
    centralPriceBaht: { not: null },
    winnerAmountBaht: { not: null },
  } as const;

  const [
    newAnnouncementsCount,
    closingSoonCount,
    activeContractsCount,
    alertsCount,
    savingsBahtTotal,
    totalProjectsCount,
    totalAnnouncementsCount,
    calendarRows,
    latestProjectUpdatedAt,
    latestAnnouncementUpdatedAt,
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
    (async () => {
      const aggregate = await prisma.egpProject.aggregate({
        where: activeSavingsWhere,
        _sum: {
          centralPriceBaht: true,
          winnerAmountBaht: true,
        },
      });

      const centralSum = decimalToNumber(aggregate._sum.centralPriceBaht);
      const winnerSum = decimalToNumber(aggregate._sum.winnerAmountBaht);
      return centralSum - winnerSum;
    })(),
    prisma.egpProject.count(),
    prisma.egpAnnouncement.count(),
    prisma.egpAnnouncement.groupBy({
      by: ["publishedAt", "announceType"],
      where: {
        publishedAt: { gte: calendarStart, lte: calendarEnd },
      },
      _count: {
        _all: true,
      },
      orderBy: {
        publishedAt: "asc",
      },
    }),
    prisma.egpProject.findFirst({
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        updatedAt: true,
      },
    }),
    prisma.egpAnnouncement.findFirst({
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        updatedAt: true,
      },
    }),
  ]);

  type CalendarBucket = {
    date: Date;
    planCount: number;
    torDraftCount: number;
    invitationCount: number;
  };

  const procurementCalendarMap = new Map<string, CalendarBucket>();
  for (const row of calendarRows) {
    if (!row.publishedAt) continue;
    const key = row.publishedAt.toISOString().slice(0, 10);
    const existing = procurementCalendarMap.get(key);
    const announceType = (row.announceType || "").trim();
    const isPlan = /แผนการจัดซื้อ|แผนจัดซื้อ|แผนจัดหาพัสดุ/u.test(announceType);
    const isTorDraft = /ร่าง.*TOR|ประชาพิจารณ์|ร่างเอกสาร/u.test(announceType);
    const isInvitation = /ประกาศเชิญชวน|หนังสือเชิญชวน/u.test(announceType);

    const upsertBucket = existing ?? {
      date: row.publishedAt,
      planCount: 0,
      torDraftCount: 0,
      invitationCount: 0,
    };

    if (isPlan) {
      upsertBucket.planCount += row._count._all;
    }
    if (isTorDraft) {
      upsertBucket.torDraftCount += row._count._all;
    }
    if (isInvitation) {
      upsertBucket.invitationCount += row._count._all;
    }

    if (existing) {
      procurementCalendarMap.set(key, upsertBucket);
    } else {
      procurementCalendarMap.set(key, upsertBucket);
    }
  }
  const procurementCalendar = Array.from(procurementCalendarMap.values())
    .map((item) => ({
      ...item,
      totalCount: item.planCount + item.torDraftCount + item.invitationCount,
    }))
    .filter((item) => item.totalCount > 0)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const projectUpdatedAt = latestProjectUpdatedAt?.updatedAt ?? null;
  const announcementUpdatedAt = latestAnnouncementUpdatedAt?.updatedAt ?? null;
  const lastUpdatedAt =
    projectUpdatedAt && announcementUpdatedAt
      ? projectUpdatedAt > announcementUpdatedAt
        ? projectUpdatedAt
        : announcementUpdatedAt
      : projectUpdatedAt ?? announcementUpdatedAt;

  return {
    newAnnouncementsCount,
    closingSoonCount,
    activeContractsCount,
    alertsCount,
    savingsBahtTotal,
    totalProjectsCount,
    totalAnnouncementsCount,
    procurementCalendar,
    lastUpdatedAt,
  };
}
