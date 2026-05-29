"use client";

import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";

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
  { key: "VNINDEX", label: "VNINDEX" },
  { key: "VN30", label: "VN30" },
  { key: "HNX", label: "HNX" },
  { key: "UPCOM", label: "UPCOM" },
];

function formatPoint(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
}

function formatAsOf(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function ImpactBar({
  row,
  maxAbs,
  tone,
  index,
}: {
  row: PulseIndexImpactRow;
  maxAbs: number;
  tone: "positive" | "negative";
  index: number;
}) {
  const height = Math.max(30, (Math.abs(row.contributionPoints) / maxAbs) * 100);
  const isPositive = tone === "positive";
  const color = isPositive ? "#22c55e" : "#ef4444";

  return (
    <div className={`flex h-full min-w-0 flex-col items-center ${isPositive ? "justify-end" : "justify-start"}`}>
      <div
        className="relative flex w-full max-w-[64px] items-center justify-center rounded-md"
        title={`${row.ticker}: ${formatPoint(row.contributionPoints)} điểm`}
        style={{
          height: `${height}%`,
          minHeight: 30,
          background: color,
          boxShadow: `0 0 18px ${isPositive ? "rgba(34,197,94,0.16)" : "rgba(239,68,68,0.16)"}`,
          animation: `impactBarIn 520ms ease-out ${Math.min(index * 24, 260)}ms both`,
        }}
      >
        <span className="px-1 text-center text-[10px] font-black leading-tight text-white">
          {formatPoint(row.contributionPoints)}
        </span>
      </div>
      <span className="mt-1 max-w-full truncate text-[10px] font-black" style={{ color: "var(--text-secondary)" }}>
        {row.ticker}
      </span>
    </div>
  );
}

export function PulseIndexImpactChart({ data }: { data: PulseIndexImpactPayload | null }) {
  const [selectedIndex, setSelectedIndex] = useState<IndexKey>("VNINDEX");
  const current = data?.indices?.[selectedIndex] ?? null;
  const { positiveRows, negativeRows, maxAbs, totalPositive, totalNegative, isEstimated, contributionAsOf } = useMemo(() => {
    const raw = Array.isArray(current?.rows) ? current.rows : [];
    const validRows = raw.filter((row) => row.ticker && Number.isFinite(row.contributionPoints) && row.contributionPoints !== 0);
    const positive = validRows
      .filter((row) => row.contributionPoints > 0)
      .sort((a, b) => b.contributionPoints - a.contributionPoints)
      .slice(0, 10);
    const negative = validRows
      .filter((row) => row.contributionPoints < 0)
      .sort((a, b) => a.contributionPoints - b.contributionPoints)
      .slice(0, 10);
    const rows = [...positive, ...negative];
    return {
      positiveRows: positive,
      negativeRows: negative,
      maxAbs: Math.max(...rows.map((row) => Math.abs(row.contributionPoints)), 1),
      totalPositive: positive.reduce((sum, row) => sum + row.contributionPoints, 0),
      totalNegative: negative.reduce((sum, row) => sum + row.contributionPoints, 0),
      isEstimated: current?.contributionType === "estimated" || rows.some((row) => row.contributionType === "estimated"),
      contributionAsOf: rows.find((row) => row.contributionAsOf)?.contributionAsOf ?? null,
    };
  }, [current]);

  const netImpact = totalPositive + totalNegative;
  const hasRows = positiveRows.length > 0 || negativeRows.length > 0;

  return (
    <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-3.5 w-3.5" style={{ color: "#6366f1" }} />
          <div>
            <div className="text-[11px] font-black uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
              Tác động tới INDEX
            </div>
            <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              Đơn vị: điểm đóng góp
            </div>
          </div>
        </div>
        <div className="flex rounded-full p-0.5" style={{ background: "var(--bg-hover)" }}>
          {INDEX_OPTIONS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setSelectedIndex(item.key)}
              className="rounded-full px-2 py-0.5 text-[10px] font-black"
              style={{
                background: selectedIndex === item.key ? "var(--primary)" : "transparent",
                color: selectedIndex === item.key ? "var(--bg)" : "var(--text-muted)",
              }}
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
          <div className="mb-3 grid grid-cols-3 gap-2 text-center text-[10px] font-black">
            <div className="rounded-lg px-2 py-1.5" style={{ background: "rgba(34,197,94,0.10)", color: "#22c55e" }}>
              Kéo tăng {formatPoint(totalPositive)}
            </div>
            <div className="rounded-lg px-2 py-1.5" style={{ background: "var(--surface)", color: netImpact >= 0 ? "#22c55e" : "#ef4444" }}>
              Tác động ròng {formatPoint(netImpact)}
            </div>
            <div className="rounded-lg px-2 py-1.5" style={{ background: "rgba(239,68,68,0.10)", color: "#ef4444" }}>
              Kéo giảm {formatPoint(totalNegative)}
            </div>
          </div>

          <div className="relative h-[300px] overflow-hidden rounded-lg border px-3 py-3" style={{ borderColor: "rgba(148,163,184,0.18)" }}>
            <div className="absolute left-3 right-3 top-1/2 h-px" style={{ background: "rgba(148,163,184,0.26)" }} />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border px-3 py-1 text-[10px] font-black" style={{ borderColor: "var(--border)", background: "var(--surface)", color: netImpact >= 0 ? "#22c55e" : "#ef4444" }}>
              {formatPoint(netImpact)}
            </div>

            <div className="grid h-[132px] grid-cols-10 items-end gap-2">
              {positiveRows.map((row, index) => (
                <ImpactBar key={`positive-${row.ticker}`} row={row} maxAbs={maxAbs} tone="positive" index={index} />
              ))}
            </div>
            <div className="mt-9 grid h-[132px] grid-cols-10 items-start gap-2">
              {negativeRows.map((row, index) => (
                <ImpactBar key={`negative-${row.ticker}`} row={row} maxAbs={maxAbs} tone="negative" index={index} />
              ))}
            </div>
          </div>

          <div className="mt-2 text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>
            {isEstimated ? "Dữ liệu ước tính theo tỷ trọng" : "Dữ liệu đóng góp chỉ số"}
            {formatAsOf(contributionAsOf) ? ` · Mốc ${formatAsOf(contributionAsOf)}` : ""}
          </div>
        </>
      )}
      <style jsx>{`
        @keyframes impactBarIn {
          from {
            opacity: 0;
            transform: scaleY(0.35);
          }
          to {
            opacity: 1;
            transform: scaleY(1);
          }
        }
      `}</style>
    </div>
  );
}
