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
    <div className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs">
      <p className="text-neutral-400 mb-1">{label}</p>
      <p className="text-white font-bold font-mono">
        {new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 2 }).format(payload[0].value)}
      </p>
    </div>
  );
}

export function VNIndexChart({ data, currentValue, changePercent }: VNIndexChartProps) {
  const isUp = changePercent >= 0;
  const color = isUp ? "#10b981" : "#ef4444";
  const min = data.length > 0 ? Math.min(...data.map((d) => d.close)) * 0.998 : 0;
  const max = data.length > 0 ? Math.max(...data.map((d) => d.close)) * 1.002 : 0;
  const prevClose = data.length >= 2 ? data[data.length - 2].close : currentValue;

  return (
    <Card className="p-4 h-full">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">VN-INDEX 30 PHIÊN</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-white font-mono">
              {new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(currentValue)}
            </span>
            <span className={`text-sm font-bold ${isUp ? "text-emerald-400" : "text-red-400"}`}>
              {changePercent > 0 ? "+" : ""}{changePercent.toFixed(2).replace(".", ",")}%
            </span>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-lg text-xs font-bold ${isUp ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
          {isUp ? "📈 TĂNG" : "📉 GIẢM"}
        </div>
      </div>

      <div className="h-48 sm:h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="vniFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#525252", fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[min, max]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#525252", fontSize: 10 }}
              tickFormatter={(v) => v.toFixed(0)}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={prevClose} stroke="#525252" strokeDasharray="3 3" />
            <Area
              type="monotone"
              dataKey="close"
              stroke={color}
              strokeWidth={2}
              fill="url(#vniFill)"
              dot={false}
              activeDot={{ r: 4, fill: color }}
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
          <div className="h-3 w-28 bg-neutral-800 rounded animate-pulse" />
          <div className="h-7 w-36 bg-neutral-800 rounded animate-pulse mt-2" />
        </div>
        <div className="h-7 w-16 bg-neutral-800 rounded-lg animate-pulse" />
      </div>
      <div className="h-48 sm:h-56 bg-neutral-800/50 rounded-xl animate-pulse" />
    </Card>
  );
}
