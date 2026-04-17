/**
 * src/lib/mock-factory.ts
 *
 * Central repository for ALL mock/demo data used in presentation mode.
 * Import from here — never scatter mock data across multiple files.
 *
 * Usage:
 *   import { MockFactory } from "@/lib/mock-factory";
 *   const ticker = MockFactory.getTicker("FPT");
 */

// ── Mock Signals ─────────────────────────────────────────────────────
export const MOCK_SIGNALS = [
  {
    id: "mock-mwg-1",
    ticker: "MWG",
    type: "DAU_CO",
    tier: "NGAN_HAN",
    status: "ACTIVE",
    entryPrice: 50_000,
    target: 53_500,
    stoploss: 48_500,
    navAllocation: 10,
    rrRatio: "1:2.3",
    triggerSignal: "Chạm MA200 + StochRSI cắt lên từ vùng quá bán (<20)",
    aiReasoning: "Hệ thống ghi nhận MWG chạm MA200 và StochRSI cắt lên, phù hợp kịch bản ngắn hạn. Điểm vào tham chiếu 50.000, stoploss 48.500.",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock-vcg-1",
    ticker: "VCG",
    type: "TRUNG_HAN",
    tier: "TRUNG_HAN",
    status: "ACTIVE",
    entryPrice: 25_000,
    target: 27_500,
    stoploss: 23_750,
    navAllocation: 20,
    rrRatio: "1:2.0",
    triggerSignal: "Phân kỳ dương RSI+MFI + dòng tiền thể chế vào mạnh",
    aiReasoning: "VCG xuất hiện phân kỳ dương RSI và MFI, dòng tiền cải thiện. Nhà đầu tư có thể theo dõi cho kịch bản trung hạn có quản trị rủi ro.",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock-fpt-1",
    ticker: "FPT",
    type: "SIEU_CO_PHIEU",
    tier: "LEADER",
    status: "ACTIVE",
    entryPrice: 120_000,
    target: 144_000,
    stoploss: 111_600,
    navAllocation: 30,
    rrRatio: "1:2.86",
    triggerSignal: "RS=91, VCP siết nền, Breakout đỉnh + fundamental=STRONG (LN Q4 +35%)",
    aiReasoning: "FPT đạt tiêu chí cổ phiếu dẫn dắt với RS 91, nền VCP và bùng nổ thanh khoản. Tỷ trọng đề xuất tối đa 30% NAV, stoploss 111.600.",
    createdAt: new Date().toISOString(),
  },
];

// ── Mock Ticker Details ───────────────────────────────────────────────
const MOCK_TICKERS: Record<string, ReturnType<typeof buildTickerData>> = {};

function buildTickerData(
  ticker: string,
  price: number,
  changePct: number,
  rsi: number,
  pe: number,
  pb: number,
  roe: number,
  profitGrowthYoY: number,
  tei: number,
  signal: string,
  ptktInsight: string,
  ptcbInsight: string,
) {
  const ta = {
    ticker,
    price: {
      current: price,
      changePct,
      high52w: Math.round(price * 1.35),
      low52w: Math.round(price * 0.65),
    },
    trend: { direction: changePct >= 0 ? "UPTREND" : "DOWNTREND", strength: "STRONG", adx: 28 },
    indicators: {
      rsi14: rsi,
      ema10: Math.round(price * 1.01),
      ema30: Math.round(price * 0.97),
      ema50: Math.round(price * 0.94),
      ema200: Math.round(price * 0.85),
      macdHistogram: changePct > 0 ? 1.2 : -0.8,
      mfi14: 58,
      tei,
    },
    signal,
    bullishScore: Math.round(6 + rsi / 25),
    bearishScore: Math.round(4 - rsi / 40),
    patterns: changePct > 0 ? ["VCP", "Higher High"] : ["Double Bottom"],
    levels: {
      support: Math.round(price * 0.95),
      resistance: Math.round(price * 1.08),
    },
  };

  const fa = {
    pe, pb, roe,
    roa: +(roe * 0.4).toFixed(1),
    eps: Math.round(price / pe),
    profitGrowthYoY,
    revenueGrowthYoY: +(profitGrowthYoY * 0.7).toFixed(1),
    revenueLastQ: Math.round(price * 120),
    profitLastQ: Math.round(price * 18),
    reportDate: "Q4 2025",
  };

  const news = [
    { title: `${ticker}: Kết quả kinh doanh Q4 2025 vượt kỳ vọng, lợi nhuận tăng ${profitGrowthYoY}% YoY`, time: "2 giờ trước" },
    { title: `Phân tích kỹ thuật ${ticker}: Tín hiệu ${signal} — Cơ hội đáng chú ý`, time: "5 giờ trước" },
    { title: `Khối ngoại mua ròng ${ticker} 3 phiên liên tiếp — Smart money tích lũy?`, time: "1 ngày trước" },
    { title: `CTCK KB Securities nâng giá mục tiêu ${ticker} lên ${Math.round(price * 1.25).toLocaleString("vi-VN")} đ`, time: "2 ngày trước" },
  ];

  return {
    technical: { stats: ta, aiInsight: ptktInsight },
    fundamental: { stats: fa, aiInsight: ptcbInsight },
    news,
    behavior: {
      teiScore: tei,
      status: tei >= 4 ? "Hưng phấn cực độ" : tei >= 3 ? "Rủi ro cao" : tei >= 2 ? "Trung tính" : "Bi quan — Cơ hội",
    },
    signal: MOCK_SIGNALS.find(s => s.ticker === ticker) ?? null,
  };
}

MOCK_TICKERS["FPT"] = buildTickerData(
  "FPT", 120_000, 2.45, 67, 24.5, 4.8, 28.4, 35,  3.2,
  "BUY — Breakout VCP",
  "Hệ thống ghi nhận FPT breakout vùng đỉnh cũ với thanh khoản mạnh 2,4 lần trung bình. RSI 67 chưa quá mua, EMA10 cắt lên EMA30. Entry 120.000, stoploss 111.600, target 144.000.",
  "Nền tảng cơ bản của FPT tích cực: P/E 24,5x, ROE 28,4%, lợi nhuận tăng 35% YoY. Nhà đầu tư có thể cân nhắc chiến lược trung-dài hạn."
);

MOCK_TICKERS["MWG"] = buildTickerData(
  "MWG", 50_000, -0.8, 42, 18.2, 2.1, 12.3, 8,  2.1,
  "WATCH — Chạm MA200",
  "MWG chạm MA200 và StochRSI vừa cắt lên — setup bounce ngắn hạn. RSI 42, chưa quá bán nhưng đang trong vùng hỗ trợ. Entry 50k, SL chặt 48.5k, target 53.5k. Phù hợp lướt sóng.",
  "MWG đang hồi phục sau chu kỳ khó khăn. P/E 18,2x, ROE 12,3%, lợi nhuận tăng 8% YoY ở mức trung bình. Nhà đầu tư nên giữ kỳ vọng thận trọng."
);

MOCK_TICKERS["VCG"] = buildTickerData(
  "VCG", 25_000, 1.2, 58, 15.4, 1.8, 15.6, 22,  2.8,
  "BUY — Phân kỳ RSI+MFI",
  "VCG xuất hiện phân kỳ dương RSI và MFI, cấu trúc giá tạo đáy cao dần. Entry tham chiếu 25.000, stoploss 23.750.",
  "VCG có P/E 15,4x, ROE 15,6% và lợi nhuận tăng 22% YoY nhờ hạ tầng công. Nhà đầu tư có thể theo dõi chiến lược trung hạn 3-6 tháng."
);

// ── Mock Factory Singleton ────────────────────────────────────────────
export const MockFactory = {
  /** Lấy danh sách tín hiệu mock */
  getSignals: () => MOCK_SIGNALS,

  /** Lấy dữ liệu widget của 1 mã cụ thể */
  getTicker: (ticker: string) => {
    const upper = ticker.toUpperCase();
    if (MOCK_TICKERS[upper]) return MOCK_TICKERS[upper];
    // Generic fallback for any ticker not in the list
    return buildTickerData(
      upper, 50_000, 0.5, 50, 15, 2, 15, 10, 2.5,
      "NEUTRAL",
      `Hệ thống đã nhận mã ${upper}. Hiện chưa có tín hiệu đủ mạnh, ưu tiên quan sát thêm.`,
      `${upper} chưa nằm trong danh sách theo dõi ưu tiên. Hệ thống sẽ cập nhật khi có dữ liệu BCTC mới.`
    );
  },

  /** Lấy tin tức mock */
  getNews: (ticker?: string) => {
    if (ticker && MOCK_TICKERS[ticker.toUpperCase()]) {
      return MOCK_TICKERS[ticker.toUpperCase()].news;
    }
    return [
      { title: "VN-INDEX vượt ngưỡng kháng cự 1.280 điểm — Thị trường bước vào giai đoạn tăng tốc", time: "1 giờ trước" },
      { title: "Khối ngoại mua ròng 800 tỷ đồng trong phiên — Tín hiệu tích cực cho dòng tiền ngoại", time: "3 giờ trước" },
      { title: "FED giữ nguyên lãi suất — Thị trường toàn cầu phản ứng tích cực", time: "5 giờ trước" },
    ];
  },
};
