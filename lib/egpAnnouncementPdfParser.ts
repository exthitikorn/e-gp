export interface EgpPdfParsedFields {
  centralPriceBaht?: string;
  winnerName?: string;
  winnerAmountBaht?: string;
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

function parseInviteAnnouncement(text: string): EgpPdfParsedFields {
  // pdf-parse อาจมี newline/ช่องว่างแปลก ๆ ระหว่างคำ
  // ทำให้ regex จับยากขึ้น เรา normalize ให้เป็น space เดียว
  const normalizedText = text.replace(/\s+/g, " ").trim();

  return {
    centralPriceBaht: extractPriceBaht(normalizedText),
  };
}

function parseWinnerAnnouncement(text: string): EgpPdfParsedFields {
  const normalizedText = text.replace(/\s+/g, " ").trim();
  const { winnerName, winnerAmountBaht } = extractWinnerInfo(normalizedText);

  return {
    winnerName,
    winnerAmountBaht,
  };
}

export function parseEgpPdfTextByAnnounceType(
  announceType: string,
  text: string,
): EgpPdfParsedFields {
  const normalizedType = announceType.replace(/\s+/g, " ").trim();

  // จัดกลุ่มด้วย pattern แทนการเทียบข้อความตรง ๆ
  // กลุ่มประกาศเชิญชวน
  if (/เชิญชวน/u.test(normalizedType)) {
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
