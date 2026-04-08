import { NextResponse } from "next/server";
import iconv from "iconv-lite";
import {
  buildEgpRssUrl,
  mapRssToAnnouncements,
  type ParsedRss,
  type EgpAnnouncement,
  EgpAnnounceType,
} from "@/lib/egpRss";
import { upsertAnnouncements } from "@/lib/egpAnnouncementsService";

interface IngestResult {
  created: number;
  updated: number;
  totalFromRss: number;
  byAnnounceType: Record<
    string,
    {
      created: number;
      updated: number;
      total: number;
    }
  >;
  error?: string;
}

const EGP_DEPT_ID = process.env.EGP_DEPT_ID;
const EGP_DEPTSUB_ID = process.env.EGP_DEPTSUB_ID;
const EGP_INGEST_SECRET = process.env.EGP_INGEST_SECRET;

const ALL_EGP_ANNOUNCE_TYPES: EgpAnnounceType[] = [
  "P0",
  "15",
  "B0",
  "D0",
  "W0",
  "D1",
  "W1",
  "D2",
  "W2",
];

async function fetchXmlFromUrl(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/xml,text/xml;q=0.9,*/*;q=0.8",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(
      `e-GP RSS error ${response.status} for ${url}: ${bodyText.slice(0, 200)}`,
    );
  }

  const buffer = await response.arrayBuffer();
  return iconv.decode(Buffer.from(buffer), "win874");
}

async function fetchAllAnnouncementsFromEgp(): Promise<EgpAnnouncement[]> {
  const urls = ALL_EGP_ANNOUNCE_TYPES.map((anounceType) =>
    buildEgpRssUrl({
      deptId: EGP_DEPT_ID,
      deptsubId: EGP_DEPTSUB_ID,
      anounceType,
    }),
  );

  const xmlTexts = await Promise.all(urls.map((url) => fetchXmlFromUrl(url)));

  const { XMLParser } = await import("fast-xml-parser");
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
  });

  const allAnnouncementsArrays = xmlTexts.map((xmlText) => {
    const parsed = parser.parse(xmlText) as ParsedRss;
    return mapRssToAnnouncements(parsed);
  });

  const announcements = allAnnouncementsArrays.flat();

  return announcements;
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  if (EGP_INGEST_SECRET) {
    const token = url.searchParams.get("token");
    if (!token || token !== EGP_INGEST_SECRET) {
      const payload: IngestResult = {
        created: 0,
        updated: 0,
        totalFromRss: 0,
        byAnnounceType: {},
        error: "Unauthorized",
      };
      return NextResponse.json(payload, { status: 401 });
    }
  }

  try {
    const announcements = await fetchAllAnnouncementsFromEgp();

    if (announcements.length === 0) {
      const payload: IngestResult = {
        created: 0,
        updated: 0,
        totalFromRss: 0,
        byAnnounceType: {},
        error: "No announcements in RSS response",
      };

      return NextResponse.json(payload, { status: 200 });
    }

    const { created, updated, byAnnounceType } =
      await upsertAnnouncements(announcements);

    const payload: IngestResult = {
      created,
      updated,
      totalFromRss: announcements.length,
      byAnnounceType,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    const payload: IngestResult = {
      created: 0,
      updated: 0,
      totalFromRss: 0,
      byAnnounceType: {},
      error: error instanceof Error ? error.message : "Unknown error",
    };

    return NextResponse.json(payload, { status: 500 });
  }
}