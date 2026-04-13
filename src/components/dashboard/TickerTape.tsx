"use client";

interface TickerItem {
  name: string;
  value: number;
  change: number;
  changePercent: number;
}

interface TickerTapeProps {
  items: TickerItem[];
}

function formatIdx(v: number): string {
  return new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

function TickerChip({ item }: { item: TickerItem }) {
  const isUp = item.changePercent > 0;
  const isDown = item.changePercent < 0;
  // Success = #16a34a | Warning = #f59e0b | Danger = use var(--danger)
  const color = isUp ? "#16a34a" : isDown ? "var(--danger)" : "#f59e0b";

  return (
    <div
      className="inline-flex items-center gap-2.5 px-4 py-1.5 flex-shrink-0"
      style={{ borderRight: "1px solid var(--border)" }}
    >
      <span
        className="text-[12px] font-medium"
        style={{ color: "var(--text-muted)" }}
      >
        {item.name}
      </span>
      <span
        className="text-[12px] font-semibold font-mono"
        style={{ color: "var(--text-primary)" }}
      >
        {formatIdx(item.value)}
      </span>
      <span
        className="text-[12px] font-semibold"
        style={{ color }}
      >
        {isUp ? "▲" : isDown ? "▼" : "—"}{" "}
        {item.changePercent > 0 ? "+" : ""}{item.changePercent.toFixed(2).replace(".", ",")}%
      </span>
    </div>
  );
}

export function TickerTape({ items }: TickerTapeProps) {
  const doubled = [...items, ...items, ...items];

  return (
    <div
      className="relative overflow-hidden"
      style={{
        height: "40px",
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        className="flex items-center h-full animate-marquee whitespace-nowrap"
      >
        {doubled.map((item, i) => (
          <TickerChip key={`${item.name}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}

export function TickerTapeSkeleton() {
  return (
    <div
      className="overflow-hidden flex items-center gap-4 px-4"
      style={{
        height: "40px",
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-5 w-36 rounded animate-pulse flex-shrink-0"
          style={{ background: "var(--bg-hover)" }}
        />
      ))}
    </div>
  );
}
