import { getDatabaseAidenTickerContext, assertAidenStockDatasetAllowed } from "@/lib/database/aiden/context";
import type { DatabaseAidenTickerContext } from "@/lib/database/aiden/types";
import { prisma } from "@/lib/prisma";

type AidenStockV2Input = {
  message: string;
  currentTicker?: string | null;
  surface?: "stock" | "aiden";
  context?: {
    userId?: string | null;
    userRole?: string | null;
    systemRole?: string | null;
  };
};

export type AidenStockV2Result = {
  message: string;
  ticker: string | null;
  tickers: string[];
  recommendation: null;
  model: "database-v2-stock-template";
};

const STOCK_CUE_PATTERN =
  /\b(phan tich|co phieu|ma|ticker|gia|mua|ban|target|ho tro|khang cu|ptkt|ptcb|ta|fa|chart|dinh gia|bao cao|bctc)\b/i;

const STOCK_CUE_WITH_TICKER_PATTERN =
  /\b(?:phan tich|co phieu|ma|ticker|gia|mua|ban|target|ho tro|khang cu|ptkt|ptcb|ta|fa|chart|dinh gia|bao cao|bctc)\s+([A-Za-z0-9._-]{2,12})\b/gi;

function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function hasStockCue(message: string) {
  return STOCK_CUE_PATTERN.test(stripDiacritics(message).toLowerCase());
}

function isUppercaseTickerToken(value: string) {
  return /^[A-Z][A-Z0-9._-]{1,11}$/.test(value);
}

function collectTickerCandidates(message: string, currentTicker?: string | null) {
  const candidates = new Set<string>();
  const current = currentTicker?.trim();
  const stockCue = hasStockCue(message);

  if (current) candidates.add(current);

  for (const match of message.matchAll(/\$([A-Za-z0-9._-]{2,12})\b/g)) {
    candidates.add(match[1] ?? "");
  }

  for (const match of message.matchAll(/\b([A-Z][A-Z0-9._-]{1,11})\b/g)) {
    const token = match[1] ?? "";
    if (isUppercaseTickerToken(token)) candidates.add(token);
  }

  if (stockCue) {
    const normalized = stripDiacritics(message);
    for (const match of normalized.matchAll(STOCK_CUE_WITH_TICKER_PATTERN)) {
      candidates.add(match[1] ?? "");
    }
  }

  return Array.from(candidates)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
}

async function resolveTickerCandidates(message: string, currentTicker?: string | null) {
  const candidates = collectTickerCandidates(message, currentTicker);
  const resolved: string[] = [];
  for (const candidate of candidates) {
    const ticker = await resolveDatabaseV2Ticker(candidate, candidate === currentTicker);
    if (ticker && !resolved.includes(ticker)) resolved.push(ticker);
  }
  return resolved.slice(0, 4);
}

const TICKER_UNIVERSE_DATASETS = ["market.instruments", "market.realtime", "market.board", "market.ohlcv"];

async function resolveDatabaseV2Ticker(candidate: string, trustedCurrentTicker = false) {
  const ticker = candidate.trim().replace(/^\$/, "").toUpperCase();
  if (!/^[A-Z0-9._-]{2,12}$/.test(ticker)) return null;

  for (const dataset of TICKER_UNIVERSE_DATASETS) {
    assertAidenStockDatasetAllowed(dataset);
  }

  const [toolRow, marketRow] = await Promise.all([
    prisma.databaseToolLatest.findFirst({
      where: {
        dataset: { in: TICKER_UNIVERSE_DATASETS },
        key: ticker,
      },
      select: { key: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.databaseMarketLatest.findFirst({
      where: {
        dataset: { in: TICKER_UNIVERSE_DATASETS },
        symbol: ticker,
      },
      select: { symbol: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  if (toolRow?.key || marketRow?.symbol) return ticker;
  return trustedCurrentTicker ? ticker : null;
}

export async function shouldRouteAidenStockV2(message: string, currentTicker?: string | null) {
  if (currentTicker?.trim()) return true;
  const candidates = collectTickerCandidates(message, null);
  if (!candidates.length) return false;
  if (!hasStockCue(message) && candidates.every((candidate) => !isUppercaseTickerToken(candidate))) return false;
  const tickers = await resolveTickerCandidates(message, null);
  return tickers.length > 0 && (hasStockCue(message) || candidates.some(isUppercaseTickerToken));
}

function formatNumber(value: number | null | undefined, maxDigits = 2) {
  if (value == null || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: maxDigits }).format(value);
}

function formatPct(value: number | null | undefined) {
  const formatted = formatNumber(value, 2);
  return formatted == null ? null : `${formatted}%`;
}

function compactJoin(values: Array<string | null | undefined>, separator = " · ") {
  return values.filter((item): item is string => Boolean(item)).join(separator);
}

function compareToLabel(price: number | null, base: number | null | undefined, label: string) {
  if (price == null || base == null || base === 0) return null;
  const diff = ((price - base) / base) * 100;
  return `so với ${label} ${formatNumber(base, 0)} (${diff >= 0 ? "trên" : "dưới"} ${formatNumber(Math.abs(diff), 2)}%)`;
}

function candleLabel(ctx: DatabaseAidenTickerContext) {
  const candle = ctx.dailyOhlcv;
  if (!candle) return null;
  const close = candle.close ?? ctx.market.price;
  const open = candle.open;
  const high = candle.high;
  const low = candle.low;
  const direction = close != null && open != null ? (close >= open ? "tăng" : "giảm") : "chưa rõ";
  const bodyPct =
    close != null && open != null && high != null && low != null && high !== low
      ? formatNumber((Math.abs(close - open) / Math.abs(high - low)) * 100, 1)
      : null;
  const volume = formatNumber(candle.volume ?? ctx.market.volume, 0);
  const volumeMa = formatNumber(ctx.technical?.volumeMa20, 0);

  return compactJoin(
    [
      `Nến gần nhất ${direction}`,
      bodyPct ? `thân nến ${bodyPct}%` : null,
      volume ? `khối lượng ${volume}` : null,
      volumeMa ? `MA20 volume ${volumeMa}` : null,
    ],
    ", ",
  );
}

function renderFundamental(ctx: DatabaseAidenTickerContext) {
  const financial = ctx.fundamental.financialPeriod;
  const valuation = ctx.fundamental.valuation;
  const period = financial?.reportPeriod ?? "gần nhất";
  const financialLine = financial
    ? compactJoin([
        financial.eps ? `EPS ${financial.eps.display} đồng/cp` : null,
        financial.bvps ? `BVPS ${financial.bvps.display} đồng/cp` : null,
        financial.roe ? `ROE ${financial.roe.display}` : null,
        financial.roa ? `ROA ${financial.roa.display}` : null,
      ])
    : "";
  const valuationLine = valuation
    ? compactJoin([valuation.pe ? `P/E ${valuation.pe.display}x` : null, valuation.pb ? `P/B ${valuation.pb.display}x` : null])
    : "";

  if (financial && valuation) {
    return [
      `FA theo kỳ báo cáo gần nhất ${period}. ${valuationLine ? `${valuationLine} theo dữ liệu định giá cập nhật gần nhất trong hệ thống.` : ""}`,
      financialLine ? `Chỉ số tài chính: ${financialLine}.` : null,
      "Mức định giá cần được đối chiếu với tốc độ tăng trưởng lợi nhuận và dòng tiền thực tế, không nên chỉ nhìn riêng P/E hoặc P/B.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (financial) {
    return [
      `FA theo kỳ báo cáo gần nhất ${period}.`,
      financialLine ? `Chỉ số tài chính: ${financialLine}.` : null,
      "Hệ thống hiện chưa có P/E/P/B đủ dùng cho mã này.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (valuation) {
    return [
      `Hệ thống hiện có dữ liệu định giá gần nhất: ${valuationLine}.`,
      "Hệ thống hiện chưa có BCTC đủ dùng cho mã này.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return "Hệ thống hiện chưa có số liệu FA đủ dùng cho mã này.";
}

function renderSingleTicker(ctx: DatabaseAidenTickerContext) {
  const price = ctx.market.price ?? ctx.dailyOhlcv?.close ?? null;
  const changePct = ctx.market.changePct;
  const technical = ctx.technical;
  const support = technical?.support ?? ctx.dailyOhlcv?.low ?? null;
  const resistance = technical?.resistance ?? ctx.dailyOhlcv?.high ?? null;
  const supportText = formatNumber(support, 0);
  const resistanceText = formatNumber(resistance, 0);
  const candle = candleLabel(ctx);
  const maParts = compactJoin(
    [
      compareToLabel(price, technical?.ma20, "MA20"),
      compareToLabel(price, technical?.ma50, "MA50"),
      compareToLabel(price, technical?.ma200, "MA200"),
    ],
    ", ",
  );
  const rsi = formatNumber(technical?.rsi, 2);
  const macd = formatNumber(technical?.macdHistogram, 2);
  const positiveStructure =
    price != null && technical?.ma20 != null && technical?.ma50 != null && price >= technical.ma20 && price >= technical.ma50;

  return [
    `**${ctx.ticker}**`,
    "",
    "**Phân tích cấu trúc (Biểu đồ cổ phiếu)**",
    `- Giá hiện tại ${formatNumber(price, 0) ?? "chưa có"}${changePct != null ? `, biến động ${formatPct(changePct)}` : ""}.${maParts ? ` ${maParts}.` : ""}${candle ? ` ${candle}.` : ""}${rsi ? ` RSI ${rsi}.` : ""}${macd ? ` MACD histogram ${macd}.` : ""}`,
    positiveStructure
      ? "Cấu trúc kỹ thuật đang tích cực khi giá nằm trên các đường trung bình quan trọng."
      : "Cấu trúc kỹ thuật cần thêm xác nhận, ưu tiên quan sát phản ứng giá tại các vùng quan trọng.",
    "",
    "**Phân tích vùng giá**",
    `- Hỗ trợ: ${supportText ?? "chưa có dữ liệu đủ rõ"}.`,
    `- Kháng cự: ${resistanceText ?? "chưa có dữ liệu đủ rõ"}.`,
    technical?.ma20
      ? `Vùng cần lấy lại/giữ vững: quanh MA20 ${formatNumber(technical.ma20, 0)}.`
      : "Vùng cần theo dõi: vùng hỗ trợ/kháng cự gần nhất trên biểu đồ.",
    "",
    "**Chiến lược**",
    `- Nếu đang có sẵn vị thế: tiếp tục nắm giữ khi giá còn giữ được vùng ${supportText ?? "hỗ trợ gần nhất"}; có thể hạ tỷ trọng nếu hồi lên kháng cự nhưng thanh khoản yếu.`,
    "- Nếu mua mới: chỉ nên thăm dò khi giá phản ứng tốt tại vùng hỗ trợ, không mua đuổi khi chưa có xác nhận dòng tiền.",
    `- Vùng chốt lời/kháng cự cần theo dõi: ${resistanceText ?? "kháng cự gần nhất"}.`,
    `- Vùng cắt lỗ/quản trị rủi ro: ${supportText ?? "hỗ trợ gần nhất"}.`,
    "",
    "**Phân tích cơ bản**",
    renderFundamental(ctx),
    "",
    "**Kịch bản rủi ro**",
    `- Rủi ro tăng nếu giá mất vùng hỗ trợ ${supportText ?? "gần nhất"}.${macd ? ` MACD histogram ${macd} cho thấy xung lực cần thêm xác nhận.` : ""}`,
    "",
    "**Cảnh báo**",
    `- Ủng hộ: giá giữ được vùng ${formatNumber(technical?.ma20 ?? support, 0) ?? "hỗ trợ"} với thanh khoản cải thiện.`,
    `- Tiêu cực: mất ${supportText ?? "vùng hỗ trợ"} hoặc thanh khoản tăng mạnh trong phiên giảm.`,
    ctx.dailyOhlcv?.volume || technical?.volumeMa20
      ? `Note: khối lượng gần nhất ${formatNumber(ctx.dailyOhlcv?.volume ?? ctx.market.volume, 0) ?? "chưa rõ"}, MA20 volume ${formatNumber(technical?.volumeMa20, 0) ?? "chưa rõ"}.`
      : null,
    "",
    "**Kết luận**",
    positiveStructure
      ? "Hành động: có thể tiếp tục quan sát/nắm giữ có điều kiện, ưu tiên quản trị rủi ro tại vùng hỗ trợ."
      : "Hành động: chưa nên mua đuổi; chờ giá lấy lại vùng kỹ thuật quan trọng và có xác nhận dòng tiền.",
  ]
    .filter((line): line is string => line != null)
    .join("\n");
}

export async function runAidenStockChatV2Only(input: AidenStockV2Input): Promise<AidenStockV2Result> {
  const tickers = await resolveTickerCandidates(input.message, input.currentTicker);
  if (!tickers.length) {
    return {
      message: "Anh/chị nhập giúp mã cổ phiếu cần phân tích, ví dụ: `Phân tích STB` hoặc `Phân tích DGC`.",
      ticker: null,
      tickers: [],
      recommendation: null,
      model: "database-v2-stock-template",
    };
  }

  const results = await Promise.all(tickers.map((ticker) => getDatabaseAidenTickerContext({ ticker })));
  const contexts = results.map((result) => result.data).filter((item): item is DatabaseAidenTickerContext => Boolean(item));
  const message = [
    ...contexts.map(renderSingleTicker),
    "Phân tích tham khảo, không phải khuyến nghị đầu tư. — ADN Capital",
  ].join("\n\n");

  return {
    message,
    ticker: contexts[0]?.ticker ?? tickers[0] ?? null,
    tickers,
    recommendation: null,
    model: "database-v2-stock-template",
  };
}
