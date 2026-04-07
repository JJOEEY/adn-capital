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
    iconBg: "bg-red-500/15",
    iconColor: "text-red-400",
    verdictColor: "text-red-400",
    badge: "bg-red-500/15 text-red-400 border-red-500/30",
  },
  probe: {
    glow: "yellow" as const,
    icon: Minus,
    iconBg: "bg-yellow-500/15",
    iconColor: "text-yellow-400",
    verdictColor: "text-yellow-400",
    badge: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  },
  full_margin: {
    glow: "emerald" as const,
    icon: TrendingUp,
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-400",
    verdictColor: "text-emerald-400",
    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
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
              <p className="text-[12px] font-bold text-emerald-400/70 uppercase tracking-[0.2em] mb-1">ADN CAPITAL</p>
              <div className="flex items-baseline gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">MORNING</h2>
                <h2 className="text-xl sm:text-2xl font-black text-emerald-400 tracking-tight">INTELLIGENCE</h2>
              </div>
              <p className="text-xs text-neutral-500 mt-1">{data.date} · Bản tin thị trường</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={`p-2.5 sm:p-3 rounded-xl ${style.iconBg}`}>
                <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${style.iconColor}`} />
              </div>
              <div className="text-left sm:text-right">
                <span className={`text-lg sm:text-xl font-black tracking-tight ${style.verdictColor}`}>
                  {data.verdict}
                </span>
                <div className={`mt-1 rounded-lg border px-2.5 py-1 text-[12px] font-semibold leading-tight ${style.badge}`}>
                  {data.action}
                </div>
              </div>
            </div>
          </div>

          {/* CHỈ SỐ THAM CHIẾU */}
          <div className="mt-5">
            <p className="text-[12px] font-bold text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Activity className="w-3 h-3" />
              Chỉ Số Tham Chiếu (so phiên trước)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {data.globalIndices.map((idx) => (
                <div
                  key={idx.name}
                  className="bg-neutral-900/80 rounded-xl px-3 py-2.5 border border-neutral-800"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide truncate">
                      {idx.name}
                    </span>
                    <span className="text-xs">{idx.icon}</span>
                  </div>
                  <p className="text-sm font-black text-white font-mono">
                    {formatIndex(idx.value)}
                  </p>
                  <p className={`text-[12px] font-bold ${idx.changePercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
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
        <Card className="p-5 border-l-2 border-l-emerald-500/50">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-emerald-500/10">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <h3 className="text-sm font-black text-emerald-400 uppercase tracking-wider">
              Thị Trường Việt Nam
            </h3>
          </div>
          <div className="space-y-3">
            {data.vnMarketBullets.map((bullet, i) => (
              <p key={i} className="text-sm text-neutral-300 leading-relaxed pl-3 border-l border-neutral-800">
                {bullet}
              </p>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-800">
            <div className="flex items-center gap-4 text-xs">
              <span className="text-emerald-400 font-bold">▲ {data.updown.up}</span>
              <span className="text-red-400 font-bold">▼ {data.updown.down}</span>
              <span className="text-neutral-500">— {data.updown.unchanged}</span>
              <span className="text-neutral-600 ml-auto">Vol: {data.totalVolume}</span>
            </div>
            <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden mt-2">
              <div className="bg-emerald-500 rounded-l-full" style={{ width: `${(data.updown.up / (data.updown.up + data.updown.down + data.updown.unchanged)) * 100}%` }} />
              <div className="bg-neutral-600" style={{ width: `${(data.updown.unchanged / (data.updown.up + data.updown.down + data.updown.unchanged)) * 100}%` }} />
              <div className="bg-red-500 rounded-r-full" style={{ width: `${(data.updown.down / (data.updown.up + data.updown.down + data.updown.unchanged)) * 100}%` }} />
            </div>
          </div>
        </Card>

        {/* VĨ MÔ TRONG NƯỚC & QUỐC TẾ */}
        <Card className="p-5 border-l-2 border-l-blue-500/50">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-blue-500/10">
              <Globe className="w-4 h-4 text-blue-400" />
            </div>
            <h3 className="text-sm font-black text-blue-400 uppercase tracking-wider">
              Vĩ Mô Trong Nước & Quốc Tế
            </h3>
          </div>
          <div className="space-y-3">
            {data.macroBullets.map((bullet, i) => (
              <p key={i} className="text-sm text-neutral-300 leading-relaxed pl-3 border-l border-neutral-800">
                {bullet}
              </p>
            ))}
          </div>
        </Card>
      </div>

      {/* RỦI RO / CƠ HỘI */}
      <Card className="p-5 border-l-2 border-l-yellow-500/50">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-yellow-500/10">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
          </div>
          <h3 className="text-sm font-black text-yellow-400 uppercase tracking-wider">
            Rủi Ro / Cơ Hội
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2.5">
            <p className="text-[12px] font-bold text-red-400/80 uppercase tracking-wider">⚠️ Rủi ro</p>
            {data.riskBullets.map((bullet, i) => (
              <p key={i} className="text-sm text-neutral-400 leading-relaxed pl-3 border-l border-red-500/20">
                {bullet}
              </p>
            ))}
          </div>
          <div className="space-y-2.5">
            <p className="text-[12px] font-bold text-emerald-400/80 uppercase tracking-wider">💡 Cơ hội</p>
            {data.opportunityBullets.map((bullet, i) => (
              <p key={i} className="text-sm text-neutral-400 leading-relaxed pl-3 border-l border-emerald-500/20">
                {bullet}
              </p>
            ))}
          </div>
        </div>
      </Card>

      {/* AI Summary Footer */}
      <Card className="p-4 bg-neutral-900/50">
        <div className="flex items-start gap-2">
          <Zap className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[12px] text-neutral-600 mb-1">🤖 ADN AI · Nhận định tổng hợp</p>
            <p className="text-xs text-neutral-400 leading-relaxed">{data.aiSummary}</p>
          </div>
        </div>
        <div className="mt-3 pt-2 border-t border-neutral-800 flex items-center justify-between">
          <p className="text-[11px] text-neutral-700">Thông tin tham khảo · không phải khuyến nghị đầu tư</p>
          <p className="text-[11px] text-emerald-500/50 font-mono">adncapital.vn</p>
        </div>
      </Card>
    </div>
  );
}
