"use client";

import { Zap, Clock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getSignalLabel, formatPrice } from "@/lib/utils";
import type { Signal } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

type LoaiTinHieu = "SIEU_CO_PHIEU" | "TRUNG_HAN" | "DAU_CO";

interface SignalCardProps {
  signal: Signal;
  index: number;
}

/** Cấu hình màu neon cho từng loại tín hiệu */
const cauHinhLoai: Record<LoaiTinHieu, {
  gradient: string;
  badge: "purple" | "emerald" | "yellow";
  iconColor: string;
  borderColor: string;
  glowClass: string;
}> = {
  SIEU_CO_PHIEU: {
    gradient: "from-purple-500/10 via-purple-500/5 to-transparent",
    badge: "purple",
    iconColor: "text-purple-400",
    borderColor: "border-purple-500/30 hover:border-purple-500/50",
    glowClass: "shadow-purple-500/10 hover:shadow-purple-500/20",
  },
  TRUNG_HAN: {
    gradient: "from-emerald-500/10 via-emerald-500/5 to-transparent",
    badge: "emerald",
    iconColor: "text-emerald-400",
    borderColor: "border-emerald-500/30 hover:border-emerald-500/50",
    glowClass: "shadow-emerald-500/10 hover:shadow-emerald-500/20",
  },
  DAU_CO: {
    gradient: "from-yellow-500/10 via-yellow-500/5 to-transparent",
    badge: "yellow",
    iconColor: "text-yellow-400",
    borderColor: "border-yellow-500/30 hover:border-yellow-500/50",
    glowClass: "shadow-yellow-500/10 hover:shadow-yellow-500/20",
  },
};

export function SignalCard({ signal, index }: SignalCardProps) {
  const cfg = cauHinhLoai[signal.type as LoaiTinHieu] ?? cauHinhLoai.DAU_CO;

  const thoiGian = formatDistanceToNow(new Date(signal.createdAt), {
    addSuffix: true,
    locale: vi,
  });

  return (
    <Card
      className={`p-4 bg-gradient-to-br ${cfg.gradient} ${cfg.borderColor} shadow-lg ${cfg.glowClass} transition-all duration-300`}
    >
      {/* Header: Mã cổ phiếu + thời gian */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              signal.type === "SIEU_CO_PHIEU"
                ? "bg-purple-500/20"
                : signal.type === "TRUNG_HAN"
                ? "bg-emerald-500/20"
                : "bg-yellow-500/20"
            }`}
          >
            <Zap className={`w-4 h-4 ${cfg.iconColor}`} />
          </div>
          <span className="text-lg font-black text-white font-mono tracking-wide">
            {signal.ticker}
          </span>
        </div>
        <div className="flex items-center gap-1 text-neutral-600">
          <Clock className="w-3 h-3" />
          <span className="text-[10px]">{thoiGian}</span>
        </div>
      </div>

      {/* Badge loại tín hiệu — có hiệu ứng pulse cho Siêu Cổ Phiếu */}
      <div className="mb-3">
        <Badge
          variant={cfg.badge}
          className={signal.type === "SIEU_CO_PHIEU" ? "animate-pulse" : ""}
        >
          {getSignalLabel(signal.type)}
        </Badge>
      </div>

      {/* Giá vào lệnh (Entry) — nổi bật */}
      <div className="rounded-lg bg-neutral-900/60 border border-neutral-800 p-3 mb-2">
        <p className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">
          Điểm vào lệnh
        </p>
        <p className="text-xl font-black text-white font-mono">
          {formatPrice(signal.entryPrice)}
        </p>
      </div>

      {/* Lý do (nếu có) */}
      {signal.reason && (
        <p className="text-xs text-neutral-400 line-clamp-2 mt-2">
          {signal.reason}
        </p>
      )}
    </Card>
  );
}
