import { createHash } from "crypto";

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

function splitDeptCodes(value?: string | null): string[] {
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .split(/[,\n;\r]+/u)
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  );
}

/** คีย์แยก scope ของ RSS สำหรับสร้าง id ประกาศให้ไม่ชนกันระหว่างหน่วยงาน */
export interface MapRssToAnnouncementsOptions {
  rssScopeKeyForStableId?: string;
}

/**
 * ตามคู่มือ RSS e-GP: ถ้ามี deptId ให้ใช้พารามิเตอร์ deptId เท่านั้น
 * ถ้าไม่มี deptId แต่มี deptsubId ให้ใช้ deptsubId
 */
export function normalizeRssDeptQueryParams(params: {
  deptId?: string | null;
  deptsubId?: string | null;
}): { deptId?: string; deptsubId?: string } {
  const d = params.deptId?.trim();
  const s = params.deptsubId?.trim();
  if (d) {
    return { deptId: d };
  }
  if (s) {
    return { deptsubId: s };
  }
  return {};
}

export interface RssDeptScope {
  deptId?: string;
  deptsubId?: string;
  rssUses: "deptId" | "deptsubId";
  scopeKey: string;
}

/** แตกค่า deptId/deptsubId ที่คั่นด้วย comma แล้วคืนรายการ scope สำหรับยิง RSS */
export function buildRssDeptScopes(params: {
  deptId?: string | null;
  deptsubId?: string | null;
}): RssDeptScope[] {
  const deptIds = splitDeptCodes(params.deptId);
  const deptsubIds = splitDeptCodes(params.deptsubId);

  const scopes: RssDeptScope[] = [];
  for (const d of deptIds) {
    scopes.push({
      deptId: d,
      rssUses: "deptId",
      scopeKey: `d:${d}`,
    });
  }
  for (const s of deptsubIds) {
    scopes.push({
      deptsubId: s,
      rssUses: "deptsubId",
      scopeKey: `s:${s}`,
    });
  }
  return scopes;
}

/** สร้างคีย์สำหรับ stable id / แยกแถวหน่วยงาน (รูปแบบ d:รหัส หรือ s:รหัส) */
export function rssScopeKeyFromDeptParams(
  deptId?: string | null,
  deptsubId?: string | null,
): string {
  const d = deptId?.trim();
  const s = deptsubId?.trim();
  if (d) {
    return `d:${d}`;
  }
  if (s) {
    return `s:${s}`;
  }
  return "";
}

const DEFAULT_EGP_RSS_BASE_URL =
  "https://process3.gprocurement.go.th/EPROCRssFeedWeb/egpannouncerss.xml";

export function buildEgpRssUrl(params: BuildEgpRssUrlParams): string {
  const url = new URL(params.baseUrl ?? DEFAULT_EGP_RSS_BASE_URL);

  const rssDept = normalizeRssDeptQueryParams({
    deptId: params.deptId,
    deptsubId: params.deptsubId,
  });
  if (rssDept.deptId) {
    url.searchParams.set("deptId", rssDept.deptId);
  } else if (rssDept.deptsubId) {
    url.searchParams.set("deptsubId", rssDept.deptsubId);
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

  console.log(url.toString());

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

function extractProjectNumber(description: string): string | null {
  const match = description.match(/เลขที่โครงการ[:\s]+([^\s<]+)/u);
  if (match && match[1]) {
    const projectNumber = match[1].trim();
    return projectNumber ? projectNumber : null;
  }

  // รองรับรูปแบบย่อที่เป็น comma-separated:
  // "69039153244, ตลาดอิเล็กทรอนิกส์ (e-market), ประกาศเชิญชวน"
  const parts = description
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 1 && parts[0]) {
    const projectNumber = parts[0].trim();
    return projectNumber ? projectNumber : null;
  }

  return null;
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

export function mapRssToAnnouncements(
  parsed: ParsedRss,
  options?: MapRssToAnnouncementsOptions,
): EgpAnnouncement[] {
  const rssScopeKeyForStableId = options?.rssScopeKeyForStableId;
  const items = ensureArray(parsed.rss?.channel?.item);
  const channelLink = parsed.rss?.channel?.link;

  function buildAnnouncementId(
    projectNumber: string,
    announceType: string,
    link: string | undefined | null,
    index: number,
    scopeKey?: string,
  ): string {
    // เป้าหมาย: ทำให้ “โปรเจกต์ + ประเภทประกาศ” แยก record ได้ และ upsert ได้ถูก
    // โดยไม่ให้ชนกันเพราะ projectNumber อย่างเดียว
    const projectKey = projectNumber.trim();
    const announceTypeKey = announceType.trim();
    const deptKey = (scopeKey ?? "").trim();

    let idSource: string;
    if (deptKey && projectKey && announceTypeKey) {
      idSource = `${deptKey}|${projectKey}|${announceTypeKey}`;
    } else if (projectKey && announceTypeKey) {
      idSource = `${projectKey}|${announceTypeKey}`;
    } else if (link && /^https?:\/\//i.test(link)) {
      idSource = deptKey
        ? `${deptKey}|${link}|${announceTypeKey}`
        : `${link}|${announceTypeKey}`;
    } else {
      idSource = deptKey
        ? `${deptKey}|egp-item-${index}|${projectKey}|${announceTypeKey}`
        : `egp-item-${index}|${projectKey}|${announceTypeKey}`;
    }

    const hash = createHash("sha256").update(idSource).digest("hex");
    return `ann-${hash}`;
  }

  const results: EgpAnnouncement[] = [];

  for (const [index, item] of items.entries()) {
    const rawDescription = item.description ?? "";
    const projectNumber = extractProjectNumber(rawDescription);
    if (!projectNumber) continue; // ป้องกันบันทึกโครงการที่ไม่มี projectNumber (ซึ่งตอนนี้เป็น NOT NULL)

    const method = extractMethod(rawDescription);
    const announceType = extractAnnounceType(rawDescription);
    const link = extractLink(rawDescription, item.link || channelLink);

    const id = buildAnnouncementId(
      projectNumber,
      announceType ?? "",
      link,
      index,
      rssScopeKeyForStableId,
    );

    results.push({
      id,
      projectNumber,
      title: item.title ?? "",
      announceType: announceType ?? "",
      // เก็บชื่อวิธีการจัดหาแบบอ่านรู้เรื่องไว้ในฟิลด์ methodId หากไม่มีโค้ด Id ชัดเจน
      methodId: method ?? null,
      publishedAt: parsePublishedAt(item.pubDate),
      rawDescription,
      link,
    });
  }

  return results;
}

