import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";

interface SearchParams {
  startDate?: string | null;
  endDate?: string | null;
  q?: string | null;
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 20;

function parseSearchParams(request: Request): SearchParams {
  const { searchParams } = new URL(request.url);

  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const q = searchParams.get("q");
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE);

  return {
    startDate,
    endDate,
    q,
    page: Number.isNaN(page) || page < 1 ? 1 : page,
    pageSize:
      Number.isNaN(pageSize) || pageSize < 1 || pageSize > 100
        ? DEFAULT_PAGE_SIZE
        : pageSize,
  };
}

export async function GET(request: Request) {
  const { startDate, endDate, q, page, pageSize } = parseSearchParams(request);

  const where: Prisma.EgpAnnouncementWhereInput = {};

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
      { title: { contains: q } },
      { rawDescription: { contains: q } },
    ];
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
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  return NextResponse.json({
    items,
    page,
    pageSize,
    total,
    totalPages,
  });
}

