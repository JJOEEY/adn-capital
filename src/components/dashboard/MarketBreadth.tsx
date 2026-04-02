"use client";

interface MarketBreadthProps {
  up: number;
  down: number;
  unchanged: number;
  totalVolume: string;
}

export function MarketBreadth({ up, down, unchanged, totalVolume }: MarketBreadthProps) {
  const total = up + down + unchanged || 1;
  const ceil = Math.round(down * 0.08); // Ước tính ~8% giảm sàn
  const floor = Math.round(up * 0.06);  // Ước tính ~6% tăng trần

  return (
    <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-3 min-h-[100px] flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider whitespace-normal break-words">
          Độ Rộng Thị Trường
        </p>
        <span className="text-[10px] text-neutral-600 font-mono flex-shrink-0">Vol: {totalVolume}</span>
      </div>

      {/* Breadth bar */}
      <div className="flex gap-0.5 h-3 rounded-full overflow-hidden">
        {ceil > 0 && (
          <div
            className="bg-purple-500 transition-all duration-500"
            style={{ width: `${(ceil / total) * 100}%` }}
            title={`Trần: ${ceil}`}
          />
        )}
        <div
          className="bg-emerald-500 transition-all duration-500"
          style={{ width: `${((up - floor) / total) * 100}%` }}
          title={`Tăng: ${up}`}
        />
        <div
          className="bg-yellow-500 transition-all duration-500"
          style={{ width: `${(unchanged / total) * 100}%` }}
          title={`Tham chiếu: ${unchanged}`}
        />
        <div
          className="bg-red-500 transition-all duration-500"
          style={{ width: `${((down - ceil) / total) * 100}%` }}
          title={`Giảm: ${down}`}
        />
        {floor > 0 && (
          <div
            className="bg-cyan-400 transition-all duration-500"
            style={{ width: `${(floor / total) * 100}%` }}
            title={`Sàn: ${floor}`}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-[10px] font-bold flex-wrap">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" /> Trần {ceil}
        </span>
        <span className="flex items-center gap-1 text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Tăng {up}
        </span>
        <span className="flex items-center gap-1 text-yellow-400">
          <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> TC {unchanged}
        </span>
        <span className="flex items-center gap-1 text-red-400">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Giảm {down}
        </span>
        <span className="flex items-center gap-1 text-cyan-400">
          <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" /> Sàn {floor}
        </span>
      </div>
    </div>
  );
}

export function MarketBreadthSkeleton() {
  return (
    <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-3 min-h-[100px] flex flex-col gap-2">
      <div className="h-3 w-32 bg-neutral-800 rounded animate-pulse" />
      <div className="h-3 rounded-full bg-neutral-800 animate-pulse" />
      <div className="flex gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-3 w-14 bg-neutral-800 rounded animate-pulse" />
        ))}
      </div>
    </div>
  );
}
