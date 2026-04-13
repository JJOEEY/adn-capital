# AGENTS.md — ADN Capital

> Đọc file này TRƯỚC KHI làm bất cứ thứ gì.
> Đây là nguồn sự thật duy nhất. Không tự bịa hàm, không tự bịa endpoint.

---

## 1. STACK THỰC TẾ

| Thành phần | Công nghệ | Ghi chú |
|---|---|---|
| Frontend | Next.js 15 + TypeScript + Tailwind | 94% codebase |
| Database | PostgreSQL (Docker service `db`) | ORM: Prisma |
| Bridge API | Python FastAPI + uvicorn (Docker service `fiinquant`) | Port 8000 |
| Data chính | FiinQuantX — session pool 2 account (round-robin) | 400k requests |
| Data phụ | VNStock Premium (`data_feed.py`) + CAFEF scrape | Fallback kép |
| AI | `gemini-2.5-flash` (default) / `gemini-2.5-pro` (FA deep) / `gemini-2.5-flash-lite` (fallback) | `google.generativeai` |
| Notification | Telegram Bot (`telegram_bot.py`) | |
| Scheduler | APScheduler (BackgroundScheduler, timezone Asia/Ho_Chi_Minh) | |
| Deploy | Docker Compose trên VPS | `./deploy.sh` |

---

## 2. DEPLOY — QUY TRÌNH DUY NHẤT

```bash
git pull origin master
docker compose down
docker compose up -d --build
docker image prune -f
```
Hoặc: `./deploy.sh`

### Kiểm tra sau deploy
```bash
docker compose logs web --tail=50
docker compose logs fiinquant --tail=50
docker compose ps
```

### ❌ KHÔNG BAO GIỜ
- Không `scp` file lẻ lên VPS
- Không restart container thủ công bỏ qua `docker compose`

---

## 3. ENVIRONMENT VARIABLES

| Biến | Ghi chú |
|---|---|
| `DATABASE_URL` | Host phải là `db` (Docker service) |
| `FIINQUANT_URL` | Host phải là `fiinquant` (Docker service) |
| `FIINQUANT_USER` / `FIINQUANT_PASS` | Account 1 (primary) |
| `FIINQUANT_USER_2` / `FIINQUANT_PASS_2` | Account 2 (round-robin) |
| `GEMINI_API_KEY` | AI — `genai.configure(api_key=...)` |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Notifications |
| `NEXTAUTH_SECRET` / `AUTH_SECRET` | Authentication |
| `CRON_SECRET` | Signal lifecycle worker |

---

## 4. BRIDGE API — CÁC ENDPOINT ĐÃ CÓ (main.py)

### Data endpoints
| Endpoint | Mô tả |
|---|---|
| `GET /api/v1/historical/{ticker}?days=730&timeframe=1d` | OHLCV lịch sử |
| `GET /api/v1/realtime/{ticker}?timeframe=5m` | Intraday + mua/bán chủ động |
| `GET /api/v1/fundamental/{ticker}` | P/E, P/B, ratios, foreign room |
| `GET /api/v1/ta-summary/{ticker}` | TA tổng hợp (tất cả chỉ báo tính sẵn) |
| `GET /api/v1/rs-rating` | Bảng xếp hạng RS Rating CANSLIM (705 mã) |
| `GET /api/v1/seasonality/{ticker}` | Seasonality theo tháng |
| `GET /api/v1/market-overview` | ADN Composite Score 0-14 (Monthly+Weekly+Valuation) |
| `GET /api/v1/market-breadth` | Độ rộng thị trường (tăng/giảm/trần/sàn) |
| `GET /api/v1/market-snapshot` | Snapshot realtime VNINDEX+HNX+breadth |
| `GET /api/v1/investor-trading` | Giao dịch theo NĐT (ngoại/tự doanh/cá nhân) |
| `GET /api/v1/index-valuation` | P/E, P/B VN-INDEX |
| `GET /api/v1/rpi` | Reverse Point Index VN30 (0-5) |
| `GET /api/v1/leader-radar` | Leader Radar + Circuit Breaker |
| `POST /api/v1/batch-price` | Giá realtime nhiều mã |
| `POST /api/v1/batch-exit-scan` | Exit scan nhiều mã cùng lúc |
| `POST /api/v1/batch-seasonality` | Seasonality nhiều mã cùng lúc |
| `GET /api/v1/news/morning` | Morning Intelligence (Gemini + CAFEF) |
| `GET /api/v1/news/eod` | EOD Flash Note (Gemini + CAFEF) |
| `POST /api/v1/scan-now` | Trigger scanner thủ công |
| `GET /health` | Health check |

### FiinQuantX session
```python
# Luôn dùng _get_session() — không tạo session mới
session = _get_session()  # round-robin pool 2 account

# Lấy OHLCV (dùng qua data_services wrapper, không gọi trực tiếp FiinQuantX)
df = data_services.get_ohlcv_safe(session, ticker, from_date, to_date, fields=[...], adjusted=True, by="1d")

# Lấy realtime
df = session.Fetch_Trading_Data(realtime=False, tickers=[...], fields=[...], adjusted=True, by="1d", from_date="...").get_data()

# Lấy foreign flow
df = data_services.get_foreign_safe(session, tickers, from_date, to_date)

# Market breadth
raw = data_services.get_breadth_safe(session, "VNINDEX")
```

### Gemini AI
```python
import google.generativeai as genai
_ensure_gemini()  # đã có helper này trong main.py

# Model chuẩn — dùng cho TA, Tâm lý, News
model = genai.GenerativeModel("gemini-2.5-flash")

# Model Pro — chỉ dùng cho FA (suy luận sâu, tốn token hơn)
model = genai.GenerativeModel("gemini-2.5-pro")

# Fallback nếu Flash quá tải — KHÔNG dùng 2.0 (đã deprecated)
try:
    model = genai.GenerativeModel("gemini-2.5-flash")
    resp = model.generate_content(prompt)
except Exception:
    model = genai.GenerativeModel("gemini-2.5-flash-lite")
    resp = model.generate_content(prompt)
```

---

## 5. BỐN LÕI TƯ VẤN ĐẦU TƯ — YÊU CẦU BUILD

### ⚠️ Quy tắc chung cho cả 4 lõi
- Tất cả nhận định AI → INSERT vào DB ngay sau khi generate
- Lần sau cùng ticker → kiểm tra DB trước, nếu còn hợp lệ → trả DB, KHÔNG gọi Gemini
- Fallback: `gemini-2.5-flash` → `gemini-2.5-flash-lite` nếu lỗi/quá tải
- Bọc toàn bộ luồng gọi AI trong `try/except`
- Sau khi bắn Telegram → INSERT record vào bảng `notifications`

---

### LÕI 1: PHÂN TÍCH KỸ THUẬT `/ta`

**Endpoint cần tạo:** `GET /api/v1/ai/ta/{ticker}`

**Nguồn data:** Gọi `GET /api/v1/ta-summary/{ticker}` — đã tính sẵn tất cả chỉ báo (RSI, MACD, EMA, Bollinger, Supertrend, Stochastic, patterns, support/resistance).

**Chart:** Dùng dữ liệu `recentCandles` (30 phiên) từ `ta-summary` response để vẽ bằng `mplfinance`. Convert sang base64. Trả về trong `media_url`. TUYỆT ĐỐI không để `media_url: null`.

```python
# Vẽ chart
import mplfinance as mpf
import base64, io

df_chart = pd.DataFrame(recent_candles)
buf = io.BytesIO()
mpf.plot(df_chart, type='candle', style='charles', volume=True, savefig=buf)
buf.seek(0)
media_url = "data:image/png;base64," + base64.b64encode(buf.read()).decode()
```

**DB Cache:** Bảng `ai_ta_cache` — columns: `ticker`, `analysis`, `media_url`, `support`, `resistance`, `signal`, `created_at`. Cache hợp lệ nếu: giá hiện tại chưa vỡ mốc kháng cự/hỗ trợ đã lưu (dùng `close` từ `ta-summary` để so sánh).

**Model AI:** `gemini-2.5-flash`

**Persona & prompt:**
```
Bạn là "Khổng Minh VNINDEX" — chiến lược gia thực chiến thị trường VN.
Gọi user là "đại ca". Văn phong ngắn gọn, thực chiến, có số liệu cụ thể.

Dữ liệu TA cho {ticker}:
- Giá hiện tại: {current_price} | Xu hướng: {trend} ({trend_strength})
- RSI(14): {rsi14} | MACD Hist: {macdHistogram} | Tín hiệu: {signal}
- EMA10/20/50/200: {ema10}/{ema20}/{ema50}/{ema200}
- Bollinger: {bollingerLower} - {bollingerUpper}
- Supertrend: {supertrend} | Stochastic K/D: {stochK}/{stochD}
- Hỗ trợ: {support} | Kháng cự: {resistance}
- Volume ratio vs MA20: {volumeRatio}x
- Patterns: {patterns}
- Điểm Bull/Bear: {bullishScore}/{bearishScore}

Viết nhận định TA ngắn gọn (5-7 câu):
1. Xu hướng hiện tại + xác nhận EMA
2. Động lượng (RSI + MACD)
3. Mốc hỗ trợ/kháng cự CỤ THỂ
4. Volume xác nhận xu hướng không?
5. Khuyến nghị: Mua/Giữ/Tránh + điều kiện cụ thể
6. Cảnh báo FOMO nếu RSI > 65 hoặc giá quá xa EMA50
```

**Personalization (BẮT BUỘC, KHÔNG đề cập với user):**

Trước khi gọi Gemini, query DB để lấy 2 thông tin:
1. Hệ thống ADN AI Broker có đang có tín hiệu ACTIVE cho ticker này không? (`SELECT * FROM signals WHERE ticker = ? AND status = 'ACTIVE'`)
2. User hiện tại có đang cầm ticker này trong danh mục không? (`SELECT * FROM portfolio WHERE userId = ? AND ticker = ? AND quantity > 0`)

Dựa vào kết quả, điều chỉnh prompt như sau — TUYỆT ĐỐI không nói với user rằng đã tra cứu thông tin cá nhân:

```python
# Nếu user đang cầm mã + hệ thống có tín hiệu ACTIVE
if holding and active_signal:
    context = f"""
    Người dùng hiện đang nắm giữ {holding['quantity']} cổ phiếu {ticker} 
    với giá vốn {holding['avgPrice']}. Tín hiệu hệ thống đang ở trạng thái {active_signal['type']}.
    Hãy tư vấn cụ thể: nên giữ/thêm/cắt lỗ/chốt lời ở mức nào dựa trên giá vốn đó.
    KHÔNG được đề cập đến việc tra cứu thông tin này.
    """
# Nếu user đang cầm mã nhưng không có tín hiệu ACTIVE
elif holding and not active_signal:
    context = f"""
    Người dùng hiện đang nắm giữ {holding['quantity']} cổ phiếu {ticker}
    với giá vốn {holding['avgPrice']}. Hệ thống chưa có tín hiệu đặc biệt.
    Tư vấn dựa trên TA: mã đang lãi/lỗ bao nhiêu % so với giá vốn, có nên giữ không.
    KHÔNG được đề cập đến việc tra cứu thông tin này.
    """
# Nếu hệ thống có tín hiệu ACTIVE nhưng user chưa cầm
elif not holding and active_signal:
    context = f"""
    Hệ thống đang có tín hiệu {active_signal['type']} cho {ticker}.
    Tư vấn: đây có phải thời điểm tốt để xem xét vào lệnh không, 
    điểm mua hợp lý ở đâu, rủi ro là gì.
    """
# Không có gì đặc biệt → tư vấn bình thường
else:
    context = ""
```

**Response JSON:**
```json
{
  "ticker": "HPG",
  "signal": "Tích cực (Bullish)",
  "analysis": "...",
  "support": 28500,
  "resistance": 31200,
  "media_url": "data:image/png;base64,...",
  "cached": false,
  "cached_at": null
}
```

---

### LÕI 2: PHÂN TÍCH CƠ BẢN `/fa`

**Endpoint cần tạo:** `GET /api/v1/ai/fa/{ticker}`

**Nguồn data:** Gọi `GET /api/v1/fundamental/{ticker}` — trả về `valuation` (P/E, P/B), `ratios` (chỉ số tài chính), `basicInfo` (ngành, vốn hoá), `foreignTrading` (room ngoại).

**Lùi quý:** Nếu `ratios` trống hoặc thiếu quý hiện tại → ghi chú vào prompt: `"Dữ liệu quý gần nhất có sẵn: Q{n} {year}"`.

**DB Cache:** Bảng `ai_fa_cache` — columns: `ticker`, `analysis`, `quarter`, `created_at`. Cache hợp lệ khi `quarter` chưa có cập nhật mới (so sánh với quarter trong response).

**Model AI:** `gemini-2.5-pro` (suy luận sâu)

**Prompt:**
```
Bạn là chuyên gia phân tích cơ bản chứng khoán Việt Nam.

Dữ liệu FA cho {ticker}:
Định giá: {valuation}
Chỉ số tài chính: {ratios}
Thông tin cơ bản: {basicInfo}
Giao dịch ngoại: {foreignTrading}

Phân tích FA bao gồm:
1. Định giá hiện tại so với lịch sử và ngành (P/E, P/B)
2. Chất lượng lợi nhuận (ROE, ROA, biên lợi nhuận)
3. Sức khỏe tài chính (nợ/vốn chủ, dòng tiền)
4. Tăng trưởng doanh thu/lợi nhuận so với quý trước
5. Room ngoại còn lại — tín hiệu tổ chức nước ngoài
6. Kết luận: Định giá Rẻ/Hợp lý/Đắt + luận điểm đầu tư
```

---

### LÕI 3: PHÂN TÍCH TÂM LÝ & HÀNH VI `/tamly`

**Endpoint cần tạo:** `GET /api/v1/ai/tamly/{ticker}`

**Nguồn data:**
- Dữ liệu ATC (realtime cuối phiên): `data_services.get_ohlcv_safe(session, ticker, today, today, by="1m")`
- Nếu hôm nay chưa có → lùi T-1 tự động. TUYỆT ĐỐI không báo lỗi "chưa có data"
- Foreign flow: `data_services.get_foreign_safe(session, [ticker], from_date, today)`
- Intraday volume profile: tổng hợp `buyVolume` vs `sellVolume` từ endpoint `/api/v1/realtime/{ticker}`

**Fallback cơ chế:**
```python
try:
    model = genai.GenerativeModel("gemini-2.5-flash")
    resp = model.generate_content(prompt)
except Exception:
    model = genai.GenerativeModel("gemini-2.5-flash-lite")
    resp = model.generate_content(prompt)
```

**DB Cache:** Bảng `ai_tamly_cache` — columns: `ticker`, `date`, `analysis`, `created_at`. Cache theo ngày (1 ngày/1 nhận định).

**Model AI:** `gemini-2.5-flash`

**Prompt:**
```
Bạn là chuyên gia phân tích tâm lý hành vi thị trường chứng khoán VN.

Dữ liệu phiên {date} cho {ticker}:
- ATC: Giá đóng cửa {close}, KL khớp lệnh {volume}, Giá trị {value_bn} tỷ
- Mua chủ động: {buyVolume} | Bán chủ động: {sellVolume} | Net: {netVolume}
- Khối ngoại: Mua {foreignBuy_bn} tỷ | Bán {foreignSell_bn} tỷ | Net {foreignNet_bn} tỷ
- So sánh KL vs MA20: {volumeRatio}x trung bình

Phân tích tâm lý thị trường:
1. Lực cầu/cung: ai đang kiểm soát phiên?
2. Hành vi khối ngoại: tích lũy hay phân phối?
3. Tâm lý đám đông: FOMO / hoảng loạn / thờ ơ?
4. Tín hiệu smart money (mua chủ động cao, KL đột biến)?
5. Cảnh báo rủi ro hành vi ngắn hạn
```

---

### LÕI 4: PHÂN TÍCH TIN TỨC `/news`

**Endpoint đã có:** `GET /api/v1/news/morning` và `GET /api/v1/news/eod`

**Nguồn data:** CAFEF RSS + CAFEF PriceHistory API (đã implement trong `_cafef_index_data()`). TUYỆT ĐỐI không dùng FiinQuantX cho news (tiết kiệm limit).

**Cào tin tức:** Dùng CAFEF RSS feed (ổn định, không bị block):
```python
import feedparser
feeds = [
    "https://cafef.vn/thi-truong-chung-khoan.rss",
    "https://cafef.vn/doanh-nghiep.rss",
]
# Lấy 30 tin mới nhất, tóm tắt bằng Gemini
```

**Model AI:** `gemini-2.5-flash`

**Đã có sẵn** — chỉ cần bổ sung:
1. Sau khi `_tg_morning_news()` / `_tg_eod_news()` bắn Telegram → INSERT vào DB
2. Thêm endpoint `GET /api/v1/notifications`

---

## 6. DATABASE — BỔ SUNG CẦN THIẾT

### Bảng mới cần tạo (Prisma schema)

```prisma
model AiTaCache {
  id         Int      @id @default(autoincrement())
  ticker     String
  analysis   String   @db.Text
  mediaUrl   String?  @db.Text
  support    Float?
  resistance Float?
  signal     String?
  createdAt  DateTime @default(now())

  @@index([ticker])
}

model AiFaCache {
  id        Int      @id @default(autoincrement())
  ticker    String
  analysis  String   @db.Text
  quarter   String?
  createdAt DateTime @default(now())

  @@index([ticker])
}

model AiTamlyCache {
  id        Int      @id @default(autoincrement())
  ticker    String
  date      String
  analysis  String   @db.Text
  createdAt DateTime @default(now())

  @@index([ticker, date])
}

model Notification {
  id        Int      @id @default(autoincrement())
  type      String   // morning | eod | signal | foreign | tei | macro_gauge
  content   Json
  sentAt    DateTime @default(now())
  createdAt DateTime @default(now())

  @@index([type])
  @@index([sentAt])
}
```

### API endpoint cần tạo

```
GET /api/v1/notifications?type=morning&limit=20&page=1
```

Response:
```json
{
  "data": [
    {"id": 1, "type": "morning", "content": {...}, "sentAt": "2026-04-11T08:00:00"}
  ],
  "total": 100,
  "page": 1
}
```

---

## 7. TELEGRAM — BỔ SUNG INSERT DB

Sau MỖI hàm bắn Telegram, thêm đoạn INSERT:

```python
# Ví dụ trong _tg_morning_news()
tg.send_morning_news(news)
# → Thêm ngay sau:
try:
    import requests as _req
    _req.post(
        f"http://localhost:3000/api/internal/notifications",
        json={"type": "morning", "content": news},
        headers={"x-cron-secret": os.getenv("CRON_SECRET", "")},
        timeout=5,
    )
except Exception as e:
    logger.warning(f"[DB] Lỗi lưu notification: {e}")
```

---

## 8. WORKFLOWS

### Fix bug
1. `docker compose logs fiinquant --tail=100` — đọc log trước
2. Fix đúng chỗ
3. `./deploy.sh`
4. Check log confirm hết lỗi

### Thêm tính năng mới
1. Xác định thay đổi ở đâu (Bridge Python / Next.js / DB schema?)
2. Nếu thêm DB schema → `npx prisma migrate dev --name ten` → sau deploy: `docker compose exec web npx prisma migrate deploy`
3. Build từng bước nhỏ, verify từng bước
4. Deploy bằng `./deploy.sh`

### Tiết kiệm FiinQuant request
- Luôn dùng cache trong memory trước khi gọi FiinQuantX
- News endpoint (morning/eod) → CAFEF, KHÔNG dùng FiinQuantX
- Batch endpoints thay vì N request riêng lẻ
- Cache TTL: TA 5 phút, FA 24h, Seasonality 24h, RS Rating 4h

---

## 9. LỖI HAY GẶP

| Lỗi | Nguyên nhân | Fix |
|---|---|---|
| Cannot connect to db | DATABASE_URL host sai | Đổi thành `db` |
| Cannot connect to fiinquant | FIINQUANT_URL host sai | Đổi thành `fiinquant` |
| FiinQuant login fail | Sai credentials | Check `FIINQUANT_USER/PASS` trong `.env` |
| Gemini quota error | Hết quota flash | Fallback sang `gemini-2.5-flash-lite` |
| `KeyError: 'value'` | Cột OHLCV thiếu | Đã fix trong `_compute_market_score` — check val_col |
| Container restart loop | Lỗi runtime | `docker compose logs fiinquant --tail=100` |
| Prisma error sau deploy | Chưa migrate | `docker compose exec web npx prisma migrate deploy` |

---

## 10. CHECKLIST TRƯỚC KHI BÁO "XONG"

- [ ] Code chạy đúng chưa?
- [ ] Có thay đổi Prisma schema? Đã migrate chưa?
- [ ] Có biến env mới? Đã thêm vào `.env.example` chưa?
- [ ] Không hardcode secret trong code?
- [ ] `docker compose ps` — tất cả `Up`?
- [ ] Log không có lỗi mới?
- [ ] Cache TTL đã set hợp lý chưa?
- [ ] Có gọi FiinQuantX không cần thiết không? (news → dùng CAFEF)
