import type { DatabaseResult } from "@/lib/database/contracts";
import type { DnseEodMarketData } from "@/lib/database/providers/dnse";

function fieldStatus(result: DatabaseResult<DnseEodMarketData>, field: string) {
  const related = result.missingFields.filter((item) => item.startsWith(`${field}:`) || item.includes(field));
  return related.length ? `thieu (${related.join(", ")})` : "da map";
}

export function formatDatabaseEodTelegramText(result: DatabaseResult<DnseEodMarketData>) {
  const data = result.data;
  const coverage = data?.runtimeCoverage;
  const storage = data?.storage;
  const lines = [
    "ADN Database v2 - EOD DNSE check",
    `Dataset: ${result.dataset}`,
    `Source: ${result.source}`,
    `Status: ${result.ok ? "OK" : "DEGRADED"}`,
    `Provider: ${result.providerStatus.code ?? (result.providerStatus.ok ? "ok" : "not_ok")}`,
    `Retrieved: ${result.retrievedAt}`,
    `Trading date: ${storage?.tradingDate ?? "-"}`,
    `Storage last row: ${storage?.lastReceivedAt ?? "-"}`,
    "",
    "Coverage:",
    `- Messages: ${coverage?.messages ?? 0}`,
    `- Latest rows: ${coverage?.latestRows ?? 0}`,
    `- Event rows: ${coverage?.eventRows ?? 0}`,
    `- Channels: ${data?.channels.map((item) => item.name).join(", ") ?? "-"}`,
    `- Active: ${coverage?.activeChannels.join(", ") || "-"}`,
    "",
    "EOD fields:",
    `- VNINDEX/sub indices: ${fieldStatus(result, "vnindex")}`,
    `- Thanh khoan: ${fieldStatus(result, "liquidity")}`,
    `- Do rong: ${fieldStatus(result, "breadth")}`,
    `- OHLC 1D: ${fieldStatus(result, "ohlcv_1d")}`,
    `- Khoi ngoai: ${fieldStatus(result, "foreign_flow")}`,
    `- Tu doanh: ${fieldStatus(result, "prop_trading_top_buy/prop_trading_top_sell/notable_trades.proprietary")}`,
    `- Ca nhan: ${fieldStatus(result, "individual_top_buy/individual_top_sell/notable_trades.retail")}`,
    "",
    result.missingFields.length
      ? `Missing: ${result.missingFields.slice(0, 12).join("; ")}${result.missingFields.length > 12 ? "..." : ""}`
      : "Missing: none",
  ];
  return lines.join("\n").slice(0, 3900);
}

function formatNumber(value: number | null | undefined, digits = 2) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("vi-VN", { maximumFractionDigits: digits })
    : "chưa đủ số liệu";
}

function formatTy(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "chưa đủ số liệu";
  return `${(value / 1_000_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tỷ`;
}

function formatPct(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${value > 0 ? "+" : ""}${value.toFixed(2)}%`
    : "chưa đủ số liệu";
}

function formatTop(items: string[] | undefined, empty = "chưa đủ số liệu") {
  return items?.length ? items.slice(0, 5).join(", ") : empty;
}

export function formatDatabaseEodPublicBriefText(result: DatabaseResult<DnseEodMarketData>, dateLabel: string) {
  const data = result.data;
  const vnindex = data?.indices?.find((item) => item.ticker === "VNINDEX");
  const vn30 = data?.indices?.find((item) => item.ticker === "VN30");
  const breadth = data?.breadth;
  const liquidity = data?.liquidity;
  const foreign = data?.foreignFlow;
  const fallback = data?.fallback?.fiinquant;
  const foreignNet = typeof foreign?.netValue === "number" ? foreign.netValue : null;
  const flowNote =
    foreignNet == null
      ? "Dòng tiền khối ngoại chưa đủ số liệu để kết luận."
      : foreignNet > 0
        ? `Khối ngoại mua ròng ${formatTy(foreignNet)}, hỗ trợ tâm lý thị trường.`
        : foreignNet < 0
          ? `Khối ngoại bán ròng ${formatTy(Math.abs(foreignNet))}, cần quản trị rủi ro ngắn hạn.`
          : "Khối ngoại giao dịch cân bằng, chưa tạo tín hiệu dòng tiền rõ rệt.";

  return [
    `🌙 *BẢN TIN TỔNG HỢP 19:00 — ${dateLabel}*`,
    "",
    "📊 *KẾT QUẢ CHỈ SỐ:*",
    `• VN-INDEX: ${formatNumber(vnindex?.value)} | ${formatPct(vnindex?.changePct)}`,
    `• VN30: ${formatNumber(vn30?.value)} | ${formatPct(vn30?.changePct)}`,
    "",
    "💧 *THANH KHOẢN & ĐỘ RỘNG:*",
    `• Giá trị khớp lệnh: ${formatTy(liquidity?.matchedValue)}`,
    `• Thỏa thuận: ${formatTy(liquidity?.negotiatedValue)}`,
    `• Độ rộng: ${formatNumber(breadth?.up, 0)} mã tăng / ${formatNumber(breadth?.down, 0)} mã giảm / ${formatNumber(breadth?.unchanged, 0)} mã đứng giá`,
    "",
    "🏦 *DÒNG TIỀN NHÀ ĐẦU TƯ:*",
    `• Khối ngoại: Mua ${formatTy(foreign?.buyValue)} | Bán ${formatTy(foreign?.sellValue)} | Ròng ${formatTy(foreign?.netValue)}`,
    `• Tự doanh mua nổi bật: ${formatTop(fallback?.propTradingTopBuy)}`,
    `• Tự doanh bán nổi bật: ${formatTop(fallback?.propTradingTopSell)}`,
    `• Cá nhân mua nổi bật: ${formatTop(fallback?.individualTopBuy)}`,
    `• Cá nhân bán nổi bật: ${formatTop(fallback?.individualTopSell)}`,
    "",
    "💡 *NHẬN ĐỊNH SMART MONEY:*",
    `• ${flowNote}`,
    `• Thị trường cần được theo dõi theo thanh khoản, độ rộng và nhóm dẫn dắt trong phiên kế tiếp.`,
    "",
    "_Powered by ADN Capital AI_",
  ].join("\n").slice(0, 3900);
}
