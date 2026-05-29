"use client";

type PriceState = "ceiling" | "up" | "unchanged" | "down" | "floor";

export type PulseHeatmapStock = {
  ticker: string;
  sector: string;
  price: number;
  changePct: number;
  valueBillion: number;
  state: PriceState;
};

export type PulseHeatmapSector = {
  sector: string;
  totalValueBillion: number;
  stocks: PulseHeatmapStock[];
};

export type PulseHeatmapPayload = {
  sectors?: PulseHeatmapSector[];
  updatedAt?: string | null;
};

const STATE_COLORS: Record<PriceState, { fill: string; border: string; text: string }> = {
  ceiling: { fill: "rgba(168,85,247,0.84)", border: "rgba(216,180,254,0.55)", text: "#fff" },
  up: { fill: "rgba(16,185,129,0.76)", border: "rgba(110,231,183,0.34)", text: "#ecfdf5" },
  unchanged: { fill: "rgba(245,158,11,0.74)", border: "rgba(252,211,77,0.32)", text: "#fff7ed" },
  down: { fill: "rgba(239,68,68,0.78)", border: "rgba(252,165,165,0.34)", text: "#fff1f2" },
  floor: { fill: "rgba(6,182,212,0.78)", border: "rgba(125,211,252,0.38)", text: "#ecfeff" },
};

function formatPct(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function gridSpan(valueBillion: number) {
  const size = Math.sqrt(Math.max(1, valueBillion));
  if (size >= 22) return "col-span-3 row-span-2";
  if (size >= 13) return "col-span-2 row-span-2";
  if (size >= 7) return "col-span-2";
  return "col-span-1";
}

export default function PulseBubbleHeatmap({ data }: { data: PulseHeatmapPayload | null }) {
  const sectors = Array.isArray(data?.sectors) ? data.sectors.filter((sector) => sector.stocks.length > 0) : [];

  return (
    <section
      className="min-w-0 rounded-2xl border p-4 sm:p-5"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[12px] font-black uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
            Heatmap thị trường
          </h2>
          <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
            Cổ phiếu tăng/giảm theo từng nhóm ngành
          </p>
        </div>
        <span className="rounded-full border px-2.5 py-1 text-[10px] font-black uppercase" style={{ borderColor: "rgba(20,184,166,0.24)", color: "#14b8a6", background: "rgba(20,184,166,0.08)" }}>
          Realtime
        </span>
      </div>

      {sectors.length === 0 ? (
        <div className="flex min-h-[520px] items-center justify-center rounded-xl border px-4 text-center text-xs" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-muted)" }}>
          Đang cập nhật heatmap thị trường.
        </div>
      ) : (
        <div className="grid min-h-[560px] grid-cols-1 gap-3 xl:grid-cols-4">
          {sectors.slice(0, 16).map((sector, sectorIndex) => (
            <div
              key={sector.sector}
              className="min-h-[260px] rounded-xl border p-2"
              style={{
                borderColor: "rgba(148,163,184,0.16)",
                background: "rgba(255,255,255,0.025)",
                animation: `heatmapSectorIn 420ms ease-out ${Math.min(sectorIndex * 28, 240)}ms both`,
              }}
            >
              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <span className="truncate text-[11px] font-black" style={{ color: "var(--text-primary)" }}>
                  {sector.sector}
                </span>
                <span className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>
                  {sector.stocks.length} mã
                </span>
              </div>
              <div className="grid auto-rows-[44px] grid-cols-4 gap-1.5">
                {sector.stocks.slice(0, 24).map((stock) => {
                  const colors = STATE_COLORS[stock.state] ?? STATE_COLORS.unchanged;
                  return (
                    <div
                      key={`${sector.sector}-${stock.ticker}`}
                      className={`flex min-w-0 flex-col items-center justify-center rounded-lg border px-1 text-center ${gridSpan(stock.valueBillion)}`}
                      title={`${stock.ticker}: ${formatPct(stock.changePct)}`}
                      style={{ background: colors.fill, borderColor: colors.border, color: colors.text }}
                    >
                      <span className="max-w-full truncate text-sm font-black leading-tight">{stock.ticker}</span>
                      <span className="text-[11px] font-black leading-tight">{formatPct(stock.changePct)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        @keyframes heatmapSectorIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </section>
  );
}
