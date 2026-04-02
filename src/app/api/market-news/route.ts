import { NextResponse, type NextRequest } from "next/server";

export const revalidate = 3600; // Cache 1 tiếng — tin tức không thay đổi thường xuyên

const BACKEND = process.env.FIINQUANT_URL ?? "http://localhost:8000";

/* In-memory cache theo type */
const cache: Record<string, { data: unknown; ts: number }> = {};
const TTL = 3600_000; // 1 tiếng

/**
 * GET /api/market-news?type=morning|eod
 * Proxy → Python FastAPI /api/v1/news/morning | /api/v1/news/eod
 * Fallback mock data nếu backend không phản hồi.
 */
export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") ?? "morning";

  if (type !== "morning" && type !== "eod") {
    return NextResponse.json(
      { error: "type phải là 'morning' hoặc 'eod'" },
      { status: 400 },
    );
  }

  /* Cache hit */
  if (cache[type] && Date.now() - cache[type].ts < TTL) {
    return NextResponse.json(cache[type].data);
  }

  /* Proxy to backend */
  try {
    const res = await fetch(`${BACKEND}/api/v1/news/${type}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(60_000), // Gemini có thể mất ~30s
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[/api/market-news] Backend error (${type}):`, res.status, text);
      // Fallback mock
      return NextResponse.json(type === "morning" ? MORNING_MOCK : EOD_MOCK);
    }

    const data = await res.json();
    cache[type] = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (err) {
    console.error(`[/api/market-news] Fetch error (${type}):`, err);
    // Fallback mock khi backend không chạy
    return NextResponse.json(type === "morning" ? MORNING_MOCK : EOD_MOCK);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  MOCK DATA — cấu trúc khớp 100% interface MorningData & EodData
 * ═══════════════════════════════════════════════════════════════════════════ */

const MORNING_MOCK = {
  date: "01/04/2026",
  reference_indices: [
    { name: "VN-INDEX", value: 1702.93, change_pct: 1.7 },
    { name: "DOW JONES", value: 39124.5, change_pct: -0.5 },
    { name: "DXY", value: 104.15, change_pct: 0.15 },
    { name: "VÀNG", value: 2345.1, change_pct: 1.2 },
    { name: "DẦU WTI", value: 85.6, change_pct: 2.1 },
  ],
  vn_market: [
    "Nhiều doanh nghiệp công bố mục tiêu lợi nhuận 2026 tăng trưởng mạnh, đặc biệt nhóm Ngân hàng và Chứng khoán.",
    "Kế hoạch huy động vốn của MBB và các dự án FDI lớn được chú ý, tổng vốn đăng ký FDI Q1/2026 đạt 6.8 tỷ USD.",
    "Nhóm cổ phiếu Chứng khoán và Thép hút tiền nhờ kỳ vọng KRX và nâng hạng thị trường lên Emerging Market.",
    "Thanh khoản HoSE phiên trước đạt 19,500 tỷ đồng — tăng 15% so với trung bình 20 phiên, dòng tiền quay lại mạnh.",
    "Tự doanh CTCK mua ròng phiên thứ 3 liên tiếp, tập trung gom SSI, HPG, FPT — tín hiệu tích cực từ Smart Money.",
  ],
  macro: [
    "GDP Việt Nam Q1/2026 tăng 6.93% — cao nhất 5 năm, xuất khẩu tăng 14.5% YoY.",
    "NHNN giữ nguyên lãi suất điều hành, tỷ giá USD/VND ổn định quanh 25,300.",
    "CPI tháng 3 tăng 3.2% YoY — nằm trong tầm kiểm soát, hỗ trợ chính sách nới lỏng tiền tệ.",
    "Xung đột Trung Đông đẩy giá Dầu WTI vượt 85 USD/thùng, ảnh hưởng chi phí vận tải.",
    "Fed có khả năng giữ nguyên lãi suất trong kỳ họp tới do lạm phát dính, DXY neo trên 104.",
    "Cổ phiếu công nghệ Mỹ biến động mạnh trước mùa báo cáo tài chính Q1, Nasdaq giảm 0.8%.",
  ],
  risk_opportunity: [
    "Rủi ro: Áp lực tỷ giá tăng khi DXY neo cao trên 104 điểm.",
    "Cơ hội: Dòng vốn ngoại có dấu hiệu mua ròng trở lại ở nhóm Bluechips.",
  ],
};

const EOD_MOCK = {
  date: "01/04/2026",
  vnindex: 1702.93,
  change_pct: 1.7,
  liquidity: 22190,
  breadth: { up: 250, down: 180, unchanged: 70, total: 500 },
  session_summary:
    "VN-Index tăng 1.7% lên 1,702 điểm trong phiên giao dịch sôi động. Thanh khoản cải thiện đáng kể với hơn 22,000 tỷ đồng khớp lệnh.",
  liquidity_detail:
    "Thanh khoản toàn thị trường đạt 22,190 tỷ đồng, tăng 15% so với phiên trước. HoSE đóng góp 19,500 tỷ đồng, HNX 2,690 tỷ đồng.",
  foreign_flow:
    "Khối ngoại BÁN ròng nhẹ 150 tỷ đồng trên HoSE, tập trung chốt lời VHM, VIC. Tuy nhiên MUA ròng mạnh SSI, HPG qua kênh Thỏa thuận.",
  notable_trades:
    "Tự doanh CTCK MUA ròng 300 tỷ đồng, gom mạnh SSI, HPG, FPT. Khối lượng giao dịch lô lớn tập trung ở nhóm Chứng khoán và Ngân hàng.",
  outlook:
    "Thị trường có xu hướng tích lũy quanh vùng 1,700. Nhà đầu tư ưu tiên nhóm có dòng tiền tốt như Chứng khoán, Thép, và cơ hội ở nhóm Ngân hàng khi kỳ vọng room ngoại mở rộng.",
  sub_indices: [
    { name: "VN30", change_pts: 15.2, change_pct: 1.15 },
    { name: "VNMID", change_pts: 5.1, change_pct: 0.85 },
    { name: "VNSML", change_pts: -2.5, change_pct: -0.25 },
  ],
  foreign_top_buy: ["SSI", "HPG", "FPT", "MWG", "DGC"],
  foreign_top_sell: ["VHM", "VIC", "VNM", "MSN", "VRE"],
  prop_trading_top_buy: ["SSI", "HPG", "FPT", "TCB", "MBB"],
  prop_trading_top_sell: ["VHM", "NVL", "DIG", "PDR", "KDH"],
  sector_gainers: [
    "Chứng khoán (SSI, VCI)",
    "Thép (HPG, HSG)",
    "Ngân hàng (MBB, CTG)",
  ],
  sector_losers: ["Bất động sản (NVL, PDR)", "Bán lẻ (PNJ)"],
  buy_signals: [
    "Chứng khoán (SSI, VCI)",
    "Thép (HPG, HSG)",
    "Ngân hàng (MBB, CTG)",
  ],
  sell_signals: ["Bất động sản (NVL, PDR)", "Bán lẻ (PNJ)"],
  top_breakout: ["SSI", "HPG", "MBB", "FPT"],
};
