# EGP RSS Fetcher — Optimization Spec (TypeScript / Next.js)

## 1. สถาปัตยกรรมระบบปัจจุบัน

### 1.1 Data flow

```
[EGP RSS XML]  gprocurement.go.th
      │
      ├─ GET /api/egp/announcements          ← on-demand (1 URL, ไม่มี retry/cache)
      │
      └─ GET /api/egp/announcements/ingest   ← bulk ingest ทุกหน่วยงาน status=1
              │
              ├─ fetch XML (per feed URL)
              ├─ mapRssToAnnouncements()      ← lib/egpRss.ts
              ├─ upsertAnnouncements()        ← lib/egpAnnouncementsService.ts → MySQL
              └─ egpIngestUrlLog              ← log ผลต่อ URL

[ผู้ใช้ UI]  /egp/announcements
      │
      └─ อ่านจาก DB ผ่าน /api/egp/projects/search  (ไม่ดึง RSS live)
```

### 1.2 ไฟล์หลัก

| ไฟล์ | หน้าที่ |
|------|---------|
| `lib/egpRss.ts` | `buildEgpRssUrl`, `buildRssDeptScopes`, `mapRssToAnnouncements` |
| `app/api/egp/announcements/ingest/route.ts` | ingest job, `fetchXmlFromUrl`, loop ดึง RSS, upsert, progress |
| `app/api/egp/announcements/route.ts` | API ดึง RSS แบบ on-demand (หน่วยงาน + ประเภทเดียว) |
| `app/egp/announcements/IngestButton.tsx` | UI กด ingest + poll progress ทุก 1.2s |
| `คู่มือตั้งเวลา Ingest e-GP อัตโนมัติ.md` | cron ภายนอกเรียก ingest รายวัน |

### 1.3 Ingest job lifecycle (มีอยู่แล้ว)

1. Client เรียก `GET /api/egp/announcements/ingest?token=...` → ได้ `jobId` (HTTP 202)
2. Server รัน `runIngest(jobId)` ใน background
3. Client poll `?jobId=...` → ได้ `progress` / `result`
4. Job state เก็บใน **in-memory `Map`** TTL 30 นาที (`INGEST_JOB_TTL_MS`)

> ข้อจำกัด deploy: ถ้ามีหลาย instance (serverless / load balancer) poll อาจเจอ 404 “อยู่คนละ instance” — เอกสาร cron ใช้ sync mode (`async=0`) หรือ sticky session แทนได้

---

## 2. วิเคราะห์ bottleneck และพฤติกรรมปัจจุบัน

### 2.1 Sequential สองชั้น

| ชั้น | ตำแหน่ง | พฤติกรรม |
|------|---------|----------|
| **หน่วยงาน** | `runIngest()` loop บรรทัด ~606 | วนทีละ `EgpAgency` ที่ `status = 1` |
| **RSS feed** | `fetchAllAnnouncementsFromEgpForAgency()` loop บรรทัด ~437 | วนทีละ URL ต่อหน่วยงาน |

จำนวน URL ต่อหน่วยงาน = `scopes.length × 9`  
(`ALL_EGP_ANNOUNCE_TYPES`: P0, 15, B0, D0, W0, D1, W1, D2, W2)

ตัวอย่าง: หน่วยงาน 1 scope → 9 feeds; ถ้า `deptId` มี 3 ค่า comma-separated → 27 feeds

โค้ดเดิมตั้งใจ sequential ที่ชั้น feed (คอมเมนต์: “ลดโหลดปลายทาง / ลดการแย่งช่องทาง”) แต่เมื่อหน่วยงานโตขึ้น bottleneck ชัดเจน

### 2.2 Retry / timeout ที่มีอยู่แล้ว

**ระดับ URL** — `fetchXmlFromUrl()`:

| พารามิเตอร์ | env | ค่า default |
|-------------|-----|-------------|
| Timeout ต่อ attempt | `EGP_RSS_FETCH_TIMEOUT_MS` | 15,000 ms |
| จำนวน retry | `EGP_RSS_FETCH_RETRIES` | 2 (รวม 3 attempts: attempt 0..2) |
| Backoff | — | linear `250 × (attempt + 1)` ms |

- Retry เฉพาะ **network/transient error** (`isRetryableFetchError`: AbortError, ETIMEDOUT, ECONNRESET, …)
- **HTTP error รวม 429**: `!response.ok` → throw ทันที **ไม่ retry**
- ล้มเหลวสุดท้าย: **throw** `Error` (ไม่ return null)

**ระดับหน่วยงาน** — `runIngest()`:

| พารามิเตอร์ | env | ค่า default |
|-------------|-----|-------------|
| Timeout ทั้งหน่วยงาน | `EGP_INGEST_AGENCY_TIMEOUT_MS` | 60,000 ms |
| Retry หน่วยงาน | — | 2 รอบ (attempt 0..1) |

### 2.3 Partial failure (สำคัญ — ต้องรักษาไว้)

- Feed บาง URL ล้มเหลว → บันทึกเป็น `rejected` ใน `RssFeedSettled[]` แต่ **ยัง parse feed ที่สำเร็จต่อได้**
- ถ้า **ทุก URL ล้มเหลว** → throw ที่ระดับหน่วยงาน
- บันทึก `EgpIngestUrlLog` ทุก feed (success/failed) พร้อม `httpStatus`, `durationMs`, `itemsParsed`
- `AgencyIngestSlice.warning` แจ้ง “ดึง RSS ได้บางส่วน (X/Y URL)”

### 2.4 Progress UI (ต้องออกแบบใหม่เมื่อ parallel)

`IngestButton.tsx` ใช้:

- `currentFeedIndex` / `totalFeeds` — คำนวณ % ภายในหน่วยงาน (`progressPercent`)
- `currentAnnounceType`, `currentRssScopeKey` — ข้อความ “กำลังดึง RSS … ประเภท P0 (3/9)”

ตอนนี้ `onFeedProgress` ถูกเรียก **ก่อน** fetch แต่ละ feed ตามลำดับ  
ถ้า parallel แบบ `Promise.all` ลำดับจะไม่ deterministic → ต้องเปลี่ยนเป็น **นับ feed ที่เสร็จแล้ว** (`completedFeeds / totalFeeds`)

---

## 3. เป้าหมาย refactor

Refactor ระบบ RSS fetcher **โดยไม่เปลี่ยน**:

- `EgpAnnouncement`, `EgpApiResponse`, `IngestResult`, `AgencyIngestSlice`
- `mapRssToAnnouncements`, parse XML, decode `win874`
- semantics partial failure + `EgpIngestUrlLog`
- การวนหน่วยงานทีละตัวใน `runIngest()` (ยังไม่ parallel ข้ามหน่วยงาน — ลดโอกาสโดน rate limit และง่ายต่อ agency timeout)

**แยกโมดูลใหม่:** `lib/egpRssFetcher.ts`  
ให้ `ingest/route.ts` และ `announcements/route.ts` เรียกใช้ร่วมกัน

---

## 4. แนวทางที่แนะนำ

### แนวทาง 1 — Parallel Fetching with Semaphore (ทำก่อน, คุณค่าสูงสุด)

เปลี่ยน loop ชั้น feed เป็น parallel จำกัด concurrent (แนะนำ 5)

**ประมาณการเวลา** (หน่วยงาน 9 feeds, ~2s/feed):

| โหมด | เวลาโดยประมาณ |
|------|----------------|
| Sequential (ปัจจุบัน) | ~18s |
| Parallel max 5 | ~4–6s |

#### API ที่เสนอ (ฟังก์ชันเดียว รวม retry แล้ว — ดูแนวทาง 3)

```typescript
// lib/egpRssFetcher.ts

export type FetchRssOutcome =
  | { ok: true; xml: string; httpStatus: number; fromCache: boolean }
  | { ok: false; error: string; httpStatus: number | null };

export interface FetchFeedsParallelOptions {
  maxConcurrent?: number;       // default 5, env EGP_RSS_MAX_CONCURRENT
  signal?: AbortSignal;
  timeoutMs?: number;           // env EGP_RSS_FETCH_TIMEOUT_MS
  maxRetries?: number;          // env EGP_RSS_FETCH_RETRIES
  skipCache?: boolean;          // true สำหรับ ingest (default true)
  onFeedCompleted?: (info: {
    completedFeeds: number;
    totalFeeds: number;
    announceType: string;
    scopeKey: string | null;
    url: string;
    outcome: FetchRssOutcome;
  }) => void | Promise<void>;
}

export async function fetchFeedsParallel(
  feeds: Array<{
    url: string;
    announceType: string;
    scopeKey: string | null;
    deptId: string | null;
    deptsubId: string | null;
  }>,
  options?: FetchFeedsParallelOptions,
): Promise<
  Array<{
    url: string;
    announceType: string;
    scopeKey: string | null;
    deptId: string | null;
    deptsubId: string | null;
    outcome: FetchRssOutcome;
    durationMs: number;
  }>
>;
```

#### integrate ใน ingest

แทน loop บรรทัด 437–471:

1. เรียก `fetchFeedsParallel(urls, { skipCache: true, signal, onFeedCompleted })`
2. map ผล → `RssFeedSettled[]` (fulfilled ถ้า `outcome.ok`, rejected ถ้าไม่ ok)
3. ใน `onFeedCompleted` อัปเดต `updateJobProgress` ด้วย `completedFeeds/totalFeeds` แทน `currentFeedIndex` แบบลำดับ

#### ปรับ progress type (optional แต่แนะนำ)

เพิ่มฟิลด์ใน `IngestJobProgress`:

```typescript
completedFeeds?: number;  // แทนการพึ่ง currentFeedIndex แบบลำดับ
```

และปรับ `IngestButton.progressPercent()` ให้ใช้ `completedFeeds / totalFeeds` แทน `currentFeedIndex / totalFeeds`

---

### แนวทาง 2 — In-Memory Cache with TTL (ใช้เฉพาะ on-demand)

Cache ลด request ซ้ำสำหรับ `GET /api/egp/announcements` เท่านั้น

| Path | ใช้ cache |
|------|-----------|
| `announcements/route.ts` | ใช่ (`skipCache: false`) |
| `ingest/route.ts` | **ไม่ใช้** (`skipCache: true`) — ingest ต้องการข้อมูลล่าสุดจาก EGP |

```typescript
export class RssCache {
  constructor(private readonly ttlMs: number = 300_000) {}
  get(url: string): string | undefined { /* ... */ }
  set(url: string, data: string): void { /* ... */ }
  invalidate(url: string): void { /* ... */ }
}

// singleton ต่อ Node process
export function getRssCache(): RssCache;
```

**ข้อจำกัด deploy:**

- `next start` (single process): cache ได้ผลดี
- Serverless / หลาย replica: hit rate ต่ำ, แต่ละ instance cache แยก — ระยะยาวพิจารณา Redis หรือพึ่ง DB หลัง ingest

**env ใหม่:** `EGP_RSS_CACHE_TTL_MS` (default `300000`)

---

### แนวทาง 3 — Retry with Exponential Backoff (รวมในฟังก์ชันเดียวกับแนวทาง 1)

ปรับปรุงจาก `fetchXmlFromUrl()` — **ไม่สร้างฟังก์ชัน fetch แยกซ้ำ**

| กรณี | ปัจจุบัน | หลัง refactor |
|------|----------|---------------|
| HTTP 429 | throw, ไม่ retry | retry + exponential backoff |
| Network error | retry linear | retry exponential |
| HTTP 4xx/5xx อื่น | throw, ไม่ retry | ไม่ retry (คงพฤติกรรมเดิม) |
| ล้มเหลวสุดท้าย | throw | return `{ ok: false, error, httpStatus }` — caller map เป็น `rejected` |

**สำคัญ:** acquire semaphore **ต่อ attempt** ไม่ hold ระหว่าง sleep backoff

```typescript
async function fetchRssXmlOnce(
  url: string,
  options: { signal?: AbortSignal; timeoutMs: number; skipCache: boolean },
): Promise<FetchRssOutcome> {
  if (!options.skipCache) {
    const cached = getRssCache().get(url);
    if (cached) return { ok: true, xml: cached, httpStatus: 200, fromCache: true };
  }
  // fetch + iconv.decode win874 ...
}

export async function fetchRssXmlWithRetry(
  url: string,
  options: { semaphore: Semaphore; signal?: AbortSignal; timeoutMs: number; maxRetries: number; skipCache: boolean },
): Promise<FetchRssOutcome> {
  let last: FetchRssOutcome = { ok: false, error: "unknown", httpStatus: null };

  for (let attempt = 0; attempt <= options.maxRetries; attempt += 1) {
    const release = await options.semaphore.acquire();
    try {
      const result = await fetchRssXmlOnce(url, options);
      if (result.ok) {
        if (!options.skipCache) getRssCache().set(url, result.xml);
        return result;
      }
      last = result;
      if (result.httpStatus === 429 && attempt < options.maxRetries) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      if (result.httpStatus !== null && result.httpStatus >= 400) {
        return result; // 4xx/5xx ไม่ retry (ยกเว้น 429 ด้านบน)
      }
    } catch (err) {
      last = { ok: false, error: formatError(err), httpStatus: null };
      if (attempt < options.maxRetries && isRetryableFetchError(err)) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
    } finally {
      release();
    }
  }
  return last;
}
```

ย้าย `isRetryableFetchError`, `formatFetchRootCause` จาก ingest route มาไว้ใน `egpRssFetcher.ts` (หรือ `lib/fetchUtils.ts`) เพื่อไม่ duplicate

---

### แนวทาง 4 — Background Scheduler (มีอยู่แล้วบางส่วน — เสริมไม่ใช่สร้างใหม่)

ระบบปัจจุบันรองรับ background ingest แล้ว:

- Async job API + progress polling
- คู่มือ cron Linux สำหรับรายวัน
- UI อ่านจาก DB ไม่ต้องรอ RSS live

```
[cron / Task Scheduler / Vercel Cron]
        ↓
GET /api/egp/announcements/ingest?token=...&async=0   ← sync สำหรับ cron ง่าย
หรือ async=1 (default) + poll jobId
        ↓
runIngest → fetchFeedsParallel → mapRssToAnnouncements → upsertAnnouncements
        ↓
/egp/announcements อ่านจาก DB
```

**เมื่อไหร่ต้องทำเพิ่ม:**

- หน่วยงาน > 50 และ ingest ใช้เวลาเกิน timeout ของ reverse proxy
- ต้องการ refresh ถี่กว่ารายวัน (เช่น ทุก 5 นาที) → ปรับ cron + พิจารณาลด `EGP_RSS_CACHE_TTL_MS` ไม่เกี่ยวกับ ingest

**ยังไม่แนะนำ:** parallel ข้ามหน่วยงานใน `runIngest()` — เสี่ยง rate limit และทำให้ agency timeout/retry ซับซ้อน

---

## 5. สิ่งที่ไม่ต้องเปลี่ยน

- Schema Prisma (`EgpAgency`, `EgpAnnouncement`, `EgpIngestUrlLog`)
- `mapRssToAnnouncements`, `fast-xml-parser`, decode `win874`
- `upsertAnnouncements`, dedupe logic
- การวนหน่วยงานทีละตัว + agency-level retry/timeout
- Ingest auth (`EGP_INGEST_SECRET` / `token` query)

---

## 6. ลำดับการ implement

| ลำดับ | งาน | ไฟล์ |
|-------|-----|------|
| 1 | สร้าง `lib/egpRssFetcher.ts` — Semaphore, `fetchRssXmlWithRetry`, `fetchFeedsParallel` | ใหม่ |
| 2 | แทน loop + `fetchXmlFromUrl` ใน `fetchAllAnnouncementsFromEgpForAgency` | `ingest/route.ts` |
| 3 | ปรับ `onFeedCompleted` + progress (`completedFeeds`) | `ingest/route.ts`, `IngestButton.tsx` |
| 4 | ใช้ fetcher ใน `announcements/route.ts` + เปิด cache | `announcements/route.ts` |
| 5 | ลบ helper ที่ย้ายแล้วออกจาก ingest route | `ingest/route.ts` |
| 6 | (optional) เพิ่ม Vitest + mock fetch | `lib/egpRssFetcher.test.ts` |

---

## 7. Environment variables (สรุป)

| ตัวแปร | มีอยู่แล้ว | Default | ใช้เมื่อ |
|--------|-----------|---------|----------|
| `EGP_RSS_FETCH_TIMEOUT_MS` | ใช่ | 15000 | timeout ต่อ attempt |
| `EGP_RSS_FETCH_RETRIES` | ใช่ | 2 | จำนวน retry ต่อ URL |
| `EGP_INGEST_AGENCY_TIMEOUT_MS` | ใช่ | 60000 | timeout ทั้งหน่วยงาน |
| `EGP_INGEST_SECRET` | ใช่ | — | auth ingest |
| `EGP_RSS_MAX_CONCURRENT` | **ใหม่** | 5 | parallel feeds ต่อหน่วยงาน |
| `EGP_RSS_CACHE_TTL_MS` | **ใหม่** | 300000 | cache on-demand route |

---

## 8. Acceptance Criteria

- [ ] ดึง RSS หลาย URL ต่อหน่วยงานพร้อมกัน จำกัด concurrent ไม่เกิน 5 (`EGP_RSS_MAX_CONCURRENT`)
- [ ] Ingest ใช้ `skipCache: true` เสมอ — ไม่มี stale data ตอน upsert
- [ ] On-demand route ใช้ cache — URL เดิมภายใน TTL ไม่ยิง network ซ้ำ
- [ ] HTTP 429 retry สูงสุด `EGP_RSS_FETCH_RETRIES` ครั้ง ด้วย exponential backoff
- [ ] Network error retry ได้; HTTP 4xx/5xx อื่น (ยกเว้น 429) ไม่ retry
- [ ] Feed ล้มเหลวรายตัว → `rejected` + log; feed สำเร็จบางส่วน → ingest ต่อได้ + `warning`
- [ ] ทุก feed ล้มเหลว → throw ที่ระดับหน่วยงาน (เหมือนเดิม)
- [ ] `EgpIngestUrlLog` ยังบันทึก `httpStatus`, `durationMs`, `itemsParsed`
- [ ] Progress UI แสดง `completedFeeds/totalFeeds` ได้ถูกต้องหลัง parallel
- [ ] Unit test: cache hit/miss, retry on 429, semaphore จำกัด concurrent

### ตัวอย่าง unit test (Vitest)

```bash
npm install -D vitest
```

```typescript
// lib/egpRssFetcher.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RssCache } from "./egpRssFetcher";

describe("RssCache", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("hit ภายใน TTL", () => {
    const cache = new RssCache(300_000);
    cache.set("https://example.com/rss", "<rss/>");
    expect(cache.get("https://example.com/rss")).toBe("<rss/>");
  });

  it("miss หลัง TTL", () => {
    const cache = new RssCache(300_000);
    cache.set("https://example.com/rss", "<rss/>");
    vi.advanceTimersByTime(301_000);
    expect(cache.get("https://example.com/rss")).toBeUndefined();
  });
});

// TODO: mock global fetch — ทดสอบ 429 retry และ concurrent limit
```

---

## 9. ความเสี่ยงและการตัดสินใจ

| หัวข้อ | การตัดสินใจ |
|--------|-------------|
| Parallel ข้ามหน่วยงาน | **ยังไม่ทำ** — rate limit + complexity |
| Cache ใน ingest | **ไม่ใช้** — ข้อมูลต้องสด |
| เปลี่ยน throw → outcome object | ทำเฉพาะใน fetcher; ingest map กลับเป็น `RssFeedSettled` เหมือนเดิม |
| `maxConcurrent = 5` | เริ่มจาก 5 ปรับตามผล `EgpIngestUrlLog` / 429 rate |
| Serverless multi-instance | job Map + cache ไม่ share — ใช้ sync ingest สำหรับ cron หรือ single instance |
