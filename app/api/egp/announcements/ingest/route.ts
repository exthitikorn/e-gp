import { NextResponse } from "next/server";
import iconv from "iconv-lite";
import {
  buildEgpRssUrl,
  mapRssToAnnouncements,
  type ParsedRss,
} from "@/lib/egpRss";
import { upsertAnnouncements } from "@/lib/egpAnnouncementsService";

interface IngestResult {
  created: number;
  updated: number;
  totalFromRss: number;
  error?: string;
}

const EGP_DEPT_ID = process.env.EGP_DEPT_ID;
const EGP_DEPTSUB_ID = process.env.EGP_DEPTSUB_ID;
const EGP_INGEST_SECRET = process.env.EGP_INGEST_SECRET;

export async function GET(request: Request) {
  const url = new URL(request.url);

  if (EGP_INGEST_SECRET) {
    const token = url.searchParams.get("token");
    if (!token || token !== EGP_INGEST_SECRET) {
      const payload: IngestResult = {
        created: 0,
        updated: 0,
        totalFromRss: 0,
        error: "Unauthorized",
      };
      return NextResponse.json(payload, { status: 401 });
    }
  }

  const rssUrl = buildEgpRssUrl({
    deptId: EGP_DEPT_ID,
    deptsubId: EGP_DEPTSUB_ID,
  });

  try {
    const response = await fetch(rssUrl, {
      headers: {
        Accept: "application/xml,text/xml;q=0.9,*/*;q=0.8",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const bodyText = await response.text();
      const payload: IngestResult = {
        created: 0,
        updated: 0,
        totalFromRss: 0,
        error: `e-GP RSS error ${response.status}: ${bodyText.slice(0, 200)}`,
      };

      return NextResponse.json(payload, { status: 502 });
    }

    const buffer = await response.arrayBuffer();
    const xmlText = iconv.decode(Buffer.from(buffer), "win874");
    console.log("[EGP Ingest RAW XML]:", xmlText);

    const { XMLParser } = await import("fast-xml-parser");
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      textNodeName: "#text",
    });

    const parsed = parser.parse(xmlText) as ParsedRss;
    console.log("[EGP Ingest PARSED]:", parsed);
    const announcements = mapRssToAnnouncements(parsed);

    if (announcements.length === 0) {
      const payload: IngestResult = {
        created: 0,
        updated: 0,
        totalFromRss: 0,
        error: "No announcements in RSS response",
      };

      return NextResponse.json(payload, { status: 200 });
    }

    const { created, updated } = await upsertAnnouncements(announcements);

    const payload: IngestResult = {
      created,
      updated,
      totalFromRss: announcements.length,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    const payload: IngestResult = {
      created: 0,
      updated: 0,
      totalFromRss: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };

    return NextResponse.json(payload, { status: 500 });
  }
}