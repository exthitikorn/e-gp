"use client";

import { Activity } from "lucide-react";
import { useEffect, useState } from "react";

interface AgencyIngestSlice {
  agencyId: string;
  name: string;
  deptId: string | null;
  deptsubId: string | null;
  rssUses: "deptId" | "deptsubId" | null;
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
  byAgencies?: AgencyIngestSlice[];
  /** alias เดิมจาก API ingest */
  byDepartment?: AgencyIngestSlice[];
  error?: string;
}

interface IngestJobStatus {
  jobId: string;
  status: "running" | "completed" | "failed";
  startedAt: string;
  finishedAt?: string;
}

interface IngestJobProgress {
  totalAgencies: number;
  currentAgencyIndex: number;
  agencyId: string | null;
  agencyName: string | null;
  phase: "prepare" | "fetch" | "save" | "skip_invalid";
  /** ISO — จากเซิร์ฟเวอร์ เริ่มนับเมื่อเริ่มดึง RSS ครั้งแรก */
  fetchStartedAt?: string;
  currentFeedIndex?: number;
  totalFeeds?: number;
  currentAnnounceType?: string;
  currentRssScopeKey?: string | null;
}

interface IngestJobResponse {
  job: IngestJobStatus;
  result?: IngestResult;
  progress?: IngestJobProgress;
}

const ingestToken = process.env.NEXT_PUBLIC_EGP_INGEST_SECRET;
const POLL_INTERVAL_MS = 1200;
/** งาน ingest หลายหน่วยงานอาจใช้เวลานาน — โพลจนกว่าจะเสร็จหรือเกินเวลานี้ */
const MAX_POLL_DURATION_MS = 25 * 60 * 1000;

function progressPercent(p: IngestJobProgress): number {
  const n = p.totalAgencies;
  if (n <= 0) {
    return 0;
  }
  if (p.phase === "prepare" || p.currentAgencyIndex <= 0) {
    return 3;
  }
  const i = p.currentAgencyIndex;
  const totalFeeds = p.totalFeeds ?? 0;
  const feedIdx = p.currentFeedIndex ?? 0;
  const fetchSlotWithinAgency =
    totalFeeds > 0 && feedIdx > 0
      ? Math.min(0.58, (feedIdx / totalFeeds) * 0.58)
      : 0.25;
  const slot =
    p.phase === "fetch"
      ? i - 1 + fetchSlotWithinAgency
      : p.phase === "save"
        ? i - 1 + 0.72
        : p.phase === "skip_invalid"
          ? i
          : i - 1;
  return Math.min(100, Math.round((slot / n) * 100));
}

function formatElapsedSince(isoStart: string, nowMs: number): string {
  const start = Date.parse(isoStart);
  if (Number.isNaN(start)) {
    return "—";
  }
  const totalSec = Math.max(0, Math.floor((nowMs - start) / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

function progressDescription(p: IngestJobProgress): string {
  const n = p.totalAgencies;
  if (p.phase === "prepare") {
    return `เตรียมดึงข้อมูล ${n} หน่วยงาน`;
  }
  const idx = p.currentAgencyIndex;
  const name = p.agencyName?.trim() || "หน่วยงาน";
  if (p.phase === "skip_invalid") {
    return `ข้ามการตั้งค่า RSS (${idx}/${n}): ${name}`;
  }
  if (p.phase === "fetch") {
    const feedPart =
      p.totalFeeds && p.currentFeedIndex && p.currentAnnounceType
        ? ` — ประเภท ${p.currentAnnounceType} (${p.currentFeedIndex}/${p.totalFeeds})`
        : "";
    const scopePart =
      p.currentRssScopeKey != null && String(p.currentRssScopeKey).trim() !== ""
        ? ` · รหัสหน่วยงาน ${p.currentRssScopeKey}`
        : "";
    return `กำลังดึง RSS จาก e-GP (${idx}/${n}): ${name}${feedPart}${scopePart}`;
  }
  return `กำลังบันทึกลงฐานข้อมูล (${idx}/${n}): ${name}`;
}

export function IngestButton() {
  const [isLoading, setIsLoading] = useState(false);
  /** แผงรายละเอียดความคืบหน้า — เริ่มย่อ; กดไอคอนมุมขวาล่างเพื่อเปิด */
  const [isBackgroundProgressOpen, setIsBackgroundProgressOpen] =
    useState(false);
  const [isResultVisible, setIsResultVisible] = useState(false);
  const [summaryStats, setSummaryStats] = useState<{
    created: number;
    updated: number;
    totalFromRss: number;
    /** รอบนี้ไม่มีรายการจาก RSS และไม่มีการบันทึก — ไม่ใช่ “สำเร็จแบบมีข้อมูลใหม่” */
    isEmptyRound: boolean;
  } | null>(null);
  const [typeStats, setTypeStats] = useState<
    Array<{
      type: string;
      created: number;
      updated: number;
      total: number;
    }>
  >([]);
  const [agencySlices, setAgencySlices] = useState<AgencyIngestSlice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ingestProgress, setIngestProgress] =
    useState<IngestJobProgress | null>(null);
  const [ingestElapsedNow, setIngestElapsedNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isLoading || !ingestProgress?.fetchStartedAt) {
      return;
    }
    const tick = () => setIngestElapsedNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isLoading, ingestProgress?.fetchStartedAt]);

  const handleClick = async () => {
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    setSummaryStats(null);
    setTypeStats([]);
    setAgencySlices([]);
    setError(null);
    setIsResultVisible(false);
    setIsBackgroundProgressOpen(false);
    setIngestProgress(null);

    try {
      const baseIngestUrl = new URL(
        "/api/egp/announcements/ingest",
        window.location.origin,
      );
      if (ingestToken) {
        baseIngestUrl.searchParams.set("token", ingestToken);
      }

      const startUrl = new URL(baseIngestUrl.toString());
      startUrl.searchParams.set("async", "1");

      const startResponse = await fetch(startUrl.toString(), {
        method: "GET",
        cache: "no-store",
      });
      const startData: IngestJobResponse = await startResponse.json();

      if (startResponse.status === 401) {
        if (!ingestToken) {
          setError(
            "Unauthorized: กรุณาตั้งค่า NEXT_PUBLIC_EGP_INGEST_SECRET ให้ตรงกับ EGP_INGEST_SECRET",
          );
          return;
        }
        setError(startData.result?.error || "Unauthorized");
        return;
      }

      if (!startResponse.ok || !startData.job?.jobId) {
        setError(startData.result?.error || "เริ่มงาน ingest ไม่สำเร็จ");
        return;
      }

      let ingestResult: IngestResult | undefined;
      let ingestStatus: IngestJobStatus["status"] = startData.job.status;
      const pollStartedAt = Date.now();

      while (ingestStatus === "running") {
        if (Date.now() - pollStartedAt > MAX_POLL_DURATION_MS) {
          break;
        }

        const statusUrl = new URL(baseIngestUrl.toString());
        statusUrl.searchParams.set("jobId", startData.job.jobId);

        const statusResponse = await fetch(statusUrl.toString(), {
          method: "GET",
          cache: "no-store",
        });
        const statusData: IngestJobResponse = await statusResponse.json();

        ingestStatus = statusData.job?.status ?? "failed";
        ingestResult = statusData.result;
        if (statusData.progress) {
          setIngestProgress(statusData.progress);
        }

        if (ingestStatus !== "running") {
          break;
        }

        await new Promise((resolve) => {
          setTimeout(resolve, POLL_INTERVAL_MS);
        });
      }

      if (ingestStatus === "running") {
        setError(
          "งาน ingest ยังไม่เสร็จภายในเวลาที่กำหนด กรุณาลองใหม่อีกครั้งเพื่อตรวจสถานะ",
        );
        setIngestProgress(null);
        return;
      }

      if (!ingestResult) {
        setError("ไม่ได้รับผลลัพธ์จากงาน ingest");
        setIngestProgress(null);
        return;
      }

      if (ingestResult.error) {
        if (ingestResult.error.includes("ไม่มีหน่วยงานที่ status = 1")) {
          setError(
            "ยังไม่มีหน่วยงานที่ status = 1 ในฐานข้อมูล — ให้เพิ่ม EgpAgency ก่อน",
          );
          setIngestProgress(null);
          return;
        }
        setError(ingestResult.error || "ดึงข้อมูลไม่สำเร็จ");
        setIngestProgress(null);
        return;
      }

      setIngestProgress(null);
      const isEmptyRound =
        ingestResult.created === 0 &&
        ingestResult.updated === 0 &&
        ingestResult.totalFromRss === 0;
      setSummaryStats({
        created: ingestResult.created,
        updated: ingestResult.updated,
        totalFromRss: ingestResult.totalFromRss,
        isEmptyRound,
      });
      const sortedTypeStats = Object.entries(ingestResult.byAnnounceType ?? {})
        .map(([type, stats]) => ({
          type,
          created: stats.created,
          updated: stats.updated,
          total: stats.total,
        }))
        .sort((a, b) => b.total - a.total);
      setTypeStats(sortedTypeStats);
      setAgencySlices(
        ingestResult.byAgencies ?? ingestResult.byDepartment ?? [],
      );
      setIsResultVisible(true);
    } catch {
      setError("เกิดข้อผิดพลาดระหว่างดึงข้อมูลจาก e-GP");
      setIngestProgress(null);
    } finally {
      setIsLoading(false);
    }
  };

  function rssLabel(slice: AgencyIngestSlice): string {
    if (slice.rssUses === "deptId" && slice.deptId) {
      return `RSS: deptId ${slice.deptId}`;
    }
    if (slice.rssUses === "deptsubId" && slice.deptsubId) {
      return `RSS: deptsubId ${slice.deptsubId}`;
    }
    return "RSS: —";
  }

  return (
    <div className="mt-4 space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className="inline-flex items-center rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-medium text-slate-950 shadow hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-700"
      >
        {isLoading ? "กำลังดึงข้อมูลจาก e-GP..." : "ดึงข้อมูลจาก e-GP"}
      </button>
      {isLoading && (
        <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2 sm:bottom-6 sm:right-6">
          {isBackgroundProgressOpen && (
            <div
              id="egp-ingest-progress-panel"
              className="w-[min(100vw-2.5rem,22rem)] space-y-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-xl"
              role="region"
              aria-label="สถานะความคืบหน้าการดึงข้อมูลจาก e-GP"
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <span className="text-[11px] font-semibold text-slate-600">
                  กำลังดึงข้อมูล (พื้นหลัง)
                </span>
                <button
                  type="button"
                  onClick={() => setIsBackgroundProgressOpen(false)}
                  className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-slate-200 bg-white px-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                  aria-label="ย่อแผงความคืบหน้า"
                >
                  ย่อ
                </button>
              </div>
              {ingestProgress ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-medium text-slate-500">
                      ความคืบหน้า
                    </span>
                    {ingestProgress.fetchStartedAt ? (
                      <span
                        className="font-mono text-[10px] tabular-nums text-slate-600"
                        title="นับจากเริ่มดึงข้อมูลจาก e-GP"
                      >
                        {formatElapsedSince(
                          ingestProgress.fetchStartedAt,
                          ingestElapsedNow,
                        )}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">
                        รอเริ่มดึง…
                      </span>
                    )}
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 ease-out"
                      style={{
                        width: `${progressPercent(ingestProgress)}%`,
                      }}
                    />
                  </div>
                  <p
                    className="text-[11px] leading-snug text-slate-700 wrap-break-word"
                    aria-live="polite"
                  >
                    {progressDescription(ingestProgress)}
                  </p>
                </>
              ) : (
                <p className="text-[11px] leading-snug text-slate-600">
                  กำลังเริ่มงานและเชื่อมต่อ e-GP…
                </p>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsBackgroundProgressOpen((open) => !open)}
            className="relative inline-flex h-12 w-12 items-center justify-center rounded-full border border-emerald-600 bg-emerald-500 text-white shadow-lg ring-2 ring-emerald-200/60 hover:bg-emerald-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            aria-expanded={isBackgroundProgressOpen}
            aria-controls={
              isBackgroundProgressOpen ? "egp-ingest-progress-panel" : undefined
            }
            title={
              isBackgroundProgressOpen
                ? "ปิดแผงความคืบหน้า"
                : "เปิดสถานะความคืบหน้าการดึงข้อมูลจาก e-GP"
            }
          >
            <span className="absolute inset-0 rounded-full bg-emerald-400/30 animate-ping [animation-duration:2s]" />
            <span className="relative">
              <Activity
                size={22}
                strokeWidth={2}
                className="shrink-0"
                aria-hidden
              />
            </span>
            {ingestProgress && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-900 px-1 text-[9px] font-bold tabular-nums text-white ring-2 ring-white">
                {progressPercent(ingestProgress)}%
              </span>
            )}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
      {summaryStats && isResultVisible && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="ผลลัพธ์การดึงข้อมูลจาก e-GP"
        >
          <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800">
                ผลลัพธ์การดึงข้อมูลจาก e-GP
              </p>
              <button
                type="button"
                onClick={() => setIsResultVisible(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-100"
                aria-label="ปิดผลลัพธ์การดึงข้อมูล"
              >
                ×
              </button>
            </div>

            <div
              className={
                summaryStats.isEmptyRound
                  ? "rounded-lg border border-amber-200 bg-amber-50 p-2.5"
                  : "rounded-lg border border-emerald-200 bg-emerald-50 p-2.5"
              }
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <p
                  className={
                    summaryStats.isEmptyRound
                      ? "text-xs font-semibold text-amber-900"
                      : "text-xs font-semibold text-emerald-700"
                  }
                >
                  {summaryStats.isEmptyRound
                    ? "รอบนี้ไม่มีข้อมูลจาก RSS"
                    : "ดึงข้อมูลสำเร็จ"}
                </p>
              </div>
              {summaryStats.isEmptyRound && (
                <p className="mb-2 text-[11px] leading-snug text-amber-950/80">
                  งาน ingest จบปกติแต่ไม่มีรายการจาก RSS และไม่มีแถวใหม่/แก้ไขใน
                  DB — มักเกิดเมื่อ RSS ว่าง หน่วยงานตั้งค่าไม่ครบ
                  หรือเซิร์ฟเวอร์ e-GP ไม่ตอบ ลองดูรายละเอียดตามหน่วยงานด้านล่าง
                </p>
              )}
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={
                    summaryStats.isEmptyRound
                      ? "rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900"
                      : "rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800"
                  }
                >
                  เพิ่ม {summaryStats.created} รายการ
                </span>
                <span
                  className={
                    summaryStats.isEmptyRound
                      ? "rounded-full border border-amber-300 bg-amber-100/80 px-2 py-0.5 text-[11px] font-semibold text-amber-900"
                      : "rounded-full border border-sky-300 bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800"
                  }
                >
                  แก้ไข {summaryStats.updated} รายการ
                </span>
                <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                  รวมจาก RSS {summaryStats.totalFromRss} รายการ
                </span>
              </div>
            </div>

            {agencySlices.length > 0 &&
              (agencySlices.length > 1 || summaryStats.isEmptyRound) && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                  <p className="mb-2 text-xs font-semibold text-slate-700">
                    สรุปตามหน่วยงาน
                  </p>
                  <ul className="space-y-2">
                    {agencySlices.map((d) => (
                      <li
                        key={d.agencyId}
                        className="rounded border border-slate-200 bg-slate-50 px-2 py-2 text-xs"
                      >
                        <div className="font-medium text-slate-800">
                          {d.name}
                        </div>
                        <div className="text-[11px] text-slate-600">
                          {rssLabel(d)}
                        </div>
                        {d.error ? (
                          <p className="mt-1 text-[11px] text-red-600">
                            {d.error}
                          </p>
                        ) : (
                          <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                            <span className="text-slate-600">
                              RSS {d.totalFromRss} รายการ
                            </span>
                            <span className="text-emerald-700">
                              +{d.created}
                            </span>
                            <span className="text-sky-700">~{d.updated}</span>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {agencySlices.length === 1 &&
              agencySlices[0]?.error &&
              !summaryStats.isEmptyRound && (
                <p className="mt-3 text-xs text-amber-700">
                  {agencySlices[0].name}: {agencySlices[0].error}
                </p>
              )}

            {typeStats.length > 0 && (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-white p-3">
                <p className="mb-2 text-xs font-semibold text-slate-700">
                  สรุปตามประเภทประกาศ
                </p>
                <ul className="space-y-1">
                  {typeStats.map((item) => (
                    <li
                      key={item.type}
                      className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                    >
                      <span className="font-medium text-slate-700">
                        {item.type}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                          รวม {item.total}
                        </span>
                        <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                          เพิ่ม {item.created}
                        </span>
                        <span className="rounded-full border border-sky-300 bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
                          แก้ไข {item.updated}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
