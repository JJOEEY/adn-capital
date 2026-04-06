/**
 * Seed script: ChatKnowledge — Tạo knowledge base cho AI chatbot.
 *
 * Chạy: npx tsx scripts/seeds/seed-knowledge.ts
 * Hoặc: node --loader tsx scripts/seeds/seed-knowledge.ts
 *
 * Dữ liệu này tạo tính nhất quán trong tư vấn:
 * - Quy tắc phân tích kỹ thuật (TA)
 * - Quy tắc phân tích cơ bản (FA)
 * - Quản lý rủi ro
 * - Chế độ thị trường (Market Regime)
 * - Tâm lý giao dịch
 * - Thuật ngữ chuẩn
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const KNOWLEDGE_DATA = [
  // ═══════════════════════════════════════════════
  //  QUY TẮC PHÂN TÍCH KỸ THUẬT (TA)
  // ═══════════════════════════════════════════════
  {
    category: "ta_rules",
    title: "Hệ thống EMA chuẩn ADN",
    content: `## Hệ thống EMA chuẩn ADN Capital

### EMA ngắn hạn (Trading)
- **EMA10**: Xu hướng siêu ngắn (1-3 ngày). Giá cắt xuống EMA10 → cảnh báo.
- **EMA20**: Xu hướng ngắn hạn (1-2 tuần). EMA20 là "đường sống" của trader đầu cơ.

### EMA trung hạn (Swing)
- **EMA30**: Xu hướng 2-4 tuần. Phân biệt uptrend/downtrend ngắn.
- **EMA50**: Xu hướng trung hạn (1-3 tháng). Đây là MA QUAN TRỌNG NHẤT.

### EMA dài hạn (Investment)
- **EMA100**: Xu hướng 3-6 tháng.
- **EMA200**: Xu hướng dài hạn (>6 tháng). Phân biệt bull/bear market.

### Quy tắc giao cắt
- EMA10 cắt lên EMA30 → Tín hiệu MUA ngắn hạn
- EMA10 cắt xuống EMA30 → Tín hiệu BÁN ngắn hạn
- EMA50 > EMA100 → Uptrend trung hạn → Ưu tiên MUA
- EMA50 < EMA100 → Downtrend trung hạn → KHÔNG MUA, chỉ quan sát

### Quy tắc Death Cross / Golden Cross
- Golden Cross: EMA50 cắt lên EMA200 → BUY signal mạnh (hiếm, 2-3 lần/năm)
- Death Cross: EMA50 cắt xuống EMA200 → SELL signal mạnh`,
    priority: 10,
  },
  {
    category: "ta_rules",
    title: "RSI - Chỉ số sức mạnh tương đối",
    content: `## RSI(14) - Relative Strength Index

### Vùng giá trị
- **RSI > 70**: Quá mua (Overbought) → CẢNH BÁO chốt lời
- **RSI 50-70**: Xu hướng tăng → Giữ lệnh / tìm điểm mua
- **RSI 30-50**: Xu hướng giảm hoặc tích lũy → Thận trọng
- **RSI < 30**: Quá bán (Oversold) → TÌM ĐIỂM MUA (bắt đáy)

### Quy tắc ADN
1. KHÔNG MUA khi RSI > 75 (dù cổ phiếu đang tăng mạnh)
2. RSI < 30 + Volume tăng đột biến = Tín hiệu bắt đáy mạnh
3. RSI divergence (giá tạo đỉnh mới, RSI không) = Cảnh báo đảo chiều
4. RSI trung tính (45-55) + BB hẹp = Sắp breakout, chờ xác nhận hướng`,
    priority: 9,
  },
  {
    category: "ta_rules",
    title: "MACD - Hội tụ phân kỳ trung bình động",
    content: `## MACD(12, 26, 9)

### Tín hiệu
- **MACD cắt lên Signal**: Tín hiệu MUA
- **MACD cắt xuống Signal**: Tín hiệu BÁN
- **Histogram dương và tăng**: Momentum tăng mạnh
- **Histogram âm và giảm**: Momentum giảm mạnh
- **Histogram thu hẹp**: Chuẩn bị đổi chiều

### Quy tắc ADN
1. MACD cross trên đường 0 → Tín hiệu mua MẠNH
2. MACD cross dưới đường 0 → Chỉ là phục hồi ngắn, thận trọng
3. MACD divergence + RSI divergence → Xác nhận đảo chiều (rất đáng tin)
4. Histogram âm nhưng thu hẹp + RSI < 35 → Chuẩn bị bắt đáy`,
    priority: 8,
  },
  {
    category: "ta_rules",
    title: "Bollinger Bands & Volume",
    content: `## Bollinger Bands(20, 2σ) & Volume Analysis

### BB Signals
- Giá chạm BB trên + RSI > 70 → Bán/chốt lời
- Giá chạm BB dưới + RSI < 30 → Tìm điểm mua
- BB hẹp (squeeze) → Sắp breakout mạnh
- BB rộng → Thị trường volatile, giảm tỷ trọng

### Volume Rules
- Vol > 2x TB20 + Giá tăng → Xác nhận tín hiệu MUA mạnh
- Vol > 2x TB20 + Giá giảm → Panic sell, có thể bắt đáy sau đó
- Vol thấp + Giá tăng → Tăng không bền vững, CẨN THẬN
- Vol dần tăng qua 3-5 phiên → Accumulation, smart money đang gom`,
    priority: 7,
  },

  // ═══════════════════════════════════════════════
  //  QUẢN LÝ RỦI RO
  // ═══════════════════════════════════════════════
  {
    category: "risk_management",
    title: "Quản lý tỷ trọng theo Market Regime",
    content: `## Quản lý tỷ trọng danh mục ADN

### FULL MARGIN (Score ≥ 8/10)
- Tỷ trọng cổ phiếu: 80-100%
- Cho phép margin: Tối đa 1:1.5
- Focus: Blue-chip + Growth stocks có RS > 80

### THĂM DÒ (Score 5-7/10)
- Tỷ trọng cổ phiếu: 40-60%
- KHÔNG dùng margin
- Focus: Chỉ mua cổ phiếu RS > 70, stoploss chặt

### QUAN SÁT (Score < 5/10)
- Tỷ trọng cổ phiếu: 0-20%
- Hold tiền mặt 80%+
- Chỉ trading ngắn (1-3 ngày) nếu có tín hiệu rõ

### Quy tắc cắt lỗ
1. Stoploss mặc định: -7% từ giá mua
2. Trailing stop: Khi lãi > 15%, dời stop lên breakeven
3. KHÔNG BAO GIỜ average down khi cổ phiếu dưới EMA50
4. Maximum 1 lệnh = 10% tổng danh mục (phân tán rủi ro)
5. Tổng lỗ tối đa/tháng: -15% → Nghỉ giao dịch 1 tuần`,
    priority: 10,
  },
  {
    category: "risk_management",
    title: "Quy tắc Entry & Exit",
    content: `## Quy tắc vào/ra lệnh ADN

### Entry (MUA)
1. Chỉ mua khi Market Regime ≥ "THĂM DÒ"
2. Cổ phiếu phải có RS Rating ≥ 60
3. Phải có ít nhất 2/4 điều kiện:
   - Giá > EMA20
   - RSI 40-65 (không quá mua)
   - Volume > TB20
   - MACD histogram dương hoặc thu hẹp
4. Ưu tiên mua tại vùng hỗ trợ (EMA20/50, BB dưới)

### Exit (BÁN)
1. Chạm stoploss -7% → BÁN NGAY, không do dự
2. Mục tiêu lợi nhuận: R:R tối thiểu 2:1
3. Bán 50% khi lãi 10%, trailing stop phần còn lại
4. BÁN HẾT khi Market Regime chuyển "QUAN SÁT"
5. RSI > 80 + Volume giảm → Chốt lời toàn bộ`,
    priority: 9,
  },

  // ═══════════════════════════════════════════════
  //  CHẾ ĐỘ THỊ TRƯỜNG (Market Regime)
  // ═══════════════════════════════════════════════
  {
    category: "market_regime",
    title: "Phân loại chế độ thị trường",
    content: `## Market Regime Classification

### Bảng điểm sức khỏe thị trường (0-10)
Dựa trên VN-Index:
| Chỉ báo | Điều kiện ĐẠT | Điểm |
|---------|---------------|------|
| EMA10 > EMA30 | Uptrend ngắn | +2 |
| EMA50 > EMA100 | Uptrend trung hạn | +2 |
| RSI(14) 40-70 | Không quá mua/bán | +2 |
| MACD > Signal | Momentum tăng | +2 |
| MFI(14) > 50 | Dòng tiền vào | +2 |

### Phân loại
- **8-10 điểm → FULL MARGIN** (xanh lá): Thị trường bull, tất tay
- **5-7 điểm → THĂM DÒ** (vàng): Thị trường trung tính, cẩn trọng
- **0-4 điểm → QUAN SÁT** (đỏ): Thị trường bear, giữ tiền mặt

### Nguyên tắc
1. KHÔNG BAO GIỜ đi ngược market regime
2. Chuyển regime → Phải hành động trong 1 phiên (không chần chừ)
3. Khi nghi ngờ → Coi như "THĂM DÒ" (phòng thủ)`,
    priority: 10,
  },

  // ═══════════════════════════════════════════════
  //  TÂM LÝ GIAO DỊCH
  // ═══════════════════════════════════════════════
  {
    category: "trading_psychology",
    title: "Kiểm soát tâm lý giao dịch",
    content: `## Tâm lý giao dịch ADN

### Phát hiện FOMO
- Mua đuổi khi cổ phiếu đã tăng > 10% trong 3 phiên → FOMO
- Tăng tỷ trọng quá nhanh khi thấy thị trường tăng → FOMO
- Không chờ pullback về EMA20 mà mua ngay đỉnh → FOMO
→ Giải pháp: Luôn đợi giá về vùng hỗ trợ. Nếu miss → chờ setup tiếp.

### Phát hiện sợ hãi (Fear)
- Bán khi vừa chạm -3% (chưa tới stoploss -7%) → Fear
- Không dám mua khi có tín hiệu rõ ràng vì sợ → Fear
→ Giải pháp: Tuân thủ hệ thống. Stoploss là -7%, KHÔNG BÁN SỚM HƠN.

### Phát hiện Revenge Trading
- Mua lại ngay sau khi vừa cắt lỗ → Revenge
- Tăng size lệnh để "gỡ lại" → Rất nguy hiểm
→ Giải pháp: Sau mỗi lần cắt lỗ, nghỉ ít nhất 1 phiên.

### Kỷ luật
1. Giao dịch theo kế hoạch, KHÔNG theo cảm xúc
2. Ghi nhật ký mỗi giao dịch (Trading Journal)
3. Review tuần: Win rate, R:R thực tế, lỗi tâm lý
4. Tối đa 3 lệnh/ngày cho trader ngắn hạn`,
    priority: 8,
  },

  // ═══════════════════════════════════════════════
  //  PHÂN TÍCH CƠ BẢN
  // ═══════════════════════════════════════════════
  {
    category: "fa_rules",
    title: "Quy tắc phân tích cơ bản",
    content: `## Quy tắc FA chuẩn ADN

### Chỉ số quan trọng
1. **P/E**: So với trung bình ngành. P/E < TB ngành = Hấp dẫn
2. **ROE**: Tối thiểu 15%. ROE > 20% = Xuất sắc
3. **EPS Growth**: Tăng trưởng EPS > 15% YoY = Tốt
4. **D/E**: Nợ/Vốn < 1.5 cho hầu hết ngành. Ngân hàng & BĐS có D/E cao hơn.
5. **FCF**: Free Cash Flow dương = Doanh nghiệp khỏe mạnh

### Đánh giá theo ngành
- **Ngân hàng**: NIM, CIR, NPL ratio, CASA
- **Bất động sản**: Quỹ đất, doanh số bán hàng, D/E
- **Chứng khoán**: Market share, margin lending, proprietary trading
- **Thép/Hóa chất**: Biên lợi nhuận gộp, giá nguyên liệu
- **Công nghệ**: Revenue growth, ARR, churn rate

### Vùng giá hợp lý
- Dùng P/E trung bình 3 năm × EPS dự phóng
- Margin of Safety: Mua khi giá < 80% giá trị nội tại
- KHÔNG MUA khi P/E > 25 (trừ growth stock đặc biệt)`,
    priority: 7,
  },

  // ═══════════════════════════════════════════════
  //  THUẬT NGỮ
  // ═══════════════════════════════════════════════
  {
    category: "glossary",
    title: "Thuật ngữ ADN Capital",
    content: `## Thuật ngữ ADN Capital

### Tín hiệu
- **Siêu Cổ Phiếu** (Tím 💜): RS > 90, trend dài hạn, hold 3-12 tháng
- **Trung Hạn** (Xanh 💚): RS 70-90, swing trade 2-8 tuần
- **Đầu Cơ** (Vàng 💛): RS 50-70, trade ngắn 1-5 ngày, stoploss chặt

### RS Rating
- **Super Star** (>90): Top 10% thị trường, ưu tiên mua
- **Star** (80-90): Cổ phiếu mạnh, theo dõi mua khi pullback
- **Watch** (60-80): Trung bình, chỉ mua khi market regime tốt
- **Farmer** (<60): Yếu, KHÔNG MUA

### Market Regime
- **FULL MARGIN**: Thị trường tốt, all-in
- **THĂM DÒ**: Thận trọng, giảm tỷ trọng
- **QUAN SÁT**: Nguy hiểm, cash is king

### Cách gọi giá
- Đơn vị: nghìn VNĐ (49.100 = 49,100 đồng)
- Dấu chấm ngăn hàng nghìn: 49.100, 112.500
- Dấu phẩy cho thập phân: +1,25%, -0,50%`,
    priority: 5,
  },

  // ═══════════════════════════════════════════════
  //  QUY TẮC TƯ VẤN (TONE & STYLE)
  // ═══════════════════════════════════════════════
  {
    category: "ta_rules",
    title: "Quy tắc tư vấn nhất quán",
    content: `## Quy tắc tư vấn ADN Bot

### Nguyên tắc cốt lõi
1. LUÔN dựa trên dữ liệu, KHÔNG BAO GIỜ đoán
2. Mỗi nhận định phải kèm số liệu cụ thể (giá, %, volume)
3. Luôn nêu rõ MUA / BÁN / CHỜ — không nói nước đôi
4. Mọi khuyến nghị MUA phải kèm stoploss cụ thể
5. Nếu thiếu data → nói thẳng "chưa đủ dữ liệu", KHÔNG bịa

### Format chuẩn cho /ta
1. XU HƯỚNG (Uptrend/Downtrend/Sideway + căn cứ EMA)
2. CHỈ BÁO (RSI, MACD, BB - số cụ thể)
3. HỖ TRỢ / KHÁNG CỰ (giá cụ thể, đơn vị VNĐ)
4. CHIẾN LƯỢC (MUA/BÁN/CHỜ + entry/stoploss/target)
5. QUẢN LÝ RỦI RO (R:R ratio, tỷ trọng khuyến nghị)

### Tone & Style
- Tự xưng: "ADN AI" hoặc "Hệ thống"
- Gọi user: "Anh/Chị" hoặc "Nhà đầu tư"
- Phong cách: Chuyên nghiệp, dứt khoát, KHÔNG rào đón
- Nếu bearish → nói thẳng "KHÔNG NÊN MUA", không nói "có thể cân nhắc"
- Số liệu: Luôn dùng dấu chấm ngăn hàng nghìn (49.100, KHÔNG 49100)`,
    priority: 10,
  },
];

async function main() {
  console.log("🧠 Seeding ChatKnowledge...");

  // Xóa data cũ
  await prisma.chatKnowledge.deleteMany({});

  // Insert mới
  for (const item of KNOWLEDGE_DATA) {
    await prisma.chatKnowledge.create({
      data: {
        category: item.category,
        title: item.title,
        content: item.content,
        priority: item.priority,
        isActive: true,
      },
    });
    console.log(`  ✅ ${item.category}: ${item.title}`);
  }

  console.log(`\n🎉 Đã seed ${KNOWLEDGE_DATA.length} knowledge items.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
