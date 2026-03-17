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

  return "";
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

  return items.map((item, index) => {
    const rawDescription = item.description ?? "";
    const projectNumber = extractProjectNumber(rawDescription);

    return {
      id: projectNumber || item.link || `egp-item-${index}`,
      projectNumber,
      title: item.title ?? "",
      announceType: "",
      methodId: null,
      publishedAt: parsePublishedAt(item.pubDate),
      rawDescription,
      link: item.link ?? "#",
    };
  });
}

