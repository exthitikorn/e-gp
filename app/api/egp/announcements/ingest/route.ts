import { NextResponse } from "next/server";
import iconv from "iconv-lite";
import {
  buildRssDeptScopes,
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

interface IngestJobStatus {
  jobId: string;
  status: "running" | "completed" | "failed";
  startedAt: string;
  finishedAt?: string;
}

/** ความคืบหน้าเมื่อรัน async — ประมวลผลทีละหน่วยงาน */
interface IngestJobProgress {
  totalAgencies: number;
  /** ลำดับหน่วยงานที่กำลังทำ (1-based) เทียบกับรายการที่ status = 1 */
  currentAgencyIndex: number;
  agencyId: string | null;
  agencyName: string | null;
  phase: "prepare" | "fetch" | "save" | "skip_invalid";
  /** ISO — ตั้งครั้งแรกเมื่อเริ่มดึง RSS หน่วยงานแรกที่ใช้งานได้ (ใช้นับเวลาใน UI) */
  fetchStartedAt?: string;
  /** ระหว่าง phase "fetch" — กำลังดึงฟีดลำดับที่เท่าไหร่จากทั้งหมดของหน่วยงานนี้ */
  currentFeedIndex?: number;
  totalFeeds?: number;
  /** รหัสประเภทประกาศใน query RSS (เช่น P0, D0) */
  currentAnnounceType?: string;
  /** คีย์ scope จาก buildRssDeptScopes (เช่น d:… / s:…) */
  currentRssScopeKey?: string | null;
}

interface IngestJobResponse {
  job: IngestJobStatus;
  result?: IngestResult;
  progress?: IngestJobProgress;
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
  warning?: string;
}

const EGP_INGEST_SECRET = process.env.EGP_INGEST_SECRET;
const INGEST_JOB_TTL_MS = 30 * 60 * 1000;
const DEFAULT_RSS_FETCH_TIMEOUT_MS = 15_000;
const RSS_FETCH_TIMEOUT_MS = (() => {
  const raw = process.env.EGP_RSS_FETCH_TIMEOUT_MS?.trim();
  if (!raw) {
    return DEFAULT_RSS_FETCH_TIMEOUT_MS;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_RSS_FETCH_TIMEOUT_MS;
})();
const DEFAULT_RSS_FETCH_RETRIES = 2;
const RSS_FETCH_RETRIES = (() => {
  const raw = process.env.EGP_RSS_FETCH_RETRIES?.trim();
  if (!raw) {
    return DEFAULT_RSS_FETCH_RETRIES;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_RSS_FETCH_RETRIES;
})();

/** ดึง RSS หลาย URL พร้อมกันต่อหน่วยงาน */
const DEFAULT_AGENCY_TIMEOUT_MS = 60_000;
const INGEST_AGENCY_TIMEOUT_MS = (() => {
  const raw = process.env.EGP_INGEST_AGENCY_TIMEOUT_MS?.trim();
  if (!raw) {
    return DEFAULT_AGENCY_TIMEOUT_MS;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_AGENCY_TIMEOUT_MS;
})();

function createIngestAgencyTimeoutError(ms: number): Error {
  const err = new Error(
    `หมดเวลารายหน่วยงาน (${Math.round(ms / 1000)} วินาที)`,
  );
  err.name = "IngestAgencyTimeoutError";
  if (typeof Error.captureStackTrace === "function") {
    Error.captureStackTrace(err, withTimeout);
  }
  return err;
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  onTimeout: () => void,
): Promise<T> {
  const timeoutErr = createIngestAgencyTimeoutError(ms);
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      fn();
    };

    const t = setTimeout(() => {
      onTimeout();
      finish(() => reject(timeoutErr));
    }, ms);

    promise.then(
      (v) => {
        clearTimeout(t);
        finish(() => resolve(v));
      },
      (e) => {
        clearTimeout(t);
        finish(() => reject(e));
      },
    );
  });
}

function formatAgencyIngestError(err: unknown): string {
  if (err instanceof Error && err.name === "IngestAgencyTimeoutError") {
    return err.message;
  }
  if (err instanceof Error && err.name === "AbortError") {
    return `หมดเวลารายหน่วยงาน (${Math.round(INGEST_AGENCY_TIMEOUT_MS / 1000)} วินาที)`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Unknown error";
}
const ingestJobs = new Map<
  string,
  {
    status: IngestJobStatus["status"];
    startedAt: string;
    finishedAt?: string;
    result?: IngestResult;
    progress?: IngestJobProgress;
  }
>();

function updateJobProgress(
  jobId: string | undefined,
  progress: IngestJobProgress,
): void {
  if (!jobId) {
    return;
  }
  const job = ingestJobs.get(jobId);
  if (!job || job.status !== "running") {
    return;
  }
  ingestJobs.set(jobId, { ...job, progress });
}

function ndjsonResponse(payload: IngestResult, status: number) {
  // NDJSON: 1 JSON object ต่อ 1 บรรทัด
  return new NextResponse(`${JSON.stringify(payload)}\n`, {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function jsonResponse(payload: IngestJobResponse, status: number) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}

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

function buildUnauthorizedResult(): IngestResult {
  return {
    created: 0,
    updated: 0,
    totalFromRss: 0,
    byAnnounceType: {},
    byAgencies: [],
    byDepartment: [],
    error: "Unauthorized",
  };
}

function buildNoActiveAgencyResult(): IngestResult {
  return {
    created: 0,
    updated: 0,
    totalFromRss: 0,
    byAnnounceType: {},
    byAgencies: [],
    byDepartment: [],
    error:
      "ไม่มีหน่วยงานที่ status = 1 (ใช้งาน) ในระบบ — ให้เพิ่มแถวใน EgpAgency (deptId และ/หรือ deptsubId) ก่อนรัน ingest",
  };
}

function safeErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "string") {
    return err;
  }
  return "Unknown error";
}

function formatFetchRootCause(err: unknown): string {
  if (!(err instanceof Error)) {
    return safeErrorMessage(err);
  }

  const withCause = err as Error & { cause?: unknown };
  const causeMessage = withCause.cause
    ? safeErrorMessage(withCause.cause)
    : undefined;

  const parts = [err.message];
  if (causeMessage && causeMessage !== err.message) {
    parts.push(`cause=${causeMessage}`);
  }

  const maybeCode = (withCause as { code?: unknown }).code;
  if (typeof maybeCode === "string") {
    parts.push(`code=${maybeCode}`);
  }

  return parts.join(" | ");
}

function isRetryableFetchError(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }

  if (err.name === "AbortError") {
    return true;
  }

  const msg = `${err.message} ${(err as Error & { cause?: unknown }).cause ?? ""}`.toLowerCase();
  return (
    msg.includes("fetch failed") ||
    msg.includes("etimedout") ||
    msg.includes("timeout") ||
    msg.includes("econnreset") ||
    msg.includes("eai_again") ||
    msg.includes("enotfound")
  );
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchXmlFromUrl(
  url: string,
  options?: { signal?: AbortSignal },
): Promise<string> {
  const retryCount = RSS_FETCH_RETRIES;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    const timeoutSignal = AbortSignal.timeout(RSS_FETCH_TIMEOUT_MS);
    const mergedSignal = options?.signal
      ? AbortSignal.any([options.signal, timeoutSignal])
      : timeoutSignal;

    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/xml,text/xml;q=0.9,*/*;q=0.8",
        },
        cache: "no-store",
        signal: mergedSignal,
      });

      if (!response.ok) {
        const bodyText = await response.text();
        throw new Error(
          `e-GP RSS error ${response.status} for ${url}: ${bodyText.slice(0, 200)}`,
        );
      }

      const buffer = await response.arrayBuffer();
      return iconv.decode(Buffer.from(buffer), "win874");
    } catch (err) {
      lastError = err;
      const canRetry = attempt < retryCount && isRetryableFetchError(err);
      if (!canRetry) {
        break;
      }
      await sleep(250 * (attempt + 1));
    }
  }

  throw new Error(
    `e-GP RSS fetch failed for ${url} after ${retryCount + 1} attempts: ${formatFetchRootCause(lastError)}`,
  );
}

async function fetchAllAnnouncementsFromEgpForAgency(
  params: {
    deptId: string | null;
    deptsubId: string | null;
  },
  options?: {
    signal?: AbortSignal;
    onFeedProgress?: (info: {
      feedIndex: number;
      totalFeeds: number;
      announceType: EgpAnnounceType;
      scopeKey: string | null;
    }) => void | Promise<void>;
  },
): Promise<{
  announcements: EgpAnnouncement[];
  failedFeedCount: number;
  totalFeedCount: number;
  failedFeedSamples: string[];
}> {
  const signal = options?.signal;
  const scopes = buildRssDeptScopes({
    deptId: params.deptId,
    deptsubId: params.deptsubId,
  });
  const urls = scopes.flatMap((scope) =>
    ALL_EGP_ANNOUNCE_TYPES.map((anounceType) => ({
      scopeKey: scope.scopeKey,
      announceType: anounceType,
      url: buildEgpRssUrl({
        deptId: scope.deptId,
        deptsubId: scope.deptsubId,
        anounceType,
      }),
    })),
  );

  /** ดึง RSS ทีละ URL ต่อหน่วยงาน (ลดโหลดปลายทาง / ลดการแย่งช่องทาง) */
  type RssFeedSettled =
    | { kind: "fulfilled"; scopeKey: string | null; xmlText: string }
    | { kind: "rejected"; url: string; message: string };
  const settled: RssFeedSettled[] = [];
  const onFeedProgress = options?.onFeedProgress;
  for (let fi = 0; fi < urls.length; fi += 1) {
    const item = urls[fi]!;
    await onFeedProgress?.({
      feedIndex: fi + 1,
      totalFeeds: urls.length,
      announceType: item.announceType,
      scopeKey: item.scopeKey,
    });
    try {
      const xmlText = await fetchXmlFromUrl(item.url, { signal });
      settled.push({ kind: "fulfilled", scopeKey: item.scopeKey, xmlText });
    } catch (err) {
      settled.push({
        kind: "rejected",
        url: item.url,
        message: formatFetchRootCause(err),
      });
    }
  }
  const xmlTexts = settled.filter((item) => item.kind === "fulfilled");
  const failedFeeds = settled.filter((item) => item.kind === "rejected");

  if (xmlTexts.length === 0) {
    const sample = failedFeeds
      .slice(0, 3)
      .map((item) => `${item.url} => ${item.message}`)
      .join(" | ");
    throw new Error(
      `ไม่สามารถดึง RSS ได้ (${failedFeeds.length}/${urls.length} URL): ${sample || "unknown error"}`,
    );
  }

  const { XMLParser } = await import("fast-xml-parser");
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
  });

  const allAnnouncementsArrays = xmlTexts.map((item) => {
    const parsed = parser.parse(item.xmlText) as ParsedRss;
    return mapRssToAnnouncements(parsed, {
      rssScopeKeyForStableId: item.scopeKey || undefined,
    });
  });

  return {
    announcements: allAnnouncementsArrays.flat(),
    failedFeedCount: failedFeeds.length,
    totalFeedCount: urls.length,
    failedFeedSamples: failedFeeds
      .slice(0, 3)
      .map((item) => `${item.url} => ${item.message}`),
  };
}

async function runIngest(jobId?: string): Promise<IngestResult> {
  const activeAgencies = await prisma.egpAgency.findMany({
    where: { status: 1 },
    orderBy: { name: "asc" },
  });

  if (activeAgencies.length === 0) {
    return buildNoActiveAgencyResult();
  }

  const totalAgencies = activeAgencies.length;
  /** จุดเริ่มจับเวลา “เริ่มดึงข้อมูล” (หลังเตรียมรายการแล้ว เริ่มจาก RSS หน่วยแรก) */
  let ingestFetchStartedAtIso: string | undefined;

  updateJobProgress(jobId, {
    totalAgencies,
    currentAgencyIndex: 0,
    agencyId: null,
    agencyName: null,
    phase: "prepare",
  });

  const byAgencies: AgencyIngestSlice[] = [];
  const mergedByType: Record<string, IngestTypeStats> = {};
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalFromRss = 0;

  for (let i = 0; i < activeAgencies.length; i += 1) {
    const agency = activeAgencies[i]!;
    const scopes = buildRssDeptScopes({
      deptId: agency.deptId,
      deptsubId: agency.deptsubId,
    });
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

    if (!scopeKey || scopes.length === 0) {
      slice.error =
        "ต้องระบุ deptId (หน่วยงานภาครัฐ) หรือ deptsubId (หน่วยจัดซื้อย่อย) อย่างน้อยหนึ่งค่า";
      updateJobProgress(jobId, {
        totalAgencies,
        currentAgencyIndex: i + 1,
        agencyId: agency.id,
        agencyName: agency.name,
        phase: "skip_invalid",
        ...(ingestFetchStartedAtIso
          ? { fetchStartedAt: ingestFetchStartedAtIso }
          : {}),
      });
      byAgencies.push(slice);
      continue;
    }

    if (!ingestFetchStartedAtIso) {
      ingestFetchStartedAtIso = new Date().toISOString();
    }
    updateJobProgress(jobId, {
      totalAgencies,
      currentAgencyIndex: i + 1,
      agencyId: agency.id,
      agencyName: agency.name,
      phase: "fetch",
      fetchStartedAt: ingestFetchStartedAtIso,
    });

    type AgencyIngestOutcome =
      | {
          kind: "empty";
          failedFeedCount: number;
          totalFeedCount: number;
          failedFeedSamples: string[];
        }
      | {
          kind: "ok";
          announcements: EgpAnnouncement[];
          created: number;
          updated: number;
          byAnnounceType: Record<string, IngestTypeStats>;
          failedFeedCount: number;
          totalFeedCount: number;
          failedFeedSamples: string[];
        };

    let outcome: AgencyIngestOutcome | null = null;
    let lastAgencyError: unknown;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (attempt === 1) {
        console.warn(
          `[egp/ingest] Retry หน่วยงาน "${agency.name}" (ครั้งที่ 2) หลังจากล้มเหลวครั้งแรก`,
        );
      }

      const abortController = new AbortController();
      try {
        const inner = await withTimeout(
          (async (): Promise<AgencyIngestOutcome> => {
            const fetched = await fetchAllAnnouncementsFromEgpForAgency(
              {
                deptId: agency.deptId,
                deptsubId: agency.deptsubId,
              },
              {
                signal: abortController.signal,
                onFeedProgress: async (feed) => {
                  updateJobProgress(jobId, {
                    totalAgencies,
                    currentAgencyIndex: i + 1,
                    agencyId: agency.id,
                    agencyName: agency.name,
                    phase: "fetch",
                    fetchStartedAt: ingestFetchStartedAtIso,
                    currentFeedIndex: feed.feedIndex,
                    totalFeeds: feed.totalFeeds,
                    currentAnnounceType: feed.announceType,
                    currentRssScopeKey: feed.scopeKey,
                  });
                },
              },
            );
            if (fetched.announcements.length === 0) {
              return {
                kind: "empty",
                failedFeedCount: fetched.failedFeedCount,
                totalFeedCount: fetched.totalFeedCount,
                failedFeedSamples: fetched.failedFeedSamples,
              };
            }
            updateJobProgress(jobId, {
              totalAgencies,
              currentAgencyIndex: i + 1,
              agencyId: agency.id,
              agencyName: agency.name,
              phase: "save",
              ...(ingestFetchStartedAtIso
                ? { fetchStartedAt: ingestFetchStartedAtIso }
                : {}),
            });
            const { created, updated, byAnnounceType } =
              await upsertAnnouncements(fetched.announcements, agency.id);
            return {
              kind: "ok",
              announcements: fetched.announcements,
              created,
              updated,
              byAnnounceType,
              failedFeedCount: fetched.failedFeedCount,
              totalFeedCount: fetched.totalFeedCount,
              failedFeedSamples: fetched.failedFeedSamples,
            };
          })(),
          INGEST_AGENCY_TIMEOUT_MS,
          () => abortController.abort(),
        );

        outcome = inner;
        lastAgencyError = undefined;
        break;
      } catch (err) {
        lastAgencyError = err;
        const msg = formatAgencyIngestError(err);
        if (attempt === 0) {
          console.warn(
            `[egp/ingest] หน่วยงาน "${agency.name}" ล้มเหลว จะ retry อีก 1 ครั้ง: ${msg}`,
          );
          continue;
        }
        console.warn(
          `[egp/ingest] หน่วยงาน "${agency.name}" ล้มเหลวหลัง retry: ${msg}`,
        );
      }
    }

    if (outcome?.kind === "empty") {
      slice.error = "No announcements in RSS response";
      if (outcome.failedFeedCount > 0) {
        slice.warning =
          `ดึง RSS ได้บางส่วน (${outcome.totalFeedCount - outcome.failedFeedCount}/${outcome.totalFeedCount} URL)` +
          (outcome.failedFeedSamples.length > 0
            ? ` ตัวอย่างที่ล้มเหลว: ${outcome.failedFeedSamples.join(" | ")}`
            : "");
      }
    } else if (outcome?.kind === "ok") {
      slice.totalFromRss = outcome.announcements.length;
      totalFromRss += outcome.announcements.length;
      slice.created = outcome.created;
      slice.updated = outcome.updated;
      slice.byAnnounceType = outcome.byAnnounceType;
      if (outcome.failedFeedCount > 0) {
        slice.warning =
          `ดึง RSS ได้บางส่วน (${outcome.totalFeedCount - outcome.failedFeedCount}/${outcome.totalFeedCount} URL)` +
          (outcome.failedFeedSamples.length > 0
            ? ` ตัวอย่างที่ล้มเหลว: ${outcome.failedFeedSamples.join(" | ")}`
            : "");
      }
      totalCreated += outcome.created;
      totalUpdated += outcome.updated;
      mergeByAnnounceType(mergedByType, outcome.byAnnounceType);
    } else if (lastAgencyError !== undefined) {
      slice.error = `${formatAgencyIngestError(lastAgencyError)} (ลองซ้ำ 1 ครั้งแล้ว)`;
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

  return payload;
}

function createJobId() {
  return crypto.randomUUID();
}

function getJobStatus(jobId: string): IngestJobStatus | null {
  const job = ingestJobs.get(jobId);
  if (!job) {
    return null;
  }

  return {
    jobId,
    status: job.status,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  };
}

function scheduleJobCleanup(jobId: string) {
  setTimeout(() => {
    ingestJobs.delete(jobId);
  }, INGEST_JOB_TTL_MS).unref?.();
}

function startIngestJob(): string {
  const jobId = createJobId();
  const startedAt = new Date().toISOString();

  ingestJobs.set(jobId, {
    status: "running",
    startedAt,
  });

  void runIngest(jobId)
    .then((result) => {
      ingestJobs.set(jobId, {
        status: "completed",
        startedAt,
        finishedAt: new Date().toISOString(),
        result,
        progress: undefined,
      });
      scheduleJobCleanup(jobId);
    })
    .catch((error: unknown) => {
      ingestJobs.set(jobId, {
        status: "failed",
        startedAt,
        finishedAt: new Date().toISOString(),
        progress: undefined,
        result: {
          created: 0,
          updated: 0,
          totalFromRss: 0,
          byAnnounceType: {},
          byAgencies: [],
          byDepartment: [],
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
      scheduleJobCleanup(jobId);
    });

  return jobId;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (EGP_INGEST_SECRET) {
    const token = url.searchParams.get("token");
    if (!token || token !== EGP_INGEST_SECRET) {
      return ndjsonResponse(buildUnauthorizedResult(), 401);
    }
  }

  const jobId = url.searchParams.get("jobId");
  if (jobId) {
    const status = getJobStatus(jobId);
    if (!status) {
      return jsonResponse(
        {
          job: {
            jobId,
            status: "failed",
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
          },
          result: {
            created: 0,
            updated: 0,
            totalFromRss: 0,
            byAnnounceType: {},
            byAgencies: [],
            byDepartment: [],
            error: "ไม่พบงาน ingest นี้ (อาจหมดอายุหรืออยู่คนละ instance)",
          },
        },
        404,
      );
    }

    const job = ingestJobs.get(jobId);
    return jsonResponse(
      {
        job: status,
        result: job?.result,
        progress: job?.status === "running" ? job.progress : undefined,
      },
      200,
    );
  }

  const startAsync = url.searchParams.get("async") !== "0";
  if (startAsync) {
    const createdJobId = startIngestJob();
    const status = getJobStatus(createdJobId);
    if (!status) {
      return jsonResponse(
        {
          job: {
            jobId: createdJobId,
            status: "failed",
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
          },
          result: {
            created: 0,
            updated: 0,
            totalFromRss: 0,
            byAnnounceType: {},
            byAgencies: [],
            byDepartment: [],
            error: "เริ่มงาน ingest ไม่สำเร็จ",
          },
        },
        500,
      );
    }

    return jsonResponse({ job: status }, 202);
  }

  const payload = await runIngest();
  if (payload.error?.includes("ไม่มีหน่วยงานที่ status = 1")) {
    return ndjsonResponse(payload, 422);
  }
  return ndjsonResponse(payload, 200);
}
