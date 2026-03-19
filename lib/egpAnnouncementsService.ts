import prisma from "@/lib/db";
import type { EgpAnnouncement as RssAnnouncement } from "@/lib/egpRss";

export async function upsertAnnouncements(
  announcements: RssAnnouncement[],
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const ann of announcements) {
    const projectId = ann.projectNumber || ann.id;

    const project = await prisma.egpProject.upsert({
      where: { id: projectId },
      create: {
        id: projectId,
        projectNumber: ann.projectNumber || null,
        title: ann.title,
        methodId: ann.methodId ?? null,
      },
      update: {
        projectNumber: ann.projectNumber || null,
        title: ann.title,
        methodId: ann.methodId ?? null,
      },
    });

    const typeId = ann.id;
    const announceTypeValue =
      typeof ann.announceType === "string"
        ? ann.announceType
        : String(ann.announceType);

    const child = await prisma.egpAnnouncement.upsert({
      where: { id: typeId },
      create: {
        id: typeId,
        projectId: project.id,
        announceType: announceTypeValue,
        rawDescription: ann.rawDescription,
        link: ann.link,
        publishedAt: ann.publishedAt,
      },
      update: {
        projectId: project.id,
        announceType: announceTypeValue,
        rawDescription: ann.rawDescription,
        link: ann.link,
        publishedAt: ann.publishedAt,
      },
    });

    const isNew =
      child.createdAt.getTime() === child.updatedAt.getTime() &&
      project.createdAt.getTime() === project.updatedAt.getTime();

    if (isNew) {
      created += 1;
    } else {
      updated += 1;
    }
  }

  return { created, updated };
}
