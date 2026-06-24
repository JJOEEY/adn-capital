"use client";

import { useMemo, useState } from "react";
import { BarChart3, TrendingDown, TrendingUp } from "lucide-react";

type IndexKey = "VNINDEX" | "VN30" | "HNX" | "UPCOM";

export type PulseIndexImpactRow = {
  ticker: string;
  contributionPoints: number;
  changePct: number;
  contributionType?: "actual" | "estimated";
  contributionAsOf?: string | null;
  price?: number | null;
  realtimePatched?: boolean;
  realtimeUpdatedAt?: string | null;
};

export type PulseIndexImpactItem = {
  index: IndexKey;
  updatedAt?: string | null;
  contributionType?: "actual" | "estimated";
  rows?: PulseIndexImpactRow[];
  missingFields?: string[];
};

export type PulseIndexImpactPayload = {
  indices?: Partial<Record<IndexKey, PulseIndexImpactItem>>;
  updatedAt?: string | null;
};

const INDEX_OPTIONS: Array<{ key: IndexKey; label: string }> = [
  { key: "VNINDEX", label: "VN-Index" },
  { key: "VN30", label: "VN30" },
  { key: "HNX", label: "HNX" },
  { key: "UPCOM", label: "UPCOM" },
];

const POS = "#16a34a";
const NEG = "#dc2626";

function formatPoint(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(2)}`;
}

function formatAsOf(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }).format(date);
}

// Thang căn bậc 2 (perceptual): mã nhỏ vẫn phân biệt được dù có outlier lớn (vd VIC). Sàn 10% để vừa số.
function scaleWidth(value: number, max: number) {
  return Math.max(10, Math.sqrt(Math.max(0, value) / Math.max(max, 1e-9)) * 100);
}

function ImpactRow({ ticker, value, max, side, index }: { ticker: string; value: number; max: number; side: "L" | "R"; index: number }) {
  const w = scaleWidth(value, max);
  const bar = (
    <div
      className="flex items-center overflow-hidden"
      style={{
        width: `${w.toFixed(1)}%`,
        minWidth: 30,
        height: 22,
        borderRadius: 8,
        background: side === "L" ? POS : NEG,
        padding: "0 8px",
        justifyContent: side === "L" ? "flex-end" : "flex-start",
        animation: `${side === "L" ? "impactRevealL" : "impactRevealR"} 700ms cubic-bezier(0.22, 1, 0.36, 1) ${index * 50}ms both`,
      }}
    >
      <span className="whitespace-nowrap text-[12px] font-black text-white">{side === "L" ? value.toFixed(2) : `−${value.toFixed(2)}`}</span>
    </div>
  );
  if (side === "L") {
    return (
      <div className="grid items-center gap-2" style={{ gridTemplateColumns: "30px 1fr" }}>
        <span className="text-[12px] font-black" style={{ color: "var(--text-primary)" }}>{ticker}</span>
        <div className="flex justify-start">{bar}</div>
      </div>
    );
  }
  return (
    <div className="grid items-center gap-2" style={{ gridTemplateColumns: "1fr 30px" }}>
      <div className="flex justify-end">{bar}</div>
      <span className="text-right text-[12px] font-black" style={{ color: "var(--text-primary)" }}>{ticker}</span>
    </div>
  );
}

export function PulseIndexImpactChart({ data }: { data: PulseIndexImpactPayload | null }) {
  const [selectedIndex, setSelectedIndex] = useState<IndexKey>("VNINDEX");
  const current = data?.indices?.[selectedIndex] ?? null;
  const { positiveRows, negativeRows, gMax, lMax, totalPositive, totalNegative, isEstimated, contributionAsOf } = useMemo(() => {
    const raw = Array.isArray(current?.rows) ? current.rows : [];
    const valid = raw.filter((row) => row.ticker && Number.isFinite(row.contributionPoints) && row.contributionPoints !== 0);
    const positive = valid.filter((row) => row.contributionPoints > 0).sort((a, b) => b.contributionPoints - a.contributionPoints).slice(0, 10);
    const negative = valid.filter((row) => row.contributionPoints < 0).sort((a, b) => a.contributionPoints - b.contributionPoints).slice(0, 10);
    return {
      positiveRows: positive,
      negativeRows: negative,
      gMax: Math.max(...positive.map((row) => row.contributionPoints), 0.01),
      lMax: Math.max(...negative.map((row) => Math.abs(row.contributionPoints)), 0.01),
      totalPositive: positive.reduce((sum, row) => sum + row.contributionPoints, 0),
      totalNegative: negative.reduce((sum, row) => sum + row.contributionPoints, 0),
      isEstimated: current?.contributionType === "estimated" || valid.some((row) => row.contributionType === "estimated"),
      contributionAsOf: valid.find((row) => row.contributionAsOf)?.contributionAsOf ?? null,
    };
  }, [current]);

  const netImpact = totalPositive + totalNegative;
  const hasRows = positiveRows.length > 0 || negativeRows.length > 0;
  const totalAbs = totalPositive + Math.abs(totalNegative);
  const posShare = totalAbs > 0 ? (totalPositive / totalAbs) * 100 : 50;
  const summaryGradient = `linear-gradient(90deg, #15803d 0%, #22c55e ${Math.max(0, posShare - 10).toFixed(1)}%, #8a9a3c ${posShare.toFixed(1)}%, #ef4444 ${Math.min(100, posShare + 6).toFixed(1)}%, #dc2626 100%)`;

  return (
    <div className="rounded-xl border p-3 h-full" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" style={{ color: "#6366f1" }} />
          <div>
            <div className="text-[12px] font-black" style={{ color: "var(--text-primary)" }}>Tác động tới Index</div>
            <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>Đơn vị: điểm đóng góp</div>
          </div>
        </div>
        <div className="flex rounded-full p-0.5" style={{ background: "var(--bg-hover)" }}>
          {INDEX_OPTIONS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setSelectedIndex(item.key)}
              className="rounded-full px-2 py-0.5 text-[10px] font-black"
              style={{ background: selectedIndex === item.key ? "var(--primary)" : "transparent", color: selectedIndex === item.key ? "var(--bg)" : "var(--text-muted)" }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {!hasRows ? (
        <div className="flex h-72 items-center justify-center rounded-lg border px-4 text-center text-xs" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
          Chưa có dữ liệu đóng góp chỉ số đủ chuẩn.
        </div>
      ) : (
        <>
          <div className="mb-1.5 flex items-baseline justify-between text-[11px] font-black">
            <span style={{ color: POS }}>Kéo tăng {formatPoint(totalPositive)}</span>
            <span style={{ color: "var(--text-secondary)" }}>Ròng <span style={{ color: netImpact >= 0 ? POS : NEG }}>{formatPoint(netImpact)}</span></span>
            <span style={{ color: NEG }}>Kéo giảm {formatPoint(totalNegative)}</span>
          </div>
          <div className="h-[22px] overflow-hidden rounded-lg" style={{ background: "var(--bg-hover)" }}>
            <div className="h-full w-full" style={{ background: summaryGradient, animation: "impactRevealL 900ms ease-out both" }} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-black" style={{ color: POS }}>
                <TrendingUp className="h-3.5 w-3.5" /> Mã kéo tăng
              </div>
              <div className="flex flex-col gap-1.5">
                {positiveRows.map((row, index) => (
                  <ImpactRow key={`pos-${row.ticker}`} ticker={row.ticker} value={row.contributionPoints} max={gMax} side="L" index={index} />
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-end gap-1.5 text-[11px] font-black" style={{ color: NEG }}>
                Mã kéo giảm <TrendingDown className="h-3.5 w-3.5" />
              </div>
              <div className="flex flex-col gap-1.5">
                {negativeRows.map((row, index) => (
                  <ImpactRow key={`neg-${row.ticker}`} ticker={row.ticker} value={Math.abs(row.contributionPoints)} max={lMax} side="R" index={index} />
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3 border-t pt-2 text-[10px] font-bold" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
            {isEstimated ? "Dữ liệu ước tính theo tỷ trọng" : "Dữ liệu đóng góp chỉ số"}
            {formatAsOf(contributionAsOf) ? ` · Mốc ${formatAsOf(contributionAsOf)}` : ""} · độ dài thanh = mức tác động
          </div>
        </>
      )}
      <style jsx global>{`
        @keyframes impactRevealL {
          from {
            clip-path: inset(0 100% 0 0);
          }
          to {
            clip-path: inset(0 0 0 0);
          }
        }
        @keyframes impactRevealR {
          from {
            clip-path: inset(0 0 0 100%);
          }
          to {
            clip-path: inset(0 0 0 0);
          }
        }
      `}</style>
    </div>
  );
}
