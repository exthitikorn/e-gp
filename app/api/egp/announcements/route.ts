import { NextResponse } from "next/server";
import iconv from "iconv-lite";
import {
  buildEgpRssUrl,
  EgpAnnounceType,
  EgpMethodId,
  EgpAnnouncement,
  ParsedRss,
  mapRssToAnnouncements,
  rssScopeKeyFromDeptParams,
} from "@/lib/egpRss";

interface EgpApiResponse {
  announcements: EgpAnnouncement[];
  error?: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const deptId = searchParams.get("deptId") ?? undefined;
  const deptsubId = searchParams.get("deptsubId") ?? undefined;
  const anounceType = searchParams.get("anounceType") as
    | EgpAnnounceType
    | null;
  const methodId = searchParams.get("methodId") as EgpMethodId | null;
  const announceDate = searchParams.get("announceDate") ?? undefined;

  const url = buildEgpRssUrl({
    deptId,
    deptsubId,
    anounceType: anounceType ?? undefined,
    methodId: methodId ?? undefined,
    announceDate,
  });

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/xml,text/xml;q=0.9,*/*;q=0.8",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const bodyText = await response.text();
      const payload: EgpApiResponse = {
        announcements: [],
        error: `e-GP RSS error ${response.status}: ${bodyText.slice(0, 200)}`,
      };

      return NextResponse.json(payload, { status: 502 });
    }

    const buffer = await response.arrayBuffer();
    const xmlText = iconv.decode(Buffer.from(buffer), "win874");
    // console.log("[EGP RSS RAW XML]:", xmlText);

    const { XMLParser } = await import("fast-xml-parser");
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      textNodeName: "#text",
    });

    const parsed = parser.parse(xmlText) as ParsedRss;
    // console.log("[EGP RSS PARSED]:", parsed);
    const scopeKey = rssScopeKeyFromDeptParams(deptId, deptsubId);
    const announcements = mapRssToAnnouncements(parsed, {
      rssScopeKeyForStableId: scopeKey || undefined,
    });

    const payload: EgpApiResponse = {
      announcements,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    const payload: EgpApiResponse = {
      announcements: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };

    return NextResponse.json(payload, { status: 500 });
  }
}

