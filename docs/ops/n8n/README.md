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
```

Workflow được để `active=false` sau khi import. Kiểm tra biến môi trường và test từng HTTP node trước khi bật.

## API nội bộ đã cung cấp

- `POST /api/internal/n8n/notifications/scheduled`
- `POST /api/internal/n8n/news/crawl-draft`
- `POST /api/internal/n8n/news/publish-approved`
- `GET /api/internal/n8n/radar-digest`
- `GET /api/internal/n8n/system-check`

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
