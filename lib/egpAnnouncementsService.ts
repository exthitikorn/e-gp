import prisma from "@/lib/db";
import type { EgpAnnouncement as RssAnnouncement } from "@/lib/egpRss";
import { parsePdfForAnnouncement } from "@/lib/egpAnnouncementPdfIngest";

export async function upsertAnnouncements(
  announcements: RssAnnouncement[],
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const ann of announcements) {
    const projectNumber = ann.projectNumber.trim();
    if (!projectNumber) {
      // best-effort: ตอนนี้ projectNumber เป็น NOT NULL ดังนั้นถ้ามีข้อมูลไม่ครบให้ข้าม record นี้
      continue;
    }

    const project = await prisma.egpProject.upsert({
      where: { projectNumber },
      create: {
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

    // project.upsert จะอัปเดต `updatedAt` ทุกครั้งอยู่แล้ว ทำให้เช็คจาก project ไม่แม่น
    // ให้ตัดสินจาก EgpAnnouncement เท่านั้น
    const isNew = child.createdAt.getTime() === child.updatedAt.getTime();

    if (isNew) {
      created += 1;

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

  return { created, updated };
}

