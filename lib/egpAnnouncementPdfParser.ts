export interface EgpPdfParsedFields {
  centralPriceBaht?: string;
  winnerName?: string;
  winnerAmountBaht?: string;
  // วันที่เสนอราคา (จากข้อความ "ในวันที่ ...")
  // เก็บเป็น ISO date string รูปแบบ "YYYY-MM-DD"
  bidDate?: string;
  // วันที่ยกเลิกโครงการ (จากประกาศยกเลิกประกาศเชิญชวน)
  // เก็บเป็น ISO date string รูปแบบ "YYYY-MM-DD"
  cancelDate?: string;
  // สถานะโครงการที่อนุมานได้จากข้อความในประกาศ
  projectStatus?: string;
}

const THAI_DIGIT_MAP: Record<string, string> = {
  "๐": "0",
  "๑": "1",
  "๒": "2",
  "๓": "3",
  "๔": "4",
  "๕": "5",
  "๖": "6",
  "๗": "7",
  "๘": "8",
  "๙": "9",
};

function toWesternDigits(input: string): string {
  return input.replace(/[๐-๙]/g, (d) => THAI_DIGIT_MAP[d] ?? d);
}

function normalizeBahtNumber(raw: string): string {
  // เก็บเฉพาะตัวเลขและจุดทศนิยม (ตัด space/คอมม่า)
  // ตัวอย่าง input: "๒๗,๐๐๐,๐๐๐.๐๐" -> "27000000.00"
  return toWesternDigits(raw)
    .replace(/[,\s]+/g, "")
    .trim();
}

function parseThaiDateToIso(input: string): string | undefined {
  // แปลงเลขไทย -> อารบิก ก่อน แล้วค่อย parse
  const normalized = toWesternDigits(input).replace(/\s+/g, " ").trim();

  const monthMap: Record<string, number> = {
    มกราคม: 1,
    กุมภาพันธ์: 2,
    มีนาคม: 3,
    เมษายน: 4,
    พฤษภาคม: 5,
    มิถุนายน: 6,
    กรกฎาคม: 7,
    สิงหาคม: 8,
    กันยายน: 9,
    ตุลาคม: 10,
    พฤศจิกายน: 11,
    ธันวาคม: 12,
  };

  const re =
    /(?:วันที่\s*)?([0-9]{1,2})\s*(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s*(?:พ\.ศ\.)?\s*([0-9]{4})/u;

  const match = normalized.match(re);
  if (!match) return undefined;

  const day = parseInt(match[1], 10);
  const month = monthMap[match[2]];
  let year = parseInt(match[3], 10);

  if (!month || !day || !year) return undefined;

  // ปี พ.ศ. แปลงเป็น ค.ศ. โดยลบ 543 (กรณีปีใหญ่กว่า 2400 สมมุติว่าเป็น พ.ศ.)
  if (year > 2400) {
    year -= 543;
  }

  const mm = month.toString().padStart(2, "0");
  const dd = day.toString().padStart(2, "0");

  return `${year}-${mm}-${dd}`;
}

function extractAllThaiDates(text: string): string[] {
  // รองรับรูปแบบ "วันที่ ๒๕ มีนาคม ๒๕๖๙", "๑๗ มีนาคม พ.ศ. ๒๕๖๙", "25 มีนาคม 2569" ฯลฯ
  const monthPattern =
    "(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)";

  const dateRegex = new RegExp(
    `(?:วันที่\\s*)?([0-9๐-๙]{1,2})\\s*${monthPattern}\\s*(?:พ\\.ศ\\.)?\\s*([0-9๐-๙]{4})`,
    "gu",
  );

  const results = new Set<string>();
  const primaryResults = new Set<string>();

  for (const match of text.matchAll(dateRegex)) {
    const raw = match[0]?.trim();
    if (!raw) continue;
    results.add(raw);
  }

  // เสริม heuristic: เคส "ในวันที่ <วัน> ... ระหว่างเวลา ..." ที่ pdf-parse ทำให้ เดือน/ปี หลุดไปอยู่ไกล
  // ขั้นตอน:
  // 1) หา "ในวันที่ <วัน>" ก่อน
  // 2) เปิด window ถัดจากจุดนั้นจำนวนหนึ่งตัวอักษร
  // 3) หา "<เดือน> <ปี>" ภายใน window แล้วประกอบเป็นวันที่สมบูรณ์
  const dayAnchorRegex = /ในวันที่\s*([0-9๐-๙]{1,2})/gu;
  const monthYearRegex = new RegExp(
    `${monthPattern}\\s*([0-9๐-๙]{4})`,
    "u",
  );

  const WINDOW_SIZE = 160;

  for (const match of text.matchAll(dayAnchorRegex)) {
    const day = match[1]?.trim();
    if (!day) continue;

    const anchorIndex = match.index ?? -1;
    if (anchorIndex < 0) continue;

    const windowStart = anchorIndex;
    const windowEnd = Math.min(text.length, anchorIndex + WINDOW_SIZE);
    const windowText = text.slice(windowStart, windowEnd);

    const monthYearMatch = windowText.match(monthYearRegex);
    if (!monthYearMatch) continue;

    const month = monthYearMatch[1]?.trim();
    const year = monthYearMatch[2]?.trim();
    if (!month || !year) continue;

    const combined = `วันที่ ${day} ${month} ${year}`.trim();
    results.add(combined);
    primaryResults.add(combined);
  }

  // ถ้ามีวันที่จาก heuristic "ในวันที่ ... เดือน ปี" ให้ถือว่าเป็น primary
  // และคืนเฉพาะชุดนั้น (เช่น วันที่ประกวดราคา) เพื่อตัดวันที่อื่น ๆ ออก
  if (primaryResults.size > 0) {
    return Array.from(primaryResults);
  }

  return Array.from(results);
}

function extractPriceBaht(text: string): string | undefined {
  // PDF ใน e-GP มีได้หลายรูปแบบ เช่น:
  // - "เป็นเงินทั้งสิ้น ๒๗,๐๐๐,๐๐๐.๐๐ บาท"
  // - "ราคากลาง ... 27,000,000 บาท"
  // - "วงเงินงบประมาณ 27,000,000 บาทถ้วน"
  // - "จำนวนเงิน 27,000,000.00 บาท"

  const patterns: RegExp[] = [
    // แบบเดิม
    /เป็นเงินทั้งสิ้น\s*([0-9๐-๙][0-9๐-๙,\.\s]*)\s*บาท/u,

    // ระบุราคากลาง/วงเงิน/งบประมาณ/มูลค่า แล้วตามด้วยตัวเลขและบาท
    /(ราคากลาง|วงเงิน|วงเงินงบประมาณ|งบประมาณ|มูลค่า)\s*[:：]?\s*([0-9๐-๙][0-9๐-๙,\.\s]*)\s*บาท(?:ถ้วน)?/u,

    // "จำนวนเงิน ... บาท"
    /จำนวนเงิน\s*([0-9๐-๙][0-9๐-๙,\.\s]*)\s*บาท(?:ถ้วน)?/u,

    // "เป็นจำนวนเงิน ... บาท"
    /เป็นจำนวนเงิน\s*([0-9๐-๙][0-9๐-๙,\.\s]*)\s*บาท(?:ถ้วน)?/u,

    // fallback: หาเลขก่อนคำว่า บาท ภายในระยะที่ไม่ไกล (กันไปจับเลขอื่นมั่ว)
    /([0-9๐-๙][0-9๐-๙,\.\s]{0,30})\s*บาท(?:ถ้วน)?/u,
  ];

  for (const re of patterns) {
    const match = text.match(re);
    if (!match) continue;

    // regex บางตัวมี 2 กลุ่ม (keyword, number)
    const candidate = match[2] ?? match[1];

    if (!candidate) continue;
    const normalized = normalizeBahtNumber(candidate);

    // กัน false positive แบบสั้นเกินไป (เช่น "1 บาท")
    const digitsOnly = normalized.replace(/\D/g, "");
    if (digitsOnly.length < 4) continue;

    return normalized;
  }

  return undefined;
}

function extractWinnerInfo(text: string): {
  winnerName?: string;
  winnerAmountBaht?: string;
} {
  const normalizedText = text.replace(/\s+/g, " ").trim();

  // รูปแบบชื่อผู้ชนะ/ผู้ได้รับการคัดเลือกในเอกสาร e-GP มีได้หลายแบบ เช่น:
  // - "ผู้ที่ได้รับการคัดเลือก ได้แก่ บริษัท ... โดยเสนอราคา ..."
  // - "ผู้เสนอราคาที่ชนะการเสนอราคา ได้แก่ ห้างหุ้นส่วนจำกัด ... ซึ่งเป็นผู้เสนอราคาต่ำสุด ..."
  // - หรือ "ผู้ได้รับการคัดเลือก ได้แก่ ... ซึ่งเป็นผู้เสนอราคา ..."
  const winnerNamePatterns: RegExp[] = [
    /ผู้ที่ได้รับการคัดเลือก\s+ได้แก่\s+(.+?)\s+โดยเสนอราคา/u,
    // e-bidding: "ผู้เสนอราคาที่ชนะการเสนอราคา ได้แก่ บริษัท ... จำกัด ซึ่งเป็น ผู้เสนอราคา ต่ำสุด"
    /ผู้เสนอราคาที่ชนะการเสนอราคา\s+ได้แก่\s+(.+?)\s*ซึ่งเป็น\s*ผู้เสนอราคา(?:\s*ต่ำสุด)?/u,
    // เผื่อเคสมีคำอื่นตามหลัง เช่น "โดยเสนอราคา"
    /ผู้เสนอราคาที่ชนะการเสนอราคา\s+ได้แก่\s+(.+?)\s*(?:โดยเสนอราคา|ซึ่งเป็น|ที่เป็นผู้เสนอราคา)/u,
    // วิธีเฉพาะเจาะจง: "ผู้ได้รับการคัดเลือก ได้แก่ ... โดยเสนอราคา/ซึ่งเป็นผู้เสนอราคา"
    /ผู้ได้รับการคัดเลือก\s+ได้แก่\s+(.+?)\s*(?:โดยเสนอราคา|ซึ่งเป็น\s*ผู้เสนอราคา)?/u,
  ];

  let winnerName: string | undefined;
  for (const re of winnerNamePatterns) {
    const match = normalizedText.match(re);
    if (match?.[1]) {
      winnerName = match[1].trim();
      break;
    }
  }

  // ถ้าได้ค่าที่สั้นผิดปกติ (เช่น "เ") ให้ถือว่าไม่ valid แล้วไป fallback
  if (winnerName && winnerName.length <= 2) {
    winnerName = undefined;
  }

  // ถ้ายังหาไม่เจอ ลองหาใกล้ ๆ คำหลัก แล้วดึงชื่อให้ฉลาดขึ้น
  if (!winnerName) {
    const anchorIndex =
      normalizedText.indexOf("ผู้เสนอราคาที่ชนะการเสนอราคา") >= 0
        ? normalizedText.indexOf("ผู้เสนอราคาที่ชนะการเสนอราคา")
        : normalizedText.indexOf("ผู้ได้รับการคัดเลือก");

    if (anchorIndex >= 0) {
      const windowText = normalizedText.slice(anchorIndex, anchorIndex + 200);
      // 1) กรณีมีคำขึ้นต้นแบบนิติบุคคล
      const orgFallbackMatch = windowText.match(
        /(ห้างหุ้นส่วนจำกัด|บริษัท(?:\s+จำกัด)?|บจก\.|หจ\.)\s+(.+?)(?:\s+(ผู้เสนอราคา|ซึ่งเป็น|โดยเสนอราคา|เสนอราคาเป็นเงินทั้งสิ้น|เป็นเงินทั้งสิ้น)|$)/u,
      );
      if (orgFallbackMatch) {
        const orgType = orgFallbackMatch[1];
        const orgName = orgFallbackMatch[2];
        winnerName = `${orgType} ${orgName}`.trim();
      } else {
        // 2) กรณีเป็นชื่อร้าน/บุคคลธรรมดา เช่น "เทคนิคก๊อปปี้ (ขายส่ง,ขายปลีก,...)"
        const genericMatch = windowText.match(
          /ได้แก่\s+(.+?)(?:\s+(ผู้เสนอราคา|ซึ่งเป็น|โดยเสนอราคา|เสนอราคาเป็นเงินทั้งสิ้น|เป็นเงินทั้งสิ้น)|$)/u,
        );
        if (genericMatch?.[1]) {
          winnerName = genericMatch[1].trim();
        }
      }
    }
  }

  // post-process: clean up ชื่อให้เหลือแค่ตัวชื่อจริง
  if (winnerName) {
    // 1) ถ้ามีคำขึ้นต้นแบบนิติบุคคล ให้ตัดส่วนเกินหลังคำสำคัญออก
    const orgMatch = winnerName.match(
      /(ห้างหุ้นส่วนจำกัด|บริษัท(?:\s+จำกัด)?|บจก\.|หจ\.)\s+(.+?)(?:\s+(ผู้เสนอราคา|ซึ่งเป็น|โดยเสนอราคา|เสนอราคาเป็นเงินทั้งสิ้น|เป็นเงินทั้งสิ้น)|$)/u,
    );
    if (orgMatch) {
      const orgType = orgMatch[1];
      const orgName = orgMatch[2];
      winnerName = `${orgType} ${orgName}`.trim();
    }

    // 2) ตัดคำอธิบายในวงเล็บท้ายชื่อ เช่น "(ขายส่ง,ขายปลีก,ให้บริการ,ผู้ผลิต)"
    winnerName = winnerName.replace(/\s*\([^)]*\)\s*$/u, "").trim();

    // กันกรณีพังจนเหลือสั้นเกินไป
    if (winnerName.length <= 1) {
      winnerName = undefined;
    }
  }

  // ใช้ logic เดิมสำหรับ "เป็นเงินทั้งสิ้น ... บาท"
  const winnerAmountBaht = extractPriceBaht(normalizedText);

  return { winnerName, winnerAmountBaht };
}

function parseCancelAnnouncement(text: string): EgpPdfParsedFields {
  const normalizedText = text.replace(/\s+/g, " ").trim();

  // ระบุวันที่ยกเลิกจากบรรทัด "ประกาศ ณ วันที่ ..."
  let cancelDate: string | undefined;

  const cancelDateMatch = normalizedText.match(
    /ประกาศ\s+ณ\s+วันที่\s*([0-9๐-๙]{1,2}\s*(?:มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s*(?:พ\.ศ\.)?\s*[0-9๐-๙]{4})/u,
  );

  if (cancelDateMatch?.[1]) {
    cancelDate = parseThaiDateToIso(cancelDateMatch[1]);
  }

  // fallback: ถ้า pattern เฉพาะไม่เจอ ให้ใช้วันที่ล่าสุดในเอกสาร
  if (!cancelDate) {
    const allDates = extractAllThaiDates(normalizedText);
    if (allDates.length > 0) {
      // แปลงเป็น ISO แล้วเลือกวันที่ที่ใหม่ที่สุด
      const isoDates = allDates
        .map((d) => parseThaiDateToIso(d))
        .filter((d): d is string => Boolean(d))
        .sort(); // ISO date string สามารถ sort เพื่อหา max ได้ตรง ๆ

      if (isoDates.length > 0) {
        cancelDate = isoDates[isoDates.length - 1];
      }
    }
  }

  return {
    cancelDate,
    projectStatus: "ยกเลิกโครงการ",
  };
}

function parseInviteAnnouncement(text: string): EgpPdfParsedFields {
  // pdf-parse อาจมี newline/ช่องว่างแปลก ๆ ระหว่างคำ
  // ทำให้ regex จับยากขึ้น เรา normalize ให้เป็น space เดียว
  const normalizedText = text.replace(/\s+/g, " ").trim();

  const dates = extractAllThaiDates(normalizedText);
  const rawBidDate = dates[0];
  const bidDate = rawBidDate ? parseThaiDateToIso(rawBidDate) : undefined;

  return {
    centralPriceBaht: extractPriceBaht(normalizedText),
    bidDate,
    projectStatus: "หนังสือเชิญชวน/ประกาศเชิญชวน",
  };
}

function parseWinnerAnnouncement(text: string): EgpPdfParsedFields {
  const normalizedText = text.replace(/\s+/g, " ").trim();
  const { winnerName, winnerAmountBaht } = extractWinnerInfo(normalizedText);

  return {
    winnerName,
    winnerAmountBaht,
    projectStatus: "อนุมัติสั่งซื้อสั่งจ้างและประกาศผู้ชนะการเสนอราคา",
  };
}

export function parseEgpPdfTextByAnnounceType(
  announceType: string,
  text: string,
): EgpPdfParsedFields {
  const normalizedType = announceType.replace(/\s+/g, " ").trim();

  // จัดกลุ่มด้วย pattern แทนการเทียบข้อความตรง ๆ
  // กลุ่มประกาศยกเลิกประกาศเชิญชวน
  if (/ยกเลิกประกาศ/u.test(normalizedType)) {
    return parseCancelAnnouncement(text);
  }

  // กลุ่มประกาศเชิญชวน + ร่างเอกสารเชิญชวน (e-Bidding / สอบราคา)
  if (
    /ประกาศเชิญชวน/u.test(normalizedType) ||
    /ร่างเอกสารประกวดราคา\s*\(e-Bidding\)/u.test(normalizedType) ||
    /ร่างเอกสารซื้อหรือจ้างด้วยวิธีสอบราคา/u.test(normalizedType)
  ) {
    return parseInviteAnnouncement(text);
  }

  // กลุ่มประกาศผู้ชนะ/ผู้ได้รับการคัดเลือก
  if (
    /ผู้ชนะการเสนอราคา/u.test(normalizedType) ||
    /ผู้ได้รับการคัดเลือก/u.test(normalizedType)
  ) {
    return parseWinnerAnnouncement(text);
  }

  // ยังไม่รองรับประเภทอื่น
  return {};
}
