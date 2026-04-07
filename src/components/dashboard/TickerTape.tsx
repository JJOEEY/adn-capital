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
  const color = isUp ? "text-emerald-400" : isDown ? "text-red-400" : "text-yellow-400";
  const bg = isUp ? "bg-emerald-500/10" : isDown ? "bg-red-500/10" : "bg-yellow-500/10";
  const blinkClass = isUp ? "animate-pulse" : isDown ? "animate-pulse" : "";

  return (
    <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-lg ${bg} flex-shrink-0`}>
      <span className="text-xs font-bold text-neutral-300">{item.name}</span>
      <span className={`text-sm font-black font-mono ${color}`}>{formatIdx(item.value)}</span>
      <span className={`text-[12px] font-bold ${color} ${blinkClass}`}>
        {isUp ? "▲" : isDown ? "▼" : "—"}{" "}
        {item.changePercent > 0 ? "+" : ""}{item.changePercent.toFixed(2).replace(".", ",")}%
      </span>
    </div>
  );
}

export function TickerTape({ items }: TickerTapeProps) {
  // Duplicate items for seamless infinite scroll
  const doubled = [...items, ...items, ...items];

  return (
    <div className="relative overflow-hidden bg-neutral-950/80 border-y border-neutral-800/50 py-2">
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-neutral-950 to-transparent z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-neutral-950 to-transparent z-10" />

      <div className="flex gap-6 animate-marquee whitespace-nowrap">
        {doubled.map((item, i) => (
          <TickerChip key={`${item.name}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}

export function TickerTapeSkeleton() {
  return (
    <div className="overflow-hidden bg-neutral-950/80 border-y border-neutral-800/50 py-2">
      <div className="flex gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 w-40 rounded-lg bg-neutral-800 animate-pulse flex-shrink-0" />
        ))}
      </div>
    </div>
  );
}
