# CHANGELOG — Hệ Sinh Thái Nhật Ký & Quản Trị Tâm Lý AI (All-In-One)

## [2026-04-08] — Triển Khai Toàn Diện

### PHẦN 1: DATABASE & CƠ CHẾ BẢO MẬT RIÊNG TƯ

**Schema Prisma (đã có sẵn):**
- `User.initialJournalNAV` (Float?) — Số dư vốn ban đầu Nhật ký
- `User.enableAIReview` (Boolean, default: true) — Bật/tắt AI đánh giá tâm lý
- `TradingJournal.tradeDate` (DateTime?) — Ngày giao dịch (cho phép lùi ngày)
- `TradingJournal.psychologyTag` (String?) — Enum: Có kế hoạch | Tự tin | FOMO | Theo room | Cảm tính | Hoảng loạn
- `TradingJournal.tradeReason` (String?) — Lý do chi tiết vào/ra lệnh
- `Notification.userId` (String?) — NULL = global, non-NULL = private 1-1

### PHẦN 2: BACKEND CORE — LOGIC T+2.5 & ADMIN PORTAL

**Hàm T+2.5 (`src/lib/t25.ts`):**
- `checkT25Eligibility(buyDate, targetSellDate)` — Kiểm tra đủ 3 ngày giao dịch (bỏ T7, CN)
- `formatEarliestSellDate(date)` — Format ngày bán sớm nhất

**API Journal (`src/app/api/journal/route.ts`):**
- POST: Validate psychologyTag, tradeReason (>=5 ký tự), T+2.5 check khi BÁN
- GET: Hỗ trợ query params `from`, `to`, `ticker` để lọc

**API T+2.5 Check (`src/app/api/journal/t25-check/route.ts`):**
- GET: Client-side check T+2.5 trước khi submit form bán

**API PnL (`src/app/api/journal/pnl/route.ts`):**
- GET: Tính NAV = initialJournalNAV + realizedPnL (FIFO) + holdingsValue
- Trả về: currentHoldings, closedTrades, win/loss stats

**Admin API (`src/app/api/admin/journals/route.ts`):**
- GET: ADMIN xem toàn bộ journals + tradeReason + PnL summary theo user
- Hỗ trợ filter: userId, ticker, from, to

**User Settings API (`src/app/api/user/settings/route.ts`):**
- GET/PATCH: Quản lý enableAIReview, initialJournalNAV

**User Profile API (`src/app/api/user/profile/route.ts`):**
- PATCH: Thêm hỗ trợ initialJournalNAV và enableAIReview

**Notifications API (`src/app/api/notifications/route.ts`):**
- GET: Lọc private notifications — user chỉ thấy global + private của mình
- Guest chỉ thấy global notifications

**API /me (`src/app/api/me/route.ts`):**
- Trả thêm `initialJournalNAV` và `enableAIReview` trong response

### PHẦN 3: FRONTEND — UI/UX NHẬT KÝ & CÀI ĐẶT

**JournalForm (`src/components/journal/JournalForm.tsx`):**
- DatePicker chọn ngày đi lệnh (cho phép lùi ngày, max = hôm nay)
- PsychologyTag bắt buộc chọn (6 tags với icons)
- Textarea lý do giao dịch chi tiết (bắt buộc >= 5 ký tự, max 1000)
- T+2.5 Block UI: Khi chọn BÁN, auto-check T+2.5, disable submit + hiện cảnh báo đỏ

**JournalList (`src/components/journal/JournalList.tsx`):**
- Hiển thị tradeDate, psychologyTag badge, giá trị giao dịch
- Expandable tradeReason (click để xem chi tiết)
- Date Range Picker (Từ ngày - Đến ngày) bộ lọc

**PnL Summary (`src/components/journal/PnLSummary.tsx`):**
- NAV Overview: Vốn ban đầu, NAV hiện tại, Lãi/Lỗ đã chốt, Đang giữ
- Win/Loss Stats: Tổng lệnh, Đã chốt, Win, Loss, Win Rate bar
- Danh sách mã đang giữ (qty, avgPrice, marketValue)
- GD đã chốt gần đây (FIFO matching)
- Inline "Cài đặt vốn" trực tiếp trong tab PnL

**Journal Page (`src/app/journal/page.tsx`):**
- 4 tabs: Lịch sử | Ghi mới | PnL Tổng | AI Phân tích
- Date range filter tích hợp với API
- Quick Stats bar (Tổng lệnh, Mua, Bán)

**Profile/Settings (`src/app/profile/page.tsx`):**
- Toggle Switch "Nhận đánh giá tâm lý hàng tuần từ ADN AI"
- Liên kết enableAIReview qua /api/user/settings

**Notifications (`src/app/notifications/page.tsx`):**
- Thêm loại `ai_weekly_review` với icon Bot màu tím
- Hiển thị AI Weekly Review private notifications

**Hook useCurrentDbUser:**
- Thêm `initialJournalNAV` và `enableAIReview` vào interface

### PHẦN 4: HỆ THỐNG AI WEEKLY REVIEW (CRONJOB)

**Cron Route (`src/app/api/cron/ai-weekly-review/route.ts`):**
- Lịch trình: GET request với cron secret, chạy 17:00 chiều Thứ 6
- Điều kiện: Chỉ quét users có `enableAIReview === true`
- Dữ liệu gửi LLM: Danh sách lệnh tuần + psychologyTag + tradeReason
- AI Persona: "Chuyên gia Tâm lý Giao dịch riêng của ADN Capital"
- Phản hồi 3-5 câu: nhất quán kế hoạch? FOMO? mâu thuẫn lý do vs kết quả?
- Lưu Notification RIÊNG TƯ 1-1 (userId gán cụ thể, không global)
- Log kết quả vào CronLog + resultData JSON

### Cấu hình Cron (Vercel/External)
```
# Thêm vào vercel.json hoặc external cron scheduler:
# Thứ 6 17:00 VN (10:00 UTC)
GET /api/cron/ai-weekly-review
Header: x-cron-secret: <CRON_SECRET>
```

### Files đã tạo/cập nhật:
- `src/lib/t25.ts` (T+2.5 logic)
- `src/app/api/journal/route.ts` (Journal CRUD + T+2.5)
- `src/app/api/journal/t25-check/route.ts` (Client T+2.5 check)
- `src/app/api/journal/pnl/route.ts` (PnL calculation)
- `src/app/api/journal/analyze/route.ts` (AI analysis)
- `src/app/api/admin/journals/route.ts` (Admin journals)
- `src/app/api/user/settings/route.ts` (User settings)
- `src/app/api/user/profile/route.ts` (Profile + journal settings)
- `src/app/api/notifications/route.ts` (Private notification filter)
- `src/app/api/me/route.ts` (Added journal fields)
- `src/app/api/cron/ai-weekly-review/route.ts` (AI Weekly Review cron)
- `src/components/journal/JournalForm.tsx` (Full new form)
- `src/components/journal/JournalList.tsx` (Enhanced list)
- `src/components/journal/PnLSummary.tsx` (PnL tab)
- `src/app/journal/page.tsx` (4-tab layout)
- `src/app/profile/page.tsx` (AI Review toggle)
- `src/app/notifications/page.tsx` (AI Review notification type)
- `src/hooks/useCurrentDbUser.ts` (Added fields)
- `src/types/index.ts` (JournalEntry, PsychologyTag types)
- `prisma/schema.prisma` (All models updated)
