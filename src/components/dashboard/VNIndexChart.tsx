"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Card } from "@/components/ui/Card";

interface ChartPoint {
  date: string;
  close: number;
}

interface VNIndexChartProps {
  data: ChartPoint[];
  currentValue: number;
  changePercent: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <p className="mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="font-bold font-mono" style={{ color: "var(--text-primary)" }}>
        {new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 2 }).format(payload[0].value)}
      </p>
    </div>
  );
}

export function VNIndexChart({ data, currentValue, changePercent }: VNIndexChartProps) {
  const isUp = changePercent >= 0;
  // Success = #16a34a | Danger = C0392B in light, c0614a in dark — use var(--danger)
  const color = isUp ? "#16a34a" : "var(--danger)";
  const colorHex = isUp ? "#16a34a" : "#C0392B"; // for gradient stop (must be hex)
  const min = data.length > 0 ? Math.min(...data.map((d) => d.close)) * 0.998 : 0;
  const max = data.length > 0 ? Math.max(...data.map((d) => d.close)) * 1.002 : 0;
  const prevClose = data.length >= 2 ? data[data.length - 2].close : currentValue;

  const badgeStyle: React.CSSProperties = isUp
    ? { background: "rgba(22,163,74,0.10)", color: "#16a34a", border: "1px solid rgba(22,163,74,0.20)" }
    : { background: "rgba(192,57,43,0.10)", color: "var(--danger)", border: "1px solid rgba(192,57,43,0.20)" };

  return (
    <Card className="p-4 h-full">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            VN-INDEX 30 PHIÊN
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black font-mono" style={{ color: "var(--text-primary)" }}>
              {new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(currentValue)}
            </span>
            <span className="text-sm font-bold" style={{ color }}>
              {changePercent > 0 ? "+" : ""}{changePercent.toFixed(2).replace(".", ",")}%
            </span>
          </div>
        </div>
        <div className="px-3 py-1 rounded-lg text-xs font-bold" style={badgeStyle}>
          {isUp ? "📈 TĂNG" : "📉 GIẢM"}
        </div>
      </div>

      <div className="h-48 sm:h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="vniFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colorHex} stopOpacity={0.15} />
                <stop offset="95%" stopColor={colorHex} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--text-muted, #5a6b5e)", fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[min, max]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--text-muted, #5a6b5e)", fontSize: 10 }}
              tickFormatter={(v) => v.toFixed(0)}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={prevClose} stroke="rgba(235,226,207,0.20)" strokeDasharray="3 3" />
            <Area
              type="monotone"
              dataKey="close"
              stroke={colorHex}
              strokeWidth={2}
              fill="url(#vniFill)"
              dot={false}
              activeDot={{ r: 4, fill: colorHex }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function VNIndexChartSkeleton() {
  return (
    <Card className="p-4 h-full">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div
            className="h-3 w-28 rounded animate-pulse"
            style={{ background: "var(--bg-hover)" }}
          />
          <div
            className="h-7 w-36 rounded animate-pulse mt-2"
            style={{ background: "var(--bg-hover)" }}
          />
        </div>
        <div
          className="h-7 w-16 rounded-lg animate-pulse"
          style={{ background: "var(--bg-hover)" }}
        />
      </div>
      <div
        className="h-48 sm:h-56 rounded-xl animate-pulse"
        style={{ background: "var(--bg-hover)" }}
      />
    </Card>
  );
}
