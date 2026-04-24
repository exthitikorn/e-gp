import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agencyId = searchParams.get("agencyId");
  const where: Prisma.EgpProjectWhereInput = {
    // กันข้อมูลค้างที่ FK ชี้หน่วยงานไม่เจอ
    agency: { is: {} },
  };

  if (agencyId) {
    where.agencyId = agencyId;
  }

  const items = await prisma.egpProject.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      agency: {
        select: { id: true, name: true, deptId: true, deptsubId: true },
      },
      announcements: {
        orderBy: { publishedAt: "desc" },
        select: {
          id: true,
          announceType: true,
          rawDescription: true,
          link: true,
          publishedAt: true,
        },
      },
    },
  });

  return NextResponse.json({
    items: items.map((item) => ({
      id: item.id,
      projectNumber: item.projectNumber,
      title: item.title,
      methodId: item.methodId,
      status: item.status,
      centralPriceBaht: item.centralPriceBaht
        ? item.centralPriceBaht.toString()
        : null,
      winnerName: item.winnerName,
      winnerAmountBaht: item.winnerAmountBaht
        ? item.winnerAmountBaht.toString()
        : null,
      bidDate: item.bidDate ? item.bidDate.toISOString() : null,
      updatedAt: item.updatedAt.toISOString(),
      agencyId: item.agencyId,
      agencyName: item.agency.name,
      agencyDeptId: item.agency.deptId,
      agencyDeptsubId: item.agency.deptsubId,
      announcements: item.announcements.map((announcement) => ({
        id: announcement.id,
        announceType: announcement.announceType,
        rawDescription: announcement.rawDescription,
        link: announcement.link,
        publishedAt: announcement.publishedAt
          ? announcement.publishedAt.toISOString()
          : null,
      })),
    })),
    total: items.length,
  });
}
