import iconv from "iconv-lite";

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

const DEFAULT_RSS_MAX_CONCURRENT = 5;
const RSS_MAX_CONCURRENT = (() => {
  const raw = process.env.EGP_RSS_MAX_CONCURRENT?.trim();
  if (!raw) {
    return DEFAULT_RSS_MAX_CONCURRENT;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_RSS_MAX_CONCURRENT;
})();

/** จำกัดจำนวน async task ที่รันพร้อมกัน */
export class Semaphore {
  private queue: Array<() => void> = [];
  private active = 0;

  constructor(private readonly max: number) {}

  async acquire(): Promise<() => void> {
    if (this.active < this.max) {
      this.active += 1;
      return () => this.release();
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active += 1;
    return () => this.release();
  }

  private release(): void {
    this.active -= 1;
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }
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

export function formatFetchRootCause(err: unknown): string {
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

export async function fetchXmlFromUrl(
  url: string,
  options?: { signal?: AbortSignal; semaphore?: Semaphore },
): Promise<{ xml: string; httpStatus: number }> {
  const retryCount = RSS_FETCH_RETRIES;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    const release = options?.semaphore
      ? await options.semaphore.acquire()
      : undefined;
    let shouldRetry = false;

    try {
      const timeoutSignal = AbortSignal.timeout(RSS_FETCH_TIMEOUT_MS);
      const mergedSignal = options?.signal
        ? AbortSignal.any([options.signal, timeoutSignal])
        : timeoutSignal;

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
      const xml = iconv.decode(Buffer.from(buffer), "win874");
      return { xml, httpStatus: response.status };
    } catch (err) {
      lastError = err;
      shouldRetry = attempt < retryCount && isRetryableFetchError(err);
      if (!shouldRetry) {
        break;
      }
    } finally {
      release?.();
    }

    if (shouldRetry) {
      await sleep(250 * (attempt + 1));
    }
  }

  throw new Error(
    `e-GP RSS fetch failed for ${url} after ${retryCount + 1} attempts: ${formatFetchRootCause(lastError)}`,
  );
}

export type RssFeedItem = {
  url: string;
  announceType: string;
  scopeKey: string | null;
  deptId: string | null;
  deptsubId: string | null;
};

export type FetchFeedResult =
  | {
      kind: "fulfilled";
      xml: string;
      httpStatus: number;
      durationMs: number;
      feed: RssFeedItem;
    }
  | {
      kind: "rejected";
      message: string;
      durationMs: number;
      feed: RssFeedItem;
    };

export async function fetchFeedsParallel(
  feeds: RssFeedItem[],
  options?: {
    signal?: AbortSignal;
    maxConcurrent?: number;
    onFeedCompleted?: (info: {
      completedFeeds: number;
      totalFeeds: number;
      feed: RssFeedItem;
      result: FetchFeedResult;
    }) => void | Promise<void>;
  },
): Promise<FetchFeedResult[]> {
  if (feeds.length === 0) {
    return [];
  }

  const semaphore = new Semaphore(
    options?.maxConcurrent ?? RSS_MAX_CONCURRENT,
  );
  const totalFeeds = feeds.length;
  let completedFeeds = 0;
  const onFeedCompleted = options?.onFeedCompleted;

  return Promise.all(
    feeds.map(async (feed) => {
      const t0 = Date.now();
      try {
        const { xml, httpStatus } = await fetchXmlFromUrl(feed.url, {
          signal: options?.signal,
          semaphore,
        });
        const result: FetchFeedResult = {
          kind: "fulfilled",
          xml,
          httpStatus,
          durationMs: Date.now() - t0,
          feed,
        };
        completedFeeds += 1;
        await onFeedCompleted?.({
          completedFeeds,
          totalFeeds,
          feed,
          result,
        });
        return result;
      } catch (err) {
        const result: FetchFeedResult = {
          kind: "rejected",
          message: formatFetchRootCause(err),
          durationMs: Date.now() - t0,
          feed,
        };
        completedFeeds += 1;
        await onFeedCompleted?.({
          completedFeeds,
          totalFeeds,
          feed,
          result,
        });
        return result;
      }
    }),
  );
}
