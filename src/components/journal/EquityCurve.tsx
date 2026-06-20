"use client";

import useSWR from "swr";
import { Activity } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface PnlResp {
  initialNAV: number;
  currentNAV: number;
  equityCurve?: { date: string; nav: number }[];
}

const GREEN = "#16a34a";
const RED = "#c0392b";

function fmtVnd(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2).replace(/[.,]?0+$/, "")} tỷ`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(abs >= 1e8 ? 0 : 1).replace(/[.,]?0+$/, "")} tr`;
  return `${sign}${Math.round(abs).toLocaleString("vi-VN")}`;
}

export function EquityCurve() {
  const { data, isLoading } = useSWR<PnlResp>("/api/journal/pnl", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  if (isLoading || !data) {
    return <div className="h-[220px] rounded-2xl animate-pulse" style={{ background: "var(--surface)" }} />;
  }

  const initialNAV = data.initialNAV ?? 0;
  const currentNAV = data.currentNAV ?? 0;
  const curve = data.equityCurve ?? [];

  // Chuỗi vẽ: [Vốn ban đầu] → các mốc lãi/lỗ đã chốt → [Nay = currentNAV gồm cả chưa chốt]
  const points = [
    ...(initialNAV > 0 ? [{ label: "Vốn", nav: initialNAV }] : []),
    ...curve.map((p) => ({ label: p.date.slice(5), nav: p.nav })),
    { label: "Nay", nav: currentNAV },
  ];

  // Cần ≥2 điểm khác nhau mới có đường ý nghĩa
  const hasShape = points.length >= 2 && new Set(points.map((p) => p.nav)).size > 1;
  const up = currentNAV >= initialNAV;
  const accent = up ? GREEN : RED;

  return (
    <div className="rounded-2xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4" style={{ color: accent }} />
          <h3 className="text-sm font-black" style={{ color: "var(--text-primary)" }}>Đường tài sản (NAV)</h3>
        </div>
        <span className="text-sm font-black font-mono" style={{ color: "var(--text-primary)" }}>
          {fmtVnd(currentNAV)}₫
        </span>
      </div>

      {!hasShape ? (
        <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>
          Chưa đủ dữ liệu để vẽ đường tài sản — ghi thêm lệnh (và chốt lời/lỗ) để thấy NAV thay đổi theo thời gian.
        </p>
      ) : (
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 6, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="navFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              {initialNAV > 0 && (
                <ReferenceLine y={initialNAV} stroke="var(--text-muted)" strokeDasharray="4 4" strokeOpacity={0.5} />
              )}
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                interval="preserveStartEnd"
                minTickGap={28}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  fontSize: 12,
                }}
                labelStyle={{ color: "var(--text-muted)" }}
                formatter={(value) => [`${fmtVnd(Number(value) || 0)}₫`, "NAV"]}
              />
              <Area type="monotone" dataKey="nav" stroke={accent} strokeWidth={2} fill="url(#navFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      {initialNAV > 0 && (
        <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
          Đường nét đứt = vốn ban đầu. Mốc cuối "Nay" gồm cả lãi/lỗ chưa chốt.
        </p>
      )}
    </div>
  );
}
