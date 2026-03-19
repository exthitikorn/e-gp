"use client";

import { useState } from "react";

type ParsedFields = {
  centralPriceBaht?: string;
  winnerName?: string;
  winnerAmountBaht?: string;
};

function parseCentralPriceToNumber(raw?: string): number | null {
  if (!raw) return null;
  const normalized = raw.replace(/[,\s]+/g, "").trim();
  if (!normalized) return null;

  // รองรับทั้ง "27000000" และ "27000000.00"
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return value;
}

function formatCentralPrice(raw?: string): string | null {
  const value = parseCentralPriceToNumber(raw);
  if (value === null) return null;

  const formatter = new Intl.NumberFormat("th-TH", {
    useGrouping: true,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return formatter.format(value);
}

function formatWinnerAmount(raw?: string): string | null {
  return formatCentralPrice(raw);
}

interface PdfParseButtonProps {
  announcementId: string;
  announceType: string | null;
  canParse: boolean;
}

export function PdfParseButton({
  announcementId,
  announceType,
  canParse,
}: PdfParseButtonProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ParsedFields | null>(null);

  const handleClick = async () => {
    if (!canParse || isPending) return;

    setIsPending(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(
        `/api/egp/announcements/parse-pdf?id=${encodeURIComponent(
          announcementId,
        )}`,
        { method: "GET", cache: "no-store" },
      );

      const payload = (await res.json()) as
        | { error?: string; parsed?: ParsedFields; textPreview?: string }
        | undefined;

      if (!res.ok || payload?.error) {
        setError(payload?.error ?? "ดึงข้อมูลจากเอกสาร ไม่สำเร็จ");
        return;
      }

      if (!payload?.parsed) {
        setError("ไม่พบข้อมูลที่แยกได้จาก PDF");
        return;
      }

      setResult(payload.parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={!canParse || isPending}
        className="inline-flex items-center rounded-full bg-sky-500 px-3 py-1 text-[11px] font-medium text-white shadow hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-sky-700"
        title={announceType ? `announceType: ${announceType}` : undefined}
      >
        {isPending ? "กำลังดึงเอกสาร..." : "ดึงข้อมูลจากเอกสาร"}
      </button>

      {error && <div className="text-[11px] text-red-500">{error}</div>}

      {result && (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-700">
          {/* แสดงราคากลาง (ประกาศเชิญชวน) */}
          {result.centralPriceBaht && !result.winnerAmountBaht && (
            <div className="space-y-0.5">
              <div>
                ราคากลาง:{" "}
                <span className="font-medium">
                  {formatCentralPrice(result.centralPriceBaht) ??
                    result.centralPriceBaht}
                </span>{" "}
                บาท
              </div>
            </div>
          )}

          {/* แสดงข้อมูลผู้ชนะ (ประกาศรายชื่อผู้ชนะ / ผู้ได้รับการคัดเลือก) */}
          {(result.winnerName || result.winnerAmountBaht) && (
            <div className="space-y-0.5">
              {result.winnerName && (
                <div>
                  ผู้ที่ได้รับการคัดเลือก:{" "}
                  <span className="font-medium">{result.winnerName}</span>
                </div>
              )}
              {result.winnerAmountBaht && (
                <div>
                  มูลค่าที่จัดหาได้:{" "}
                  <span className="font-medium">
                    {formatWinnerAmount(result.winnerAmountBaht) ??
                      result.winnerAmountBaht}
                  </span>{" "}
                  บาท
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

