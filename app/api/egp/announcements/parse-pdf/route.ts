import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { parsePdfForAnnouncement } from "@/lib/egpAnnouncementPdfIngest";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const announcementId = url.searchParams.get("id");

  if (!announcementId) {
    return NextResponse.json(
      { error: "Missing query param: id" },
      { status: 400 },
    );
  }

  try {
    const announcement = await prisma.egpAnnouncement.findUnique({
      where: { id: announcementId },
      select: { id: true, announceType: true, link: true, projectId: true },
    });

    if (!announcement) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูล announcement" },
        { status: 404 },
      );
    }

    try {
      const payload = await parsePdfForAnnouncement({
        id: announcement.id,
        announceType: announcement.announceType,
        link: announcement.link,
        projectId: announcement.projectId,
      });

      return NextResponse.json(payload, { status: 200 });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "ดึง PDF หรือแปลงข้อมูลไม่สำเร็จ",
        },
        { status: 502 },
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

