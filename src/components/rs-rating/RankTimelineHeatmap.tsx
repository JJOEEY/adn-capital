"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const DEFAULT_START_DATE = "2026-04-01";
const MIN_VISIBLE_COLUMNS = 15;

export type RankTimelineValue = {
  date: string;
  score: number | null;
  stockCount?: number;
};

export type RankSectorMember = {
  ticker: string;
  name: string;
  sector: string;
  latestScore: number | null;
  price: number | null;
  changePercent: number | null;
  valueBillion: number | null;
};

export type RankTimelineRow = {
  ticker?: string;
  name?: string;
  sector?: string;
  stockCount?: number;
  liquidStockCount?: number;
  latestScore: number;
  values: RankTimelineValue[];
  members?: RankSectorMember[];
};

export type RankTimelinePayload = {
  timeline?: string[];
  rows?: RankTimelineRow[];
  liquidityRule?: string;
  updatedAt?: string | null;
  startDate?: string | null;
};

type TimelineRange = "fromApr1" | "30" | "60" | "90" | "custom";

type RankTimelineHeatmapProps = {
  mode: "stocks" | "sectors";
  data: RankTimelinePayload | null;
};

function scoreColor(score: number | null) {
  if (score == null || !Number.isFinite(score)) {
    return {
      background: "rgba(148,163,184,0.10)",
      color: "rgba(148,163,184,0.55)",
      borderColor: "rgba(148,163,184,0.12)",
    };
  }
  if (score >= 90) return { background: "#6d5dfc", color: "#f7f3ff", borderColor: "rgba(167,139,250,0.35)" };
  if (score >= 80) return { background: "#16a34a", color: "#ecfdf5", borderColor: "rgba(74,222,128,0.32)" };
  if (score >= 60) return { background: "#9ca33a", color: "#fffbea", borderColor: "rgba(250,204,21,0.28)" };
  if (score >= 40) return { background: "#f59e0b", color: "#fff7ed", borderColor: "rgba(251,146,60,0.28)" };
  return { background: "#ef4444", color: "#fff1f2", borderColor: "rgba(248,113,113,0.30)" };
}

function formatDateLabel(date: string) {
  const [, month, day] = date.split("-");
  return day && month ? `${day}/${month}` : date;
}

function formatCustomDate(value: string) {
  return value || "";
}

function formatNumber(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "-";
  return value.toLocaleString("vi-VN", { maximumFractionDigits: digits });
}

function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}%`;
}

function formatValueBillion(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tỷ`;
}

function buildVisibleDates(timeline: string[], range: TimelineRange, customStart: string, customEnd: string) {
  const dates = Array.from(new Set(timeline)).filter(Boolean).sort();
  if (dates.length === 0) return [];

  let selected: string[];
  if (range === "custom") {
    const start = formatCustomDate(customStart);
    const end = formatCustomDate(customEnd);
    selected = dates.filter((date) => (!start || date >= start) && (!end || date <= end));
  } else if (range === "fromApr1") {
    selected = dates.filter((date) => date >= DEFAULT_START_DATE);
  } else {
    selected = dates.slice(-Number(range));
  }

  if (selected.length === 0) selected = dates.slice(-MIN_VISIBLE_COLUMNS);
  if (selected.length < MIN_VISIBLE_COLUMNS && dates.length > selected.length) {
    const lastSelected = selected[selected.length - 1] ?? dates[dates.length - 1];
    const endIndex = Math.max(dates.indexOf(lastSelected), dates.length - 1);
    selected = dates.slice(Math.max(0, endIndex - MIN_VISIBLE_COLUMNS + 1), endIndex + 1);
  }
  return [...selected].sort((a, b) => b.localeCompare(a));
}

function trendText(row: RankTimelineRow) {
  const values = row.values.filter((item) => item.score != null).map((item) => item.score as number);
  const latest = values.at(-1);
  const previous = values.at(-2);
  if (latest == null || previous == null) return "Đi ngang";
  const diff = latest - previous;
  if (Math.abs(diff) < 0.05) return "Đi ngang";
  return diff > 0 ? `Tăng ${formatNumber(diff, 1)}` : `Giảm ${formatNumber(Math.abs(diff), 1)}`;
}

export function RankTimelineHeatmap({ mode, data }: RankTimelineHeatmapProps) {
  const [range, setRange] = useState<TimelineRange>("fromApr1");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedSector, setSelectedSector] = useState<string | null>(null);

  const timeline = data?.timeline ?? [];
  const rows = data?.rows ?? [];

  const visibleDates = useMemo(
    () => buildVisibleDates(timeline, range, customStart, customEnd),
    [customEnd, customStart, range, timeline],
  );

  const visibleRows = useMemo(() => {
    const dateSet = new Set(visibleDates);
    return rows
      .map((row) => ({
        ...row,
        values: row.values.filter((item) => dateSet.has(item.date)),
      }))
      .filter((row) => row.values.some((item) => item.score != null));
  }, [rows, visibleDates]);

  const selectedSectorRow = mode === "sectors"
    ? visibleRows.find((row) => (row.sector ?? row.name ?? "") === selectedSector) ?? null
    : null;

  const title = mode === "stocks" ? "Cổ phiếu" : "Nhóm ngành";
  const emptyText =
    mode === "stocks"
      ? "Chưa có đủ lịch sử ADN Rank để vẽ timeline cổ phiếu."
      : "Chưa có đủ dữ liệu ngành để vẽ timeline.";

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-base font-black" style={{ color: "var(--text-primary)" }}>
            Timeline ADN Rank - {title}
          </h2>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Mặc định từ 01/04/2026. Mỗi ô là điểm ADN Rank của một phiên.
          </p>
          {mode === "sectors" && data?.liquidityRule ? (
            <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
              {data.liquidityRule}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            ["fromApr1", "Từ 01/04"],
            ["30", "30 phiên"],
            ["60", "60 phiên"],
            ["90", "90 phiên"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setRange(value as TimelineRange)}
              className="rounded-full border px-3 py-1.5 text-xs font-bold transition"
              style={
                range === value
                  ? { background: "rgba(16,185,129,0.16)", borderColor: "rgba(16,185,129,0.35)", color: "#34d399" }
                  : { borderColor: "var(--border)", color: "var(--text-muted)" }
              }
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setRange("custom")}
            className="rounded-full border px-3 py-1.5 text-xs font-bold transition"
            style={
              range === "custom"
                ? { background: "rgba(96,165,250,0.16)", borderColor: "rgba(96,165,250,0.35)", color: "#93c5fd" }
                : { borderColor: "var(--border)", color: "var(--text-muted)" }
            }
          >
            Tùy chọn
          </button>
        </div>
      </div>

      {range === "custom" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="date"
            value={customStart}
            onChange={(event) => setCustomStart(event.target.value)}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none"
            style={{ color: "var(--text-primary)" }}
            aria-label="Ngày bắt đầu"
          />
          <input
            type="date"
            value={customEnd}
            onChange={(event) => setCustomEnd(event.target.value)}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none"
            style={{ color: "var(--text-primary)" }}
            aria-label="Ngày kết thúc"
          />
        </div>
      ) : null}

      <div className="mt-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
        Đang hiển thị {visibleRows.length} dòng và {visibleDates.length} cột ngày.
      </div>

      {visibleDates.length === 0 || visibleRows.length === 0 ? (
        <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          {emptyText}
        </div>
      ) : (
        <div className="mt-4 max-h-[620px] overflow-auto rounded-xl border border-[var(--border)]">
          <div
            className="grid min-w-max gap-px"
            style={{
              gridTemplateColumns: `minmax(170px, 220px) repeat(${visibleDates.length}, minmax(34px, 40px))`,
            }}
          >
            <div className="sticky left-0 top-0 z-20 bg-[var(--surface)] px-2 py-2 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              {title}
            </div>
            {visibleDates.map((date) => (
              <div key={date} className="sticky top-0 z-10 bg-[var(--surface)] px-1 py-2 text-center text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>
                {formatDateLabel(date)}
              </div>
            ))}

            {visibleRows.map((row) => {
              const label = mode === "stocks" ? row.ticker ?? row.name ?? "-" : row.sector ?? "-";
              const subLabel = mode === "stocks" ? row.sector : `${row.stockCount ?? 0} mã · ${trendText(row)}`;
              const valueByDate = new Map(row.values.map((item) => [item.date, item]));
              const isSelected = mode === "sectors" && selectedSector === label;
              return (
                <div key={label} className="contents">
                  <button
                    type="button"
                    onClick={() => {
                      if (mode === "sectors") setSelectedSector(isSelected ? null : label);
                    }}
                    className="sticky left-0 z-10 flex min-h-[34px] items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-left hover:bg-[var(--surface-2)]"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs font-black" style={{ color: "var(--text-primary)" }}>
                        {label}
                      </div>
                      <div className="truncate text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {subLabel}
                      </div>
                    </div>
                    <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: "#a7f3d0" }}>
                      {row.latestScore.toFixed(0)}
                      {mode === "sectors" ? (isSelected ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : null}
                    </span>
                  </button>
                  {visibleDates.map((date) => {
                    const score = valueByDate.get(date)?.score ?? null;
                    return (
                      <div
                        key={`${label}-${date}`}
                        className="flex h-8 items-center justify-center border border-black/10 text-[10px] font-bold transition-transform hover:z-20 hover:scale-125"
                        style={scoreColor(score)}
                        title={`${label} - ${date}: ${score == null ? "không có dữ liệu" : score.toFixed(1)}`}
                      >
                        {score == null ? "-" : score.toFixed(0)}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {mode === "sectors" && selectedSectorRow ? (
        <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <h3 className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
            Cổ phiếu trong nhóm {selectedSectorRow.sector}
          </h3>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            {(selectedSectorRow.members ?? []).length} mã, sắp xếp theo điểm ADN Rank.
          </p>
          <div className="mt-3 max-h-[360px] overflow-auto rounded-lg border border-[var(--border)]">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="sticky top-0 bg-[var(--surface)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="px-3 py-2 text-left text-xs uppercase" style={{ color: "var(--text-muted)" }}>Mã</th>
                  <th className="px-3 py-2 text-left text-xs uppercase" style={{ color: "var(--text-muted)" }}>Tên</th>
                  <th className="px-3 py-2 text-right text-xs uppercase" style={{ color: "var(--text-muted)" }}>Điểm</th>
                  <th className="px-3 py-2 text-right text-xs uppercase" style={{ color: "var(--text-muted)" }}>Giá</th>
                  <th className="px-3 py-2 text-right text-xs uppercase" style={{ color: "var(--text-muted)" }}>% thay đổi</th>
                  <th className="px-3 py-2 text-right text-xs uppercase" style={{ color: "var(--text-muted)" }}>GTGD</th>
                </tr>
              </thead>
              <tbody>
                {(selectedSectorRow.members ?? []).map((member) => (
                  <tr key={member.ticker} className="border-b border-[var(--border)] last:border-b-0">
                    <td className="px-3 py-2 font-black" style={{ color: "#10b981" }}>{member.ticker}</td>
                    <td className="px-3 py-2" style={{ color: "var(--text-secondary)" }}>{member.name}</td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{formatNumber(member.latestScore, 1)}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>{formatNumber(member.price, 2)}</td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: (member.changePercent ?? 0) >= 0 ? "#10b981" : "var(--danger)" }}>
                      {formatPercent(member.changePercent)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>{formatValueBillion(member.valueBillion)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
