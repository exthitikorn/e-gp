import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";

interface SearchParams {
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

  const q = searchParams.get("q");
  const projectNumber = searchParams.get("projectNumber");
  const methodId = searchParams.get("methodId");
  const status = searchParams.get("status");
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE);

  return {
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
  const { q, projectNumber, methodId, status, page, pageSize } =
    parseSearchParams(request);

  const where: Prisma.EgpProjectWhereInput = {};

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

  const [total, items] = await Promise.all([
    prisma.egpProject.count({ where }),
    prisma.egpProject.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take,
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  const mappedItems = items.map((item) => ({
    id: item.id,
    projectNumber: item.projectNumber,
    title: item.title,
    methodId: item.methodId,
    status: item.status,
    updatedAt: item.updatedAt.toISOString(),
  }));

  return NextResponse.json({
    items: mappedItems,
    page,
    pageSize,
    total,
    totalPages,
  });
}
