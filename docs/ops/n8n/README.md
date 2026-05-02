# n8n vận hành cho ADN Capital

Mục tiêu: n8n chỉ là lớp điều phối vận hành/marketing. n8n không thay thế scheduler lõi, AIDEN, ADN Radar hoặc web runtime.

## Quy tắc bắt buộc

- n8n chỉ gọi API nội bộ `/api/internal/n8n/*` bằng `x-internal-key`.
- Không cấu hình node gọi thẳng FiinQuant, DNSE, bridge, provider hoặc `/api/news`.
- Tin tức SEO luôn ở trạng thái chờ duyệt trước khi public.
- Telegram chỉ gửi cho admin/nhóm vận hành để duyệt. Zalo vẫn copy thủ công.
- Không đưa secret vào workflow JSON. Dùng biến môi trường trong container n8n.

## Cài service trên VPS

1. Thêm secret vào `.env` trên VPS:

```bash
N8N_ENCRYPTION_KEY=<random-32-byte-secret>
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=<strong-password>
INTERNAL_API_KEY=<strong-internal-key>
N8N_ADN_WEB_BASE_URL=http://web:3000
```

2. Recreate web để nhận `INTERNAL_API_KEY`, sau đó bật n8n:

```bash
docker-compose build web
docker-compose up -d web
mkdir -p app_data/n8n
docker-compose --profile automation up -d n8n
```

3. n8n chỉ bind `127.0.0.1:5678`. Mở UI bằng SSH tunnel:

```bash
ssh -L 5678:127.0.0.1:5678 <user>@<vps>
```

Sau đó vào `http://127.0.0.1:5678`.

## Import workflow mẫu

Các workflow mẫu nằm trong `docs/ops/n8n/workflows`.

```bash
docker-compose --profile automation exec n8n n8n import:workflow --input=/workflows/adn-scheduled-notifications.json
docker-compose --profile automation exec n8n n8n import:workflow --input=/workflows/adn-news-and-radar.json
docker-compose --profile automation exec n8n n8n import:workflow --input=/workflows/adn-system-check.json
docker-compose --profile automation exec n8n n8n import:workflow --input=/workflows/adn-telegram-operator-relay.json
docker-compose --profile automation exec n8n n8n import:workflow --input=/workflows/adn-telegram-openclaw-agent.json
docker-compose --profile automation exec n8n n8n import:workflow --input=/workflows/adn-telegram-daily-checklist.json
docker-compose --profile automation exec n8n n8n import:workflow --input=/workflows/adn-telegram-daily-checklist-polling.json
```

Workflow được để `active=false` sau khi import. Kiểm tra biến môi trường và test từng HTTP node trước khi bật.

## Telegram AI Operator

Hai workflow Telegram được cung cấp:

- `ADN - Telegram AI Operator Relay`: luồng vận hành an toàn. Telegram Trigger nhận tin, gọi `/api/internal/n8n/telegram-agent` để router ý định, sau đó trả lời Telegram.
- `ADN - Telegram OpenClaw Style AI Agent`: luồng AI Agent đúng mô hình `Telegram Trigger -> AI Agent -> Simple Memory -> ADN Capital Tool -> Telegram response`.

Điều kiện trước khi bật workflow Telegram:

- n8n phải có public webhook HTTPS hợp lệ qua `N8N_WEBHOOK_URL`/`WEBHOOK_URL`.
- n8n phải có credential `Telegram API` cho bot vận hành.
- Workflow OpenClaw-style cần thêm credential `Google Gemini(PaLM) Api`.
- Chỉ cho phép chat admin/nhóm vận hành. Endpoint `/api/internal/n8n/telegram-agent` sẽ chặn chat ID không nằm trong `TELEGRAM_ADMIN_CHAT_ID`, `TELEGRAM_CHAT_ID` hoặc `N8N_TELEGRAM_ADMIN_CHAT_ID`.

Không bật Telegram Trigger khi n8n chỉ bind `127.0.0.1:5678`, vì Telegram không gọi được webhook nội bộ.

## API nội bộ đã cung cấp

- `POST /api/internal/n8n/notifications/scheduled`
- `POST /api/internal/n8n/news/crawl-draft`
- `POST /api/internal/n8n/news/publish-approved`
- `GET /api/internal/n8n/radar-digest`
- `GET /api/internal/n8n/system-check`
- `POST /api/internal/n8n/telegram-agent`
- `POST /api/internal/n8n/checklist`

Tất cả endpoint yêu cầu `x-internal-key: $ADN_INTERNAL_API_KEY`.

## Lịch đề xuất

- 10:00, 11:30, 14:00, 14:45: gửi cập nhật Web/PWA và Telegram admin.
- 08:30, 10:30, 13:30, 16:30: crawl tin public, tạo bài chờ duyệt.
- 10:05, 11:35, 14:05, 14:50: gửi Radar digest cho admin duyệt/copy Zalo.
- 21:00: kiểm tra hệ thống, chỉ báo Telegram khi có lỗi hoặc cảnh báo.

## Kiểm tra an toàn

- Workflow JSON không được chứa URL provider hoặc endpoint raw market data.
- Log không được chứa token, mật khẩu, OTP hoặc API key.
- Nếu API trả `401`, kiểm tra `INTERNAL_API_KEY` ở cả web và n8n rồi recreate container tương ứng.
## Telegram Daily Checklist Bot

Workflow `ADN - Telegram Daily Checklist Assistant` dùng cho group vận hành hằng ngày.

Luồng:

```text
Telegram Trigger
-> Normalize Telegram Update
-> ADN Checklist Brain
-> Telegram Response
```

Lệnh hỗ trợ:

- `/today`: xem checklist hôm nay.
- `/add kiểm tra bản tin sáng`: thêm việc.
- `nhắc tôi 14h kiểm tra ADN Radar`: thêm việc có giờ.
- `/done 2`: đánh dấu xong việc số 2.
- `/blocker crawler tin tức đang lỗi`: ghi việc đang kẹt.
- `/summary`: tổng kết ngày.

Biến môi trường liên quan:

```bash
N8N_TELEGRAM_CHECKLIST_CHAT_ID=<telegram-group-chat-id>
N8N_TELEGRAM_ALLOWED_CHAT_IDS=<chat-id-1,chat-id-2>
```

Nếu bot được thêm vào group, hãy tắt Privacy Mode bằng BotFather hoặc cấp quyền admin cho bot để workflow nhận được tin nhắn nhóm cần xử lý.

Workflow `ADN - Telegram Daily Checklist Polling` là phương án chạy ngay khi chưa public webhook n8n hoặc chưa gán Telegram credential cho Telegram Trigger. Workflow này dùng `getUpdates` mỗi phút, lưu `lastUpdateId` trong static data của n8n để tránh xử lý trùng. Khi bật Telegram Trigger thật, phải tắt workflow polling để tránh bot trả lời hai lần.
