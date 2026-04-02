"use client";

/**
 * GaugeChart – Đồng hồ đo sức mạnh VN-INDEX (0–10 điểm)
 * Dùng recharts PieChart với bán nguyệt (startAngle=180, endAngle=0)
 *
 * Dải màu (thang 10):
 *   0–3:   Đỏ    (Sợ hãi / Tiêu cực)
 *   4–5:   Cam    (Suy yếu / Thăm dò)
 *   6–7:   Xanh lá (Tích cực / Thăm dò)
 *   8–10:  Tím    (Bùng nổ / Full Margin)
 */

import { PieChart, Pie, Cell } from "recharts";

interface GaugeChartProps {
  score: number; // 0–10
  maxScore?: number; // mặc định 10
}

// Dải quạt: chia tổng 10 thành 3 phần (Quan sát / Thăm dò / Full Margin)
const SEGMENTS = [
  { value: 3, color: "#ef4444" },   // Đỏ:    0–3  QUAN SÁT
  { value: 4, color: "#f97316" },   // Cam:    4–7  THĂM DÒ
  { value: 3, color: "#a855f7" },   // Tím:    8–10 FULL MARGIN
];

const TOTAL = 10;

function getScoreLabel(score: number): string {
  if (score < 4) return "QUAN SÁT";
  if (score <= 7) return "THĂM DÒ";
  return "FULL MARGIN";
}

function getScoreColor(score: number): string {
  if (score < 4) return "#ef4444";
  if (score <= 7) return "#f97316";
  return "#a855f7";
}

export function GaugeChart({ score, maxScore = 10 }: GaugeChartProps) {
  const safeScore = Math.max(0, Math.min(maxScore, score));
  const label = getScoreLabel(safeScore);
  const color = getScoreColor(safeScore);

  // Kim chỉ: tính góc từ 180° (trái) → 0° (phải)
  const needleAngle = 180 - (safeScore / TOTAL) * 180;
  const needleRad = (needleAngle * Math.PI) / 180;

  const cx = 150;
  const cy = 130;
  const r = 95;

  const needleX = cx + r * 0.82 * Math.cos(needleRad);
  const needleY = cy - r * 0.82 * Math.sin(needleRad);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 300, height: 175 }}>
        <PieChart width={300} height={175}>
          <Pie
            data={SEGMENTS}
            dataKey="value"
            cx={cx}
            cy={cy}
            startAngle={180}
            endAngle={0}
            innerRadius={65}
            outerRadius={95}
            paddingAngle={2}
            stroke="none"
          >
            {SEGMENTS.map((seg, i) => (
              <Cell key={i} fill={seg.color} opacity={0.85} />
            ))}
          </Pie>

          <Pie
            data={[{ value: TOTAL }]}
            dataKey="value"
            cx={cx}
            cy={cy}
            startAngle={0}
            endAngle={-180}
            innerRadius={65}
            outerRadius={95}
            fill="transparent"
            stroke="none"
          />
        </PieChart>

        {/* Kim chỉ */}
        <svg
          className="absolute inset-0"
          width={300}
          height={175}
          style={{ pointerEvents: "none" }}
        >
          <line
            x1={cx}
            y1={cy}
            x2={needleX}
            y2={needleY}
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 4px ${color})`,
              transition: "all 1s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          />
          <circle cx={cx} cy={cy} r={6} fill={color} />
          <circle cx={cx} cy={cy} r={3} fill="#0a0a0a" />
        </svg>
      </div>

      {/* Score + Label — bọc chung 1 div flex-col với gap đảm bảo không chồng */}
      <div className="flex flex-col items-center justify-center gap-3 mt-6">
        <div className="flex flex-col items-center">
          <span
            className="text-4xl font-black leading-none"
            style={{ color, textShadow: `0 0 20px ${color}40` }}
          >
            {safeScore}
          </span>
          <span className="text-[11px] font-bold text-neutral-400 mt-1">
            / {maxScore} Điểm
          </span>
        </div>

        {/* Label trạng thái */}
        <div
          className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider"
          style={{
            color,
            backgroundColor: `${color}15`,
            border: `1px solid ${color}40`,
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

export function GaugeChartSkeleton() {
  return (
    <div className="flex flex-col items-center">
      <div className="w-[300px] h-[175px] rounded-xl bg-neutral-800/50 animate-pulse" />
      <div className="mt-1 w-24 h-7 rounded-full bg-neutral-800 animate-pulse" />
    </div>
  );
}
