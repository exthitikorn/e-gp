import prisma from "@/lib/db";
import type { EgpAnnouncement as RssAnnouncement } from "@/lib/egpRss";

export async function upsertAnnouncements(
  announcements: RssAnnouncement[],
): Promise<{
  created: number;
  updated: number;
}> {
  let created = 0;
  let updated = 0;

  for (const ann of announcements) {
    const result = await prisma.egpAnnouncement.upsert({
      where: { id: ann.id },
      create: {
        id: ann.id,
        projectNumber: ann.projectNumber || null,
        title: ann.title,
        announceType: typeof ann.announceType === "string" ? ann.announceType : String(ann.announceType),
        methodId: ann.methodId ?? null,
        publishedAt: ann.publishedAt,
        rawDescription: ann.rawDescription,
        link: ann.link,
      },
      update: {
        projectNumber: ann.projectNumber || null,
        title: ann.title,
        announceType: typeof ann.announceType === "string" ? ann.announceType : String(ann.announceType),
        methodId: ann.methodId ?? null,
        publishedAt: ann.publishedAt,
        rawDescription: ann.rawDescription,
        link: ann.link,
      },
    });

    if (result.createdAt.getTime() === result.updatedAt.getTime()) {
      created += 1;
    } else {
      updated += 1;
    }
  }

  return { created, updated };
}

