import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";

interface SearchParams {
  q?: string | null;
  projectNumber?: string | null;
  methodId?: string | null;
  status?: string | null;
  agencyId?: string | null;
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 5;

function parseSearchParams(request: Request): SearchParams {
  const { searchParams } = new URL(request.url);

  const q = searchParams.get("q");
  const projectNumber = searchParams.get("projectNumber");
  const methodId = searchParams.get("methodId");
  const status = searchParams.get("status");
  const agencyId =
    searchParams.get("agencyId") ?? searchParams.get("deptSubId");
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE);

  return {
    q,
    projectNumber,
    methodId,
    status,
    agencyId,
    page: Number.isNaN(page) || page < 1 ? 1 : page,
    pageSize:
      Number.isNaN(pageSize) || pageSize < 1 || pageSize > 100
        ? DEFAULT_PAGE_SIZE
        : pageSize,
  };
}

export async function GET(request: Request) {
  const { q, projectNumber, methodId, status, agencyId, page, pageSize } =
    parseSearchParams(request);

  const where: Prisma.EgpProjectWhereInput = {};

  if (agencyId) {
    where.agencyId = agencyId;
  }

  if (q) {
    where.OR = [
      { title: { contains: q } },
      { projectNumber: { contains: q } },
      { methodId: { contains: q } },
      { status: { contains: q } },
    ];
  }

  if (projectNumber) {
    where.projectNumber = {
      contains: projectNumber,
    };
  }

  if (methodId) {
    where.methodId = {
      contains: methodId,
    };
  }

  if (status) {
    where.status = {
      contains: status,
    };
  }

  const skip = (page - 1) * pageSize;
  const take = pageSize;
  const safeWhere: Prisma.EgpProjectWhereInput = {
    ...where,
    // กันข้อมูลค้างที่ FK ชี้หน่วยงานไม่เจอ
    agency: { is: {} },
  };

  const [total, items] = await Promise.all([
    prisma.egpProject.count({ where: safeWhere }),
    prisma.egpProject.findMany({
      where: safeWhere,
      orderBy: { updatedAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        projectNumber: true,
        title: true,
        methodId: true,
        status: true,
        updatedAt: true,
        agencyId: true,
        agency: {
          select: { id: true, name: true, deptId: true, deptsubId: true },
        },
        _count: {
          select: { announcements: true },
        },
        announcements: {
          orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
          take: 1,
          select: {
            announceType: true,
            publishedAt: true,
          },
        },
      },
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  const mappedItems = items.map((item) => {
    const latestAnnouncement = item.announcements[0];

    return {
      id: item.id,
      projectNumber: item.projectNumber,
      title: item.title,
      methodId: item.methodId,
      status: item.status,
      updatedAt: item.updatedAt.toISOString(),
      agencyId: item.agencyId,
      agencyName: item.agency.name,
      agencyDeptId: item.agency.deptId,
      agencyDeptsubId: item.agency.deptsubId,
      announcementCount: item._count.announcements,
      latestAnnouncementType: latestAnnouncement?.announceType ?? null,
      latestAnnouncementPublishedAt:
        latestAnnouncement?.publishedAt?.toISOString() ?? null,
    };
  });

  return NextResponse.json({
    items: mappedItems,
    page,
    pageSize,
    total,
    totalPages,
  });
}
