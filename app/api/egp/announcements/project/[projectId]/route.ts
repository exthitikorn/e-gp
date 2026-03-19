import { NextResponse } from "next/server";
import prisma from "@/lib/db";

interface ProjectDetailResponse {
  id: string;
  projectNumber: string | null;
  title: string;
  methodId: string | null;
  winnerName: string | null;
  winnerAmountBaht: string | null;
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

export async function GET(_request: Request, { params }: RouteParams) {
  const { projectId } = await params;

  const project = await prisma.egpProject.findFirst({
    where: {
      OR: [{ id: projectId }, { projectNumber: projectId }],
    },
    include: {
      announcements: {
        orderBy: { publishedAt: "desc" },
      },
    },
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
    winnerName: project.winnerName,
    winnerAmountBaht: project.winnerAmountBaht
      ? project.winnerAmountBaht.toString()
      : null,
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

