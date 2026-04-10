import { NextResponse } from "next/server";
import iconv from "iconv-lite";
import {
  buildEgpRssUrl,
  mapRssToAnnouncements,
  normalizeRssDeptQueryParams,
  rssScopeKeyFromDeptParams,
  type ParsedRss,
  type EgpAnnouncement,
  EgpAnnounceType,
} from "@/lib/egpRss";
import { upsertAnnouncements } from "@/lib/egpAnnouncementsService";
import prisma from "@/lib/db";
import type { IngestTypeStats } from "@/lib/egpAnnouncementsService";

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
  byAgencies: AgencyIngestSlice[];
  /** @deprecated ใช้ byAgencies แทน — คงไว้เพื่อความเข้ากันได้กับ client เก่า */
  byDepartment?: AgencyIngestSlice[];
  error?: string;
}

interface AgencyIngestSlice {
  agencyId: string;
  name: string;
  deptId: string | null;
  deptsubId: string | null;
  rssUses: "deptId" | "deptsubId" | null;
  created: number;
  updated: number;
  totalFromRss: number;
  byAnnounceType: Record<string, IngestTypeStats>;
  error?: string;
}

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

function mergeByAnnounceType(
  target: Record<string, IngestTypeStats>,
  source: Record<string, IngestTypeStats>,
): void {
  for (const [key, stats] of Object.entries(source)) {
    if (!target[key]) {
      target[key] = { created: 0, updated: 0, total: 0 };
    }
    target[key].created += stats.created;
    target[key].updated += stats.updated;
    target[key].total += stats.total;
  }
}

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

async function fetchAllAnnouncementsFromEgpForAgency(params: {
  deptId: string | null;
  deptsubId: string | null;
}): Promise<EgpAnnouncement[]> {
  const rss = normalizeRssDeptQueryParams({
    deptId: params.deptId,
    deptsubId: params.deptsubId,
  });

  const scopeKey = rssScopeKeyFromDeptParams(
    params.deptId,
    params.deptsubId,
  );

  const urls = ALL_EGP_ANNOUNCE_TYPES.map((anounceType) =>
    buildEgpRssUrl({
      deptId: rss.deptId,
      deptsubId: rss.deptsubId,
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
    return mapRssToAnnouncements(parsed, {
      rssScopeKeyForStableId: scopeKey || undefined,
    });
  });

  return allAnnouncementsArrays.flat();
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
        byAgencies: [],
        byDepartment: [],
        error: "Unauthorized",
      };
      return NextResponse.json(payload, { status: 401 });
    }
  }

  const activeAgencies = await prisma.egpAgency.findMany({
    where: { status: 1 },
    orderBy: { name: "asc" },
  });

  if (activeAgencies.length === 0) {
    const payload: IngestResult = {
      created: 0,
      updated: 0,
      totalFromRss: 0,
      byAnnounceType: {},
      byAgencies: [],
      byDepartment: [],
      error:
        "ไม่มีหน่วยงานที่ status = 1 (ใช้งาน) ในระบบ — ให้เพิ่มแถวใน EgpAgency (deptId และ/หรือ deptsubId) ก่อนรัน ingest",
    };
    return NextResponse.json(payload, { status: 422 });
  }

  const byAgencies: AgencyIngestSlice[] = [];
  const mergedByType: Record<string, IngestTypeStats> = {};
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalFromRss = 0;

  for (const agency of activeAgencies) {
    const scopeKey = rssScopeKeyFromDeptParams(agency.deptId, agency.deptsubId);
    const rss = normalizeRssDeptQueryParams({
      deptId: agency.deptId,
      deptsubId: agency.deptsubId,
    });

    const slice: AgencyIngestSlice = {
      agencyId: agency.id,
      name: agency.name,
      deptId: agency.deptId,
      deptsubId: agency.deptsubId,
      rssUses: rss.deptId ? "deptId" : rss.deptsubId ? "deptsubId" : null,
      created: 0,
      updated: 0,
      totalFromRss: 0,
      byAnnounceType: {},
    };

    if (!scopeKey) {
      slice.error =
        "ต้องระบุ deptId (หน่วยงานภาครัฐ) หรือ deptsubId (หน่วยจัดซื้อย่อย) อย่างน้อยหนึ่งค่า";
      byAgencies.push(slice);
      continue;
    }

    try {
      const announcements = await fetchAllAnnouncementsFromEgpForAgency({
        deptId: agency.deptId,
        deptsubId: agency.deptsubId,
      });

      slice.totalFromRss = announcements.length;
      totalFromRss += announcements.length;

      if (announcements.length === 0) {
        slice.error = "No announcements in RSS response";
        byAgencies.push(slice);
        continue;
      }

      const { created, updated, byAnnounceType } =
        await upsertAnnouncements(announcements, agency.id);

      slice.created = created;
      slice.updated = updated;
      slice.byAnnounceType = byAnnounceType;
      totalCreated += created;
      totalUpdated += updated;
      mergeByAnnounceType(mergedByType, byAnnounceType);
    } catch (err) {
      slice.error =
        err instanceof Error ? err.message : "Unknown error";
    }

    byAgencies.push(slice);
  }

  const payload: IngestResult = {
    created: totalCreated,
    updated: totalUpdated,
    totalFromRss,
    byAnnounceType: Object.fromEntries(
      Object.entries(mergedByType).map(([k, v]) => [
        k,
        { created: v.created, updated: v.updated, total: v.total },
      ]),
    ),
    byAgencies,
    byDepartment: byAgencies,
  };

  return NextResponse.json(payload, { status: 200 });
}
