import prisma from "@/lib/db";
import { parseEgpPdfTextByAnnounceType } from "@/lib/egpAnnouncementPdfParser";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import iconv from "iconv-lite";

export interface ParsePdfResultPayload {
  announcementId: string;
  announceType: string | null;
  parsed: ReturnType<typeof parseEgpPdfTextByAnnounceType>;
  textPreview: string;
}

interface ParsePdfInput {
  id: string;
  announceType: string | null;
  link: string | null;
  projectId: string | null;
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function parsePdfForAnnouncement(
  input: ParsePdfInput,
): Promise<ParsePdfResultPayload> {
  const { id, announceType, link, projectId } = input;

  if (!link || !/^https?:\/\//i.test(link)) {
    throw new Error("announcement.link ไม่ใช่ URL ที่ถูกต้อง");
  }

  const response = await fetch(link, {
    method: "GET",
    headers: {
      Accept: "application/pdf,*/*",
      "User-Agent": "Mozilla/5.0 (compatible; EGP-PDF-Parser/1.0)",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `ดึง PDF ไม่สำเร็จ: ${response.status} (${body.slice(0, 200)})`,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";

  // ถ้าไม่ใช่ PDF ให้ถือว่าเป็นหน้า HTML/W2 จาก e-GP (ส่วนใหญ่เป็น win874)
  if (!/application\/pdf/i.test(contentType)) {
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let html: string;
    try {
      // e-GP มักใช้ win874 เหมือน RSS
      html = iconv.decode(buffer, "win874");
    } catch {
      html = buffer.toString("utf-8");
    }

    const text = htmlToPlainText(html);

    const parsed = parseEgpPdfTextByAnnounceType(announceType ?? "", text);

    if (projectId) {
      try {
        const updateData: Record<string, unknown> = {};

        if (parsed.centralPriceBaht) {
          updateData.centralPriceBaht = parsed.centralPriceBaht;
        }

        if (parsed.winnerName) {
          updateData.winnerName = parsed.winnerName;
        }

        if (parsed.winnerAmountBaht) {
          updateData.winnerAmountBaht = parsed.winnerAmountBaht;
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.egpProject.update(
            {
              where: { id: projectId },
              data: updateData,
            } as Parameters<typeof prisma.egpProject.update>[0],
          );
        }
      } catch {
        // ไม่ให้กระบวนการล้ม เพราะ error ตอนอัปเดตข้อมูลจากไฟล์ประกาศ
      }
    }

    const textPreview = text.slice(0, 500);

    return {
      announcementId: id,
      announceType,
      parsed,
      textPreview,
    };
  }

  // กรณีเป็น PDF ปกติ
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { PDFParse } = await import("pdf-parse");

  try {
    const workerFilePath = path.join(
      process.cwd(),
      "node_modules",
      "pdf-parse",
      "dist",
      "pdf-parse",
      "esm",
      "pdf.worker.mjs",
    );

    if (fs.existsSync(workerFilePath)) {
      PDFParse.setWorker(pathToFileURL(workerFilePath).href);
    }
  } catch {
    // ถ้าหา worker ไม่เจอ ก็ปล่อยให้ pdf-parse fallback เอง
  }

  const parser = new PDFParse({ data: buffer });

  try {
    const parsedPdfText = await parser.getText();
    const text = parsedPdfText.text ?? "";

    const parsed = parseEgpPdfTextByAnnounceType(announceType ?? "", text);

    if (projectId) {
      try {
        const updateData: Record<string, unknown> = {};

        if (parsed.centralPriceBaht) {
          updateData.centralPriceBaht = parsed.centralPriceBaht;
        }

        if (parsed.winnerName) {
          updateData.winnerName = parsed.winnerName;
        }

        if (parsed.winnerAmountBaht) {
          updateData.winnerAmountBaht = parsed.winnerAmountBaht;
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.egpProject.update(
            {
              where: { id: projectId },
              data: updateData,
            } as Parameters<typeof prisma.egpProject.update>[0],
          );
        }
      } catch {
        // ไม่ให้กระบวนการล้ม เพราะ error ตอนอัปเดตข้อมูลจากไฟล์ประกาศ
      }
    }

    const textPreview = text.replace(/\s+/g, " ").trim().slice(0, 500);

    return {
      announcementId: id,
      announceType,
      parsed,
      textPreview,
    };
  } finally {
    await parser.destroy().catch(() => {
      // best-effort cleanup
    });
  }
}

