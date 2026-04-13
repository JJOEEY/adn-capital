"use client";

interface MarketBreadthProps {
  up: number;
  down: number;
  unchanged: number;
  totalVolume: string;
}

export function MarketBreadth({ up, down, unchanged, totalVolume }: MarketBreadthProps) {
  const total = up + down + unchanged || 1;
  const ceil = Math.round(down * 0.08);   // estimate ~8% at floor
  const floor = Math.round(up * 0.06);   // estimate ~6% at ceiling

  // Phase 2 spec colors (not dependent on theme class):
  // Tăng: #16a34a | TC: #f59e0b | Giảm: danger | Trần: #16a34a darker | Sàn: danger opacity
  return (
    <div
      className="rounded-xl p-3 min-h-[100px] flex flex-col gap-2"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between">
        <p
          className="text-[12px] font-bold uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          Độ Rộng Thị Trường
        </p>
        <span className="text-[12px] font-mono" style={{ color: "var(--text-muted)" }}>
          Vol: {totalVolume}
        </span>
      </div>

      {/* Stacked progress bar */}
      <div
        className="flex h-3 rounded-full overflow-hidden gap-0.5"
        style={{ background: "var(--bg-hover)" }}
      >
        {floor > 0 && (
          <div
            className="transition-all duration-500"
            style={{ width: `${(floor / total) * 100}%`, background: "#16a34a" }}
            title={`Trần: ${floor}`}
          />
        )}
        <div
          className="transition-all duration-500"
          style={{ width: `${((up - floor) / total) * 100}%`, background: "#16a34a", opacity: 0.7 }}
          title={`Tăng: ${up}`}
        />
        <div
          className="transition-all duration-500"
          style={{ width: `${(unchanged / total) * 100}%`, background: "#f59e0b" }}
          title={`Tham chiếu: ${unchanged}`}
        />
        <div
          className="transition-all duration-500"
          style={{ width: `${((down - ceil) / total) * 100}%`, background: "var(--danger)", opacity: 0.7 }}
          title={`Giảm: ${down}`}
        />
        {ceil > 0 && (
          <div
            className="transition-all duration-500"
            style={{ width: `${(ceil / total) * 100}%`, background: "var(--danger)" }}
            title={`Sàn: ${ceil}`}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-[12px] font-bold flex-wrap">
        <span className="flex items-center gap-1" style={{ color: "#16a34a" }}>
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#16a34a" }} />
          Tăng {up}
        </span>
        <span className="flex items-center gap-1" style={{ color: "#f59e0b" }}>
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#f59e0b" }} />
          TC {unchanged}
        </span>
        <span className="flex items-center gap-1" style={{ color: "var(--danger)" }}>
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: "var(--danger)" }} />
          Giảm {down}
        </span>
        {floor > 0 && (
          <span className="flex items-center gap-1" style={{ color: "#16a34a" }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#16a34a", opacity: 0.5 }} />
            Trần {floor}
          </span>
        )}
        {ceil > 0 && (
          <span className="flex items-center gap-1" style={{ color: "var(--danger)" }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: "var(--danger)", opacity: 0.5 }} />
            Sàn {ceil}
          </span>
        )}
      </div>
    </div>
  );
}

export function MarketBreadthSkeleton() {
  return (
    <div
      className="rounded-xl p-3 min-h-[100px] flex flex-col gap-2"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="h-3 w-32 rounded animate-pulse" style={{ background: "var(--bg-hover)" }} />
      <div className="h-3 rounded-full animate-pulse" style={{ background: "var(--bg-hover)" }} />
      <div className="flex gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-3 w-14 rounded animate-pulse" style={{ background: "var(--bg-hover)" }} />
        ))}
      </div>
    </div>
  );
}
