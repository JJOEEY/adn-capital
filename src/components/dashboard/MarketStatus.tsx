"use client";

import { TrendingUp, TrendingDown, Minus, Activity, Globe, AlertTriangle, Zap } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatIndex, formatPercent } from "@/lib/utils";

interface GlobalIndex {
  name: string;
  value: number;
  changePercent: number;
  icon: string;
}

interface MarketStatusProps {
  data: {
    status: "GOOD" | "BAD" | "NEUTRAL";
    phase: "no_trade" | "probe" | "full_margin";
    description: string;
    indicators: Record<string, boolean>;
    verdict: string;
    action: string;
    vnindex: { value: number; change: number; changePercent: number };
    hnx: { value: number; change: number; changePercent: number };
    updown: { up: number; down: number; unchanged: number };
    totalVolume: string;
    aiSummary: string;
    date: string;
    globalIndices: GlobalIndex[];
    vnMarketBullets: string[];
    macroBullets: string[];
    riskBullets: string[];
    opportunityBullets: string[];
  };
}

const phaseStyle = {
  no_trade: {
    glow: "red" as const,
    icon: TrendingDown,
    iconBg: "rgba(192,57,43,0.15)",
    iconColor: "var(--danger)",
    verdictColor: "var(--danger)",
    badge: { background: "rgba(192,57,43,0.15)", color: "var(--danger)", borderColor: "rgba(192,57,43,0.30)" },
  },
  probe: {
    glow: "yellow" as const,
    icon: Minus,
    iconBg: "rgba(234,179,8,0.15)",
    iconColor: "#eab308",
    verdictColor: "#eab308",
    badge: { background: "rgba(234,179,8,0.15)", color: "#eab308", borderColor: "rgba(234,179,8,0.30)" },
  },
  full_margin: {
    glow: "emerald" as const,
    icon: TrendingUp,
    iconBg: "rgba(22,163,74,0.15)",
    iconColor: "#16a34a",
    verdictColor: "#16a34a",
    badge: { background: "rgba(22,163,74,0.15)", color: "#16a34a", borderColor: "rgba(22,163,74,0.30)" },
  },
};

export function MarketStatusDisplay({ data }: MarketStatusProps) {
  const phase = data.phase ?? "no_trade";
  const style = phaseStyle[phase];
  const Icon = style.icon;

  return (
    <div className="space-y-5">
      {/* Header Banner - Morning Intelligence Style */}
      <Card glow={style.glow} className="p-3 sm:p-6 relative overflow-hidden">
        <div className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
            <div className="min-w-0">
              <p className="text-[12px] font-bold uppercase tracking-[0.2em] mb-1" style={{ color: "rgba(22,163,74,0.70)" }}>ADN CAPITAL</p>
              <div className="flex items-baseline gap-2">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>MORNING</h2>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight" style={{ color: "#16a34a" }}>INTELLIGENCE</h2>
              </div>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{data.date} · Bản tin thị trường</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2.5 sm:p-3 rounded-xl" style={{ background: style.iconBg }}>
                <Icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: style.iconColor }} />
              </div>
              <div className="text-left sm:text-right">
                <span className="text-lg sm:text-xl font-black tracking-tight" style={{ color: style.verdictColor }}>
                  {data.verdict}
                </span>
                <div className="mt-1 rounded-lg border px-2.5 py-1 text-[12px] font-semibold leading-tight" style={style.badge}>
                  {data.action}
                </div>
              </div>
            </div>
          </div>

          {/* CHỈ SỐ THAM CHIẾU */}
          <div className="mt-5">
            <p className="text-[12px] font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
              <Activity className="w-3 h-3" />
              Chỉ Số Tham Chiếu (so phiên trước)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {data.globalIndices.map((idx) => (
                <div
                  key={idx.name}
                  className="bg-[var(--surface)] rounded-xl px-3 py-2.5 border border-[var(--border)]"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide truncate" style={{ color: "var(--text-muted)" }}>
                      {idx.name}
                    </span>
                    <span className="text-xs">{idx.icon}</span>
                  </div>
                    <p className="text-sm font-black font-mono" style={{ color: "var(--text-primary)" }}>
                      {formatIndex(idx.value)}
                    </p>
                    <p className="text-[12px] font-bold" style={{ color: idx.changePercent >= 0 ? "#16a34a" : "var(--danger)" }}>
                    {idx.changePercent >= 0 ? "▲" : "▼"} {formatPercent(idx.changePercent)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* VN Market + Macro */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* THỊ TRƯỜNG VIỆT NAM */}
        <div className="p-5 rounded-2xl border" style={{ background: "var(--surface)", borderLeft: "2px solid rgba(22,163,74,0.50)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg" style={{ background: "rgba(22,163,74,0.10)" }}>
              <TrendingUp className="w-4 h-4" style={{ color: "#16a34a" }} />
            </div>
            <h3 className="text-sm font-black uppercase tracking-wider" style={{ color: "#16a34a" }}>
              Thị Trường Việt Nam
            </h3>
          </div>
          <div className="space-y-3">
            {data.vnMarketBullets.map((bullet, i) => (
              <p key={i} className="text-sm leading-relaxed pl-3 border-l border-[var(--border)]" style={{ color: "var(--text-secondary)" }}>
                {bullet}
              </p>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-[var(--border)]">
            <div className="flex items-center gap-4 text-xs">
              <span className="font-bold" style={{ color: "#16a34a" }}>▲ {data.updown.up}</span>
              <span className="font-bold" style={{ color: "var(--danger)" }}>▼ {data.updown.down}</span>
              <span style={{ color: "var(--text-muted)" }}>— {data.updown.unchanged}</span>
              <span className="ml-auto" style={{ color: "var(--text-muted)" }}>Vol: {data.totalVolume}</span>
            </div>
            <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden mt-2">
              <div className="rounded-l-full" style={{ background: "#16a34a", width: `${(data.updown.up / (data.updown.up + data.updown.down + data.updown.unchanged)) * 100}%` }} />
              <div style={{ background: "var(--border)", width: `${(data.updown.unchanged / (data.updown.up + data.updown.down + data.updown.unchanged)) * 100}%` }} />
              <div className="rounded-r-full" style={{ background: "var(--danger)", width: `${(data.updown.down / (data.updown.up + data.updown.down + data.updown.unchanged)) * 100}%` }} />
            </div>
          </div>
        </div>

        {/* VĨ MÔ TRONG NƯỚC & QUỐC TẾ */}
        <div className="p-5 rounded-2xl border" style={{ background: "var(--surface)", borderLeft: "2px solid rgba(59,130,246,0.50)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg" style={{ background: "rgba(59,130,246,0.10)" }}>
              <Globe className="w-4 h-4" style={{ color: "#3b82f6" }} />
            </div>
            <h3 className="text-sm font-black uppercase tracking-wider" style={{ color: "#3b82f6" }}>
              Vĩ Mô Trong Nước &amp; Quốc Tế
            </h3>
          </div>
          <div className="space-y-3">
            {data.macroBullets.map((bullet, i) => (
              <p key={i} className="text-sm leading-relaxed pl-3 border-l border-[var(--border)]" style={{ color: "var(--text-secondary)" }}>
                {bullet}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* RỦI RO / CƠ HỘI */}
      <div className="p-5 rounded-2xl border" style={{ background: "var(--surface)", borderLeft: "2px solid rgba(234,179,8,0.50)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg" style={{ background: "rgba(234,179,8,0.10)" }}>
            <AlertTriangle className="w-4 h-4" style={{ color: "#eab308" }} />
          </div>
          <h3 className="text-sm font-black uppercase tracking-wider" style={{ color: "#eab308" }}>
            Rủi Ro / Cơ Hội
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2.5">
            <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "rgba(192,57,43,0.80)" }}>⚠️ Rủi ro</p>
            {data.riskBullets.map((bullet, i) => (
              <p key={i} className="text-sm leading-relaxed pl-3 border-l" style={{ color: "var(--text-muted)", borderColor: "rgba(192,57,43,0.20)" }}>
                {bullet}
              </p>
            ))}
          </div>
          <div className="space-y-2.5">
            <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "rgba(22,163,74,0.80)" }}>💡 Cơ hội</p>
            {data.opportunityBullets.map((bullet, i) => (
              <p key={i} className="text-sm leading-relaxed pl-3 border-l" style={{ color: "var(--text-muted)", borderColor: "rgba(22,163,74,0.20)" }}>
                {bullet}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* AI Summary Footer */}
      <Card className="p-4 bg-[var(--surface-2)]">
        <div className="flex items-start gap-2">
        <Zap className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#16a34a" }} />
          <div>
            <p className="text-[12px] mb-1" style={{ color: "var(--text-muted)" }}>🤖 ADN AI · Nhận định tổng hợp</p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{data.aiSummary}</p>
          </div>
        </div>
        <div className="mt-3 pt-2 border-t border-[var(--border)] flex items-center justify-between">
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Thông tin tham khảo · không phải khuyến nghị đầu tư</p>
          <p className="text-[11px] font-mono" style={{ color: "rgba(22,163,74,0.50)" }}>adncapital.vn</p>
        </div>
      </Card>
    </div>
  );
}
