import prisma from "@/lib/db";
import type { EgpAnnouncement as RssAnnouncement } from "@/lib/egpRss";
import { parsePdfForAnnouncement } from "@/lib/egpAnnouncementPdfIngest";

export interface IngestTypeStats {
  created: number;
  updated: number;
  total: number;
}

export interface UpsertAnnouncementsResult {
  created: number;
  updated: number;
  byAnnounceType: Record<string, IngestTypeStats>;
}

function normalizeAnnouncementKeyPart(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/gu, " ").toLowerCase();
}

function dedupeAnnouncementsByNaturalKey(
  announcements: RssAnnouncement[],
): RssAnnouncement[] {
  const deduped = new Map<string, RssAnnouncement>();

  for (const ann of announcements) {
    const projectNumber = normalizeAnnouncementKeyPart(ann.projectNumber);
    const announceType = normalizeAnnouncementKeyPart(
      typeof ann.announceType === "string"
        ? ann.announceType
        : String(ann.announceType),
    );
    const link = normalizeAnnouncementKeyPart(ann.link);
    const naturalKey = `${projectNumber}|${announceType}|${link}`;
    const prev = deduped.get(naturalKey);

    if (!prev) {
      deduped.set(naturalKey, ann);
      continue;
    }

    // เก็บ record ที่มีข้อมูลวันที่ประกาศใหม่กว่าไว้ (ถ้ามี)
    const prevTime = prev.publishedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    const currTime = ann.publishedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    if (currTime > prevTime) {
      deduped.set(naturalKey, ann);
    }
  }

  return Array.from(deduped.values());
}

export async function upsertAnnouncements(
  announcements: RssAnnouncement[],
  agencyId: string,
): Promise<UpsertAnnouncementsResult> {
  let created = 0;
  let updated = 0;
  const byAnnounceType: Record<string, IngestTypeStats> = {};
  const uniqueAnnouncements = dedupeAnnouncementsByNaturalKey(announcements);

  for (const ann of uniqueAnnouncements) {
    const projectNumber = ann.projectNumber.trim();
    if (!projectNumber) {
      // best-effort: ตอนนี้ projectNumber เป็น NOT NULL ดังนั้นถ้ามีข้อมูลไม่ครบให้ข้าม record นี้
      continue;
    }

    const project = await prisma.egpProject.upsert({
      where: {
        agencyId_projectNumber: {
          agencyId,
          projectNumber,
        },
      },
      create: {
        agencyId,
        projectNumber,
        title: ann.title,
        methodId: ann.methodId ?? null,
      },
      update: {
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
        agencyId,
        projectId: project.id,
        announceType: announceTypeValue,
        rawDescription: ann.rawDescription,
        link: ann.link,
        publishedAt: ann.publishedAt,
      },
      update: {
        agencyId,
        projectId: project.id,
        announceType: announceTypeValue,
        rawDescription: ann.rawDescription,
        link: ann.link,
        publishedAt: ann.publishedAt,
      },
    });

    // project.upsert จะอัปเดต `updatedAt` ทุกครั้งอยู่แล้ว ทำให้เช็คจาก project ไม่แม่น
    // ให้ตัดสินจาก EgpAnnouncement เท่านั้น
    const isNew = child.createdAt.getTime() === child.updatedAt.getTime();
    const announceTypeKey = (child.announceType || "ไม่ระบุประเภท").trim();
    if (!byAnnounceType[announceTypeKey]) {
      byAnnounceType[announceTypeKey] = {
        created: 0,
        updated: 0,
        total: 0,
      };
    }
    byAnnounceType[announceTypeKey].total += 1;

    if (isNew) {
      created += 1;
      byAnnounceType[announceTypeKey].created += 1;

      if (child.link && /^https?:\/\//i.test(child.link)) {
        try {
          await parsePdfForAnnouncement({
            id: child.id,
            announceType: child.announceType,
            link: child.link,
            projectId: child.projectId,
          });
        } catch {
          // best-effort เท่านั้น ไม่ให้ ingest ทั้งชุดล้มเพราะ PDF ใด PDF หนึ่ง
        }
      }
    } else {
      updated += 1;
      byAnnounceType[announceTypeKey].updated += 1;

      // เมื่อมีการอัปเดต: re-parse อัตโนมัติสำหรับประเภทที่ต้องการ sync ข้อมูลจาก e-GP
      // - ประกาศยกเลิกประกาศเชิญชวน: sync สถานะโครงการ/วันที่ยกเลิก
      // - ประกาศเชิญชวน + ร่างเอกสารเชิญชวน: sync ราคากลาง วันที่เสนอราคา ฯลฯ
      // - ประกาศรายชื่อผู้ชนะ/ประกาศผู้ได้รับการคัดเลือก: sync สถานะเป็น อนุมัติสั่งซื้อสั่งจ้างและประกาศผู้ชนะการเสนอราคา
      const shouldReParseOnUpdate =
        /ยกเลิกประกาศ/u.test(child.announceType) ||
        /ประกาศเชิญชวน/u.test(child.announceType) ||
        /ร่างเอกสารประกวดราคา\s*\(e-Bidding\)/u.test(child.announceType) ||
        /ร่างเอกสารซื้อหรือจ้างด้วยวิธีสอบราคา/u.test(child.announceType) ||
        /ผู้ชนะการเสนอราคา/u.test(child.announceType) ||
        /ผู้ได้รับการคัดเลือก/u.test(child.announceType);

      if (
        child.link &&
        /^https?:\/\//i.test(child.link) &&
        shouldReParseOnUpdate
      ) {
        try {
          await parsePdfForAnnouncement({
            id: child.id,
            announceType: child.announceType,
            link: child.link,
            projectId: child.projectId,
          });
        } catch {
          // best-effort เช่นกัน ไม่ให้ ingest ทั้งชุดล้ม
        }
      }
    }
  }

  return { created, updated, byAnnounceType };
}
