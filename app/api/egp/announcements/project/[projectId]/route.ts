import { NextResponse } from "next/server";
import prisma from "@/lib/db";

interface ProjectDetailResponse {
  id: string;
  projectNumber: string | null;
  title: string;
  methodId: string | null;
  centralPriceBaht: string | null;
  winnerName: string | null;
  winnerAmountBaht: string | null;
  bidDate: string | null;
  status: string | null;
  agency: {
    id: string;
    name: string;
    deptId: string | null;
    deptsubId: string | null;
  };
  types: {
    id: string;
    announceType: string;
    rawDescription: string;
    link: string;
    publishedAt: string | null;
  }[];
}

interface RouteParams {
  params: Promise<{
    projectId: string;
  }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const { projectId } = await params;
  const sp = new URL(request.url).searchParams;
  const agencyIdFilter =
    sp.get("agencyId") ?? sp.get("deptSubId");

  const project = await prisma.egpProject.findFirst({
    where: {
      AND: [
        {
          agency: { is: {} },
        },
        {
          OR: [
            { id: projectId },
            {
              projectNumber: projectId,
              ...(agencyIdFilter ? { agencyId: agencyIdFilter } : {}),
            },
          ],
        },
      ],
    },
    include: {
      announcements: {
        orderBy: { publishedAt: "desc" },
      },
      agency: {
        select: { id: true, name: true, deptId: true, deptsubId: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!project) {
    return NextResponse.json(
      { error: "ไม่พบโครงการที่ระบุ" },
      { status: 404 },
    );
  }

  const payload: ProjectDetailResponse = {
    id: project.id,
    projectNumber: project.projectNumber,
    title: project.title,
    methodId: project.methodId,
    centralPriceBaht: project.centralPriceBaht
      ? project.centralPriceBaht.toString()
      : null,
    winnerName: project.winnerName,
    winnerAmountBaht: project.winnerAmountBaht
      ? project.winnerAmountBaht.toString()
      : null,
    bidDate: project.bidDate ? project.bidDate.toISOString() : null,
    status: project.status ?? null,
    agency: {
      id: project.agency.id,
      name: project.agency.name,
      deptId: project.agency.deptId,
      deptsubId: project.agency.deptsubId,
    },
    types: project.announcements.map(
      (t): ProjectDetailResponse["types"][number] => ({
        id: t.id,
        announceType: t.announceType,
        rawDescription: t.rawDescription,
        link: t.link,
        publishedAt: t.publishedAt ? t.publishedAt.toISOString() : null,
      }),
    ),
  };

  return NextResponse.json(payload, { status: 200 });
}
