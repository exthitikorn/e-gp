/**
 * Seed mock failed ingest logs for testing /egp/status charts.
 * Usage: npm run seed:failed-logs
 * Cleanup: npm run seed:failed-logs -- --clean
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const JOB_ID = "seed-failed-logs-test";

type MockLog = {
  status: "failed";
  httpStatus: number | null;
  errorMessage: string;
  announceType: string;
  daysAgo: number;
};

const MOCK_LOGS: MockLog[] = [
  // 5xx — server errors
  { status: "failed", httpStatus: 500, errorMessage: "Internal Server Error", announceType: "P0", daysAgo: 0 },
  { status: "failed", httpStatus: 502, errorMessage: "Bad Gateway", announceType: "15", daysAgo: 0 },
  { status: "failed", httpStatus: 503, errorMessage: "Service Unavailable", announceType: "B0", daysAgo: 1 },
  { status: "failed", httpStatus: 500, errorMessage: "Internal Server Error", announceType: "D0", daysAgo: 1 },
  // 4xx — client errors
  { status: "failed", httpStatus: 404, errorMessage: "Not Found", announceType: "W0", daysAgo: 2 },
  { status: "failed", httpStatus: 429, errorMessage: "Too Many Requests", announceType: "D1", daysAgo: 2 },
  { status: "failed", httpStatus: 403, errorMessage: "Forbidden", announceType: "W1", daysAgo: 3 },
  // 2xx unexpected
  { status: "failed", httpStatus: 200, errorMessage: "Empty RSS body", announceType: "D2", daysAgo: 3 },
  // network (no httpStatus)
  { status: "failed", httpStatus: null, errorMessage: "fetch failed: ECONNRESET", announceType: "W2", daysAgo: 4 },
  { status: "failed", httpStatus: null, errorMessage: "fetch failed: ENOTFOUND rss.example.invalid", announceType: "P0", daysAgo: 4 },
  { status: "failed", httpStatus: null, errorMessage: "The operation was aborted due to timeout", announceType: "15", daysAgo: 5 },
  { status: "failed", httpStatus: null, errorMessage: "ETIMEDOUT connecting to host", announceType: "B0", daysAgo: 5 },
  { status: "failed", httpStatus: null, errorMessage: "network error during fetch", announceType: "D0", daysAgo: 6 },
  // extra counts for top-errors ranking
  { status: "failed", httpStatus: 500, errorMessage: "Internal Server Error", announceType: "W0", daysAgo: 6 },
  { status: "failed", httpStatus: 500, errorMessage: "Internal Server Error", announceType: "D1", daysAgo: 7 },
  { status: "failed", httpStatus: 429, errorMessage: "429 too many requests", announceType: "W1", daysAgo: 7 },
  { status: "failed", httpStatus: null, errorMessage: "fetch failed: ECONNRESET", announceType: "D2", daysAgo: 8 },
  { status: "failed", httpStatus: null, errorMessage: "fetch failed: ECONNRESET", announceType: "W2", daysAgo: 8 },
];

function daysAgoDate(daysAgo: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(12, 0, 0, 0);
  return d;
}

async function cleanSeedLogs() {
  const result = await prisma.egpIngestUrlLog.deleteMany({
    where: { jobId: JOB_ID },
  });
  console.log(`Deleted ${result.count} seed log(s) (jobId=${JOB_ID})`);
}

async function seedFailedLogs() {
  const agency = await prisma.egpAgency.findFirst({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  if (!agency) {
    console.error("No agency found. Create at least one agency at /egp/agencies first.");
    process.exit(1);
  }

  await cleanSeedLogs();

  const rows = MOCK_LOGS.map((log, i) => ({
    jobId: JOB_ID,
    agencyId: agency.id,
    url: `https://rss.example.invalid/seed/${log.announceType}/${i}`,
    announceType: log.announceType,
    rssScopeKey: `seed-${log.announceType}`,
    deptId: null,
    deptsubId: null,
    status: log.status,
    httpStatus: log.httpStatus,
    errorMessage: log.errorMessage,
    itemsParsed: null,
    durationMs: 800 + i * 50,
    createdAt: daysAgoDate(log.daysAgo),
  }));

  const result = await prisma.egpIngestUrlLog.createMany({ data: rows });

  console.log(`Created ${result.count} failed ingest log(s) for agency "${agency.name}"`);
  console.log(`Open http://localhost:3000/egp/status to view charts`);
  console.log(`Filter by jobId=${JOB_ID} in the log table if needed`);
  console.log(`Cleanup: npm run seed:failed-logs -- --clean`);
}