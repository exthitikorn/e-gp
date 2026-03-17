export type EgpAnnounceType =
  | "P0"
  | "15"
  | "B0"
  | "D0"
  | "W0"
  | "D1"
  | "W1"
  | "D2"
  | "W2";

export type EgpMethodId =
  | "02"
  | "15"
  | "16"
  | "18"
  | "19"
  | "20"
  | "21"
  | "22"
  | "23"
  | "24"
  | "25"
  | "26";

export interface EgpAnnouncement {
  id: string;
  projectNumber: string;
  title: string;
  announceType: EgpAnnounceType | string;
  methodId: EgpMethodId | string | null;
  publishedAt: Date | null;
  rawDescription: string;
  link: string;
}

export interface BuildEgpRssUrlParams {
  baseUrl?: string;
  deptId?: string;
  deptsubId?: string;
  anounceType?: EgpAnnounceType;
  methodId?: EgpMethodId;
  announceDate?: string;
}

const DEFAULT_EGP_RSS_BASE_URL =
  "http://process3.gprocurement.go.th/EPROCRssFeedWeb/egpannouncerss.xml";

export function buildEgpRssUrl(params: BuildEgpRssUrlParams): string {
  const url = new URL(params.baseUrl ?? DEFAULT_EGP_RSS_BASE_URL);

  if (params.deptId) {
    url.searchParams.set("deptId", params.deptId);
  }

  if (params.deptsubId) {
    url.searchParams.set("deptsubId", params.deptsubId);
  }

  if (params.anounceType) {
    url.searchParams.set("anounceType", params.anounceType);
  }

  if (params.methodId) {
    url.searchParams.set("methodId", params.methodId);
  }

  if (params.announceDate) {
    url.searchParams.set("announceDate", params.announceDate);
  }

  return url.toString();
}

type XmlItem = {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
};

export type ParsedRss = {
  rss?: {
    channel?: {
      item?: XmlItem | XmlItem[];
      link?: string;
    };
  };
};

function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function extractProjectNumber(description: string): string {
  const match = description.match(/เลขที่โครงการ[:\s]+([^\s<]+)/u);
  if (match && match[1]) {
    return match[1].trim();
  }

  // รองรับรูปแบบย่อที่เป็น comma-separated:
  // "69039153244, ตลาดอิเล็กทรอนิกส์ (e-market), ประกาศเชิญชวน"
  const parts = description
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 1 && parts[0]) {
    return parts[0];
  }

  return "";
}

function extractMethod(description: string): string | null {
  // รูปแบบจาก RSS ปกติ: "วิธีการจัดหา : ตลาดอิเล็กทรอนิกส์ (e-market)<br>"
  const lineMatch = description.match(
    /วิธีการจัดหา[:\s]+(.+?)(?:<br|$)/u,
  );
  if (lineMatch && lineMatch[1]) {
    return lineMatch[1].trim();
  }

  // รูปแบบย่อที่เป็น comma-separated:
  // "69039153244, ตลาดอิเล็กทรอนิกส์ (e-market), ประกาศเชิญชวน"
  const parts = description
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 3) {
    return parts[1] || null;
  }

  return null;
}

function extractAnnounceType(description: string): string | null {
  // รูปแบบจาก RSS ปกติ: "ประเภทประกาศ : ประกาศเชิญชวน<br>"
  const lineMatch = description.match(
    /ประเภทประกาศ[:\s]+(.+?)(?:<br|$)/u,
  );
  if (lineMatch && lineMatch[1]) {
    return lineMatch[1].trim();
  }

  // รูปแบบย่อที่เป็น comma-separated:
  // "69039153244, ตลาดอิเล็กทรอนิกส์ (e-market), ประกาศเชิญชวน"
  const parts = description
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 3) {
    return parts[2] || null;
  }

  return null;
}

function extractLink(description: string, fallbackLink?: string | null): string {
  // ถ้า RSS มี <link> ที่เป็น URL ปกติอยู่แล้ว ใช้อันนั้นก่อน
  if (fallbackLink && /^https?:\/\//i.test(fallbackLink)) {
    return fallbackLink;
  }

  // พยายามดึง URL ตัวแรกจาก description (เช่น อยู่ในแท็ก <a href="...">)
  const urlMatch = description.match(/https?:\/\/[^\s"<]+/i);
  if (urlMatch && urlMatch[0]) {
    return urlMatch[0];
  }

  // ถ้าไม่มีจริง ๆ ค่อย fallback เป็น "#" เพื่อไม่ให้ลิงก์เสีย
  return "#";
}

function parsePublishedAt(pubDate?: string): Date | null {
  if (!pubDate) {
    return null;
  }

  const parsed = new Date(pubDate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export function mapRssToAnnouncements(parsed: ParsedRss): EgpAnnouncement[] {
  const items = ensureArray(parsed.rss?.channel?.item);
  const channelLink = parsed.rss?.channel?.link;

  return items.map((item, index) => {
    const rawDescription = item.description ?? "";
    const projectNumber = extractProjectNumber(rawDescription);
    const method = extractMethod(rawDescription);
    const announceType = extractAnnounceType(rawDescription);
    const link = extractLink(rawDescription, item.link || channelLink);

    return {
      id: projectNumber || item.link || `egp-item-${index}`,
      projectNumber,
      title: item.title ?? "",
      announceType: announceType ?? "",
      // เก็บชื่อวิธีการจัดหาแบบอ่านรู้เรื่องไว้ในฟิลด์ methodId หากไม่มีโค้ด Id ชัดเจน
      methodId: method ?? null,
      publishedAt: parsePublishedAt(item.pubDate),
      rawDescription,
      link,
    };
  });
}

