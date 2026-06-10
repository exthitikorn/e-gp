import type { HttpStatusBucket } from "@/lib/egpIngestStatusShared";

const HTTP_BUCKET_COLORS: Record<string, string> = {
  "2xx": "#fbbf24",
  "4xx": "#fb923c",
  "5xx": "#fb7185",
  "ไม่มี HTTP (network)": "#94a3b8",
};

const FALLBACK_COLOR = "#cbd5e1";

export function getHttpBucketColor(label: string): string {
  return HTTP_BUCKET_COLORS[label] ?? FALLBACK_COLOR;
}

export type HttpBucketChartRow = HttpStatusBucket & { fill: string };

export function prepareHttpBucketChartData(
  buckets: HttpStatusBucket[],
): HttpBucketChartRow[] {
  return buckets.map((bucket) => ({
    ...bucket,
    fill: getHttpBucketColor(bucket.label),
  }));
}

export function httpBucketLabelToParam(label: string): string | undefined {
  if (label === "ไม่มี HTTP (network)") return "network";
  if (label === "2xx" || label === "4xx" || label === "5xx") return label;
  const match = label.match(/^HTTP (\d+)$/);
  if (match) return match[1];
  return undefined;
}

export function httpBucketParamToLabel(param: string): string {
  if (param === "network") return "ไม่มี HTTP (network)";
  if (param === "2xx" || param === "4xx" || param === "5xx") return param;
  if (/^\d+$/.test(param)) return `HTTP ${param}`;
  return param;
}
