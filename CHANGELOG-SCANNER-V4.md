# CHANGELOG — Python Scanner v4 Rewrite

## [2026-04-09] — scanner.py Vectorized Engine v4

### ♻️ Kiến trúc mới: Scenario-based Signal Engine

File `fiinquant-bridge/scanner.py` được viết lại hoàn toàn.
Thư viện mới: `pandas_ta`, `scipy.signal.argrelextrema`.
**TUYỆT ĐỐI KHÔNG** gọi LLM API trong file này.

---

### 📐 [Bước 1] Indicators mới (tính vectorized)

| Nhóm | Chỉ báo |
|---|---|
| Trend | EMA_10/30/50/100, SMA_50/200 |
| Momentum | RSI_14, MACD_Line/Signal, StochRSI_k/d, MFI_14 |
| Volatility | BB_upper/lower/mid/bandwidth, Vol_MA20 |
| Custom | Base_Width (biên độ 20 phiên), RS_Rating |

---

### 🔍 [Bước 2] Pattern Detection Functions

- `detect_double_bottom(df)`: Dùng `argrelextrema` — tìm 2 đáy cục bộ, đáy sau ≥ đáy trước, giá vượt neckline.
- `detect_vcp(df)`: `rolling(10).std()` giảm dần 3 phiên liên tiếp.
- `detect_rsi_bullish_divergence(df)`: Giá đáy sau thấp hơn, RSI đáy sau cao hơn.

---

### 🚦 [Bước 3] Signal Engine — 4 Rổ Kịch Bản

**RỔ 1: NGẮN HẠN (DAU_CO)**
- Kịch bản 1: EMA10 > EMA30 + Vol > 1.2× + MACD cắt lên
- Kịch bản 2: Giá sát SMA200 + StochRSI_k < 20 cắt lên + Vol tăng
- Kịch bản 3: BB_bandwidth < 10% + giá phá BB_mid + Vol > 1.2×

**RỔ 2: TRUNG HẠN (TRUNG_HAN)**
- Kịch bản 1: EMA10 > EMA30 > SMA50 + Vol > 1.5× + Double Bottom
- Kịch bản 2: RSI Bullish Divergence + MACD cắt lên (dưới 0) + MFI > 40 dốc lên

**RỔ 3: SIÊU CỔ PHIẾU (SIEU_CO_PHIEU) — 5/7 điều kiện**
1. RS ≥ 85
2. VCP (vol std giảm)
3. Base_Width < 12%
4. Giá = cao nhất 20 phiên (Breakout)
5. EMA10 vừa cắt EMA30
6. EMA50 vừa cắt EMA100
7. Vol ≥ 2.0× MA20

**RỔ 4: TẦM NGẮM (TAM_NGAM)**
- Đạt ≥ 3/7 điều kiện Siêu cổ phiếu
- HOẶC BB_bandwidth < 10% nhưng Vol còn thấp

---

*Author: Antigravity AI — ADN Capital Quant Desk*
