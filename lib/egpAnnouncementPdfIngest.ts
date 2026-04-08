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

type EgpDocumentType = "pdf" | "html";

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

function inferDocumentType(link: string, contentType: string): EgpDocumentType {
  if (/application\/pdf/i.test(contentType)) {
    return "pdf";
  }

  if (/text\/html|application\/xhtml\+xml/i.test(contentType)) {
    return "html";
  }

  // fallback กรณีปลายทางไม่ส่ง content-type ชัดเจน
  if (/\.pdf(?:$|\?)/i.test(link)) {
    return "pdf";
  }

  return "html";
}

function buildProjectUpdateData(
  parsed: ReturnType<typeof parseEgpPdfTextByAnnounceType>,
): Record<string, unknown> {
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

  if (parsed.bidDate) {
    // parsed.bidDate เป็น ISO date string (YYYY-MM-DD)
    // แปลงเป็น Date ก่อนเพื่อให้ Prisma เขียนลงฟิลด์ DateTime ได้ถูกต้อง
    updateData.bidDate = new Date(parsed.bidDate);
  }

  if (parsed.projectStatus) {
    updateData.status = parsed.projectStatus;
  }

  if (parsed.cancelDate) {
    updateData.cancelDate = new Date(parsed.cancelDate);
  }

  return updateData;
}

async function updateProjectFromParsedData(
  projectId: string | null,
  parsed: ReturnType<typeof parseEgpPdfTextByAnnounceType>,
): Promise<void> {
  if (!projectId) {
    return;
  }

  try {
    const updateData = buildProjectUpdateData(parsed);
    if (Object.keys(updateData).length === 0) {
      return;
    }

    await prisma.egpProject.update(
      {
        where: { id: projectId },
        data: updateData,
      } as Parameters<typeof prisma.egpProject.update>[0],
    );
  } catch {
    // ไม่ให้กระบวนการล้ม เพราะ error ตอนอัปเดตข้อมูลจากไฟล์ประกาศ
  }
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
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
    return parsedPdfText.text ?? "";
  } finally {
    await parser.destroy().catch(() => {
      // best-effort cleanup
    });
  }
}

function extractTextFromHtmlBuffer(buffer: Buffer): string {
  try {
    // e-GP มักใช้ win874 เหมือน RSS
    return htmlToPlainText(iconv.decode(buffer, "win874"));
  } catch {
    return htmlToPlainText(buffer.toString("utf-8"));
  }
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
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const documentType = inferDocumentType(link, contentType);

  const text =
    documentType === "pdf"
      ? await extractTextFromPdf(buffer)
      : extractTextFromHtmlBuffer(buffer);

  // console.log(`[egp-raw] announcementId=${id} type=${announceType ?? "-"}`);
  // console.log(text);

  const parsed = parseEgpPdfTextByAnnounceType(announceType ?? "", text);
  // console.log(
  //   `[egp-parse] announcementId=${id} type=${announceType ?? "-"}`,
  //   JSON.stringify(parsed, null, 2),
  // );
  await updateProjectFromParsedData(projectId, parsed);

  const textPreview = text.replace(/\s+/g, " ").trim().slice(0, 500);

  return {
    announcementId: id,
    announceType,
    parsed,
    textPreview,
  };
}