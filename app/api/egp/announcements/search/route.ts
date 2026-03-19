import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";

interface SearchParams {
  startDate?: string | null;
  endDate?: string | null;
  q?: string | null;
  projectNumber?: string | null;
  methodId?: string | null;
  status?: string | null;
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 5;

function parseSearchParams(request: Request): SearchParams {
  const { searchParams } = new URL(request.url);

  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const q = searchParams.get("q");
  const projectNumber = searchParams.get("projectNumber");
  const methodId = searchParams.get("methodId");
  const status = searchParams.get("status");
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE);

  return {
    startDate,
    endDate,
    q,
    projectNumber,
    methodId,
    status,
    page: Number.isNaN(page) || page < 1 ? 1 : page,
    pageSize:
      Number.isNaN(pageSize) || pageSize < 1 || pageSize > 100
        ? DEFAULT_PAGE_SIZE
        : pageSize,
  };
}

export async function GET(request: Request) {
  const {
    startDate,
    endDate,
    q,
    projectNumber,
    methodId,
    status,
    page,
    pageSize,
  } = parseSearchParams(request);

  const where: Prisma.EgpAnnouncementWhereInput = {};
  let projectWhere: Prisma.EgpProjectWhereInput | undefined;

  if (startDate || endDate) {
    where.publishedAt = {};
    if (startDate) {
      where.publishedAt.gte = new Date(`${startDate}T00:00:00Z`);
    }
    if (endDate) {
      where.publishedAt.lte = new Date(`${endDate}T23:59:59Z`);
    }
  }

  if (q) {
    where.OR = [
      { rawDescription: { contains: q } },
      {
        project: {
          title: { contains: q },
        },
      },
      {
        project: {
          projectNumber: { contains: q },
        },
      },
      {
        project: {
          methodId: { contains: q },
        },
      },
    ];
  }

  if (projectNumber) {
    projectWhere = {
      ...(projectWhere ?? {}),
      projectNumber: {
        contains: projectNumber,
      },
    };
  }

  if (methodId) {
    projectWhere = {
      ...(projectWhere ?? {}),
      methodId: {
        contains: methodId,
      },
    };
  }

  if (status) {
    projectWhere = {
      ...(projectWhere ?? {}),
      status: {
        contains: status,
      },
    };
  }

  if (projectWhere) {
    where.project = projectWhere;
  }

  const skip = (page - 1) * pageSize;
  const take = pageSize;

  const [total, items] = await Promise.all([
    prisma.egpAnnouncement.count({ where }),
    prisma.egpAnnouncement.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip,
      take,
      include: {
        project: true,
      },
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  const mappedItems = items.map((item) => ({
    id: item.id,
    projectNumber: item.project?.projectNumber ?? null,
    title: item.project?.title ?? "",
    announceType: item.announceType,
    methodId: item.project?.methodId ?? null,
    status: item.project?.status ?? null,
    rawDescription: item.rawDescription,
    link: item.link,
    publishedAt: item.publishedAt,
  }));

  return NextResponse.json({
    items: mappedItems,
    page,
    pageSize,
    total,
    totalPages,
  });
}
