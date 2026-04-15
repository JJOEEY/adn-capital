# ADN Capital Deploy Runbook

Tài liệu chuẩn để deploy project ADN Capital an toàn và đồng nhất.

Mục tiêu của runbook này:
- Không làm mất dữ liệu user.
- Không làm hỏng đăng nhập sau deploy.
- Không phải debug lại từ đầu mỗi lần release.
- Có checklist kiểm tra bắt buộc ngay sau deploy.

File này là nguồn tham chiếu chính cho các lần deploy sau.

## 1. Bối cảnh hiện tại của repo

Repo local hiện tại: `D:\BOT\adn-ai-bot`

Repo trên VPS:
- Host: `14.225.204.117`
- App dir: `/home/adncapital/app/adn-capital`

Stack hiện tại theo [docker-compose.yml](/d:/BOT/adn-ai-bot/docker-compose.yml):
- `db`: PostgreSQL
- `web`: Next.js app
- `fiinquant`: Python bridge
- `nginx`: reverse proxy

Điểm quan trọng:
- Hệ thống hiện chạy bằng `docker compose`, không phải mô hình `systemd` cho web như tài liệu cũ.
- Dữ liệu PostgreSQL hiện đang được giữ bằng bind mount:
  `/var/lib/9router/data/postgres:/var/lib/postgresql/data`
- Đây là persistence hợp lệ. Không bắt buộc phải đổi sang named volume nếu bind mount này đang ổn định.

## 2. Nguyên tắc bắt buộc

### 2.1 Không dùng `docker compose down`

Không chạy:

```bash
docker compose down
docker compose down -v
```

Lý do:
- `down` không phải lúc nào cũng xóa data, nhưng nó là thao tác không cần thiết và rủi ro cao trong bối cảnh hiện tại.
- Khi deploy chỉ cần cập nhật app web, tuyệt đối không đụng toàn bộ stack nếu chưa có lý do rất rõ.

Nguyên tắc:
- Chỉ rebuild/restart service cần thiết.
- Mặc định chỉ deploy `web`.

### 2.2 Không đổi `DATABASE_URL` sang `localhost`

Trong môi trường Docker Compose, `DATABASE_URL` phải dùng host `db`.

Đúng:

```env
DATABASE_URL=postgresql://adnuser:adn_pass_99@db:5432/adncapital?schema=public
```

Sai:

```env
DATABASE_URL=postgresql://adnuser:adn_pass_99@localhost:5432/adncapital
```

Lý do:
- `web` container không nhìn `localhost` như máy host.
- Nếu dùng `localhost`, app có thể không kết nối đúng DB hoặc kết nối nhầm nơi khác.

### 2.3 Không thay đổi ngẫu nhiên các biến auth

Ba biến cực kỳ nhạy cảm với đăng nhập:
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `AUTH_SECRET`

Nguyên tắc:
- Chúng phải ổn định giữa các lần deploy.
- Không thay secret nếu không có chủ đích rõ ràng.
- Nếu đổi domain hoặc callback, phải kiểm tra lại Google login ngay sau deploy.

### 2.4 Luôn verify sau deploy

Deploy chỉ được coi là xong khi đã qua các kiểm tra:
- `web` container đang chạy
- `DATABASE_URL` trong `web` đúng host `db`
- PostgreSQL vẫn còn user
- session auth còn hoạt động
- login credentials hoặc Google login hoạt động

## 3. Lệnh deploy chuẩn

### 3.1 Lệnh chuẩn cho phần lớn các lần deploy

```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && git pull origin master && docker compose up -d --build web"
```

Lệnh này làm gì:
- kéo code mới
- rebuild image `web`
- khởi động lại riêng service `web`

### 3.2 Khi cần build sạch cache

Chỉ dùng khi nghi build cache gây lỗi:

```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && git pull origin master && docker compose build --no-cache web && docker compose up -d web"
```

Không dùng `--no-cache` mặc định nếu chưa cần, vì sẽ chậm hơn.

## 4. Checklist trước deploy

Trước mỗi lần deploy, phải kiểm tra:

1. Có đang sửa `docker-compose.yml`, `.env`, auth config, Prisma schema, hoặc login flow không.
2. `docker-compose.yml` vẫn còn persistence cho `db`.
3. `DATABASE_URL` trên VPS vẫn dùng `@db:5432`.
4. Nếu có sửa auth/login:
   - kiểm tra `NEXTAUTH_URL`
   - kiểm tra `NEXTAUTH_SECRET`
   - kiểm tra `AUTH_SECRET`
   - kiểm tra Google OAuth callback
5. Nếu có sửa DB schema:
   - xác định rõ có cần chạy `prisma db push` hoặc migration hay không
   - không tự ý chạy lệnh thay schema trên production nếu chưa chốt

## 5. Checklist bắt buộc sau deploy

### 5.1 Kiểm tra container web

```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker compose ps web"
```

### 5.2 Kiểm tra `DATABASE_URL` trong container web

```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker compose exec web env | grep DATABASE_URL"
```

Kết quả đúng phải chứa:

```text
@db:5432
```

Không được là:

```text
@localhost:5432
```

### 5.3 Kiểm tra còn user trong DB

```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker compose exec db psql -U adnuser -d adncapital -c 'SELECT COUNT(*) FROM \"User\";'"
```

Mong đợi:
- số user lớn hơn `0`

Nếu ra `0`:
- dừng ngay
- không test login tiếp theo kiểu đoán mò
- xác nhận lại `DATABASE_URL`
- xác nhận app đang trỏ đúng DB production

### 5.4 Kiểm tra session auth

```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker compose exec web wget -qO- http://localhost:3000/api/auth/session"
```

Mong đợi:
- endpoint trả được response
- không crash

### 5.5 Kiểm tra log web nếu nghi login lỗi

```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker compose logs web --tail=150"
```

### 5.6 Kiểm tra login thực tế

Sau 4 bước trên, mới kiểm tra:
- đăng nhập email/password
- hoặc đăng nhập Google nếu hệ thống dùng Google

## 6. Quy trình xử lý khi deploy xong không đăng nhập được

Làm theo đúng thứ tự này, không nhảy cóc.

### Bước 1: Xác nhận app đang trỏ đúng DB

Chạy lại:

```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker compose exec web env | grep DATABASE_URL"
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker compose exec db psql -U adnuser -d adncapital -c 'SELECT COUNT(*) FROM \"User\";'"
```

Nếu `DATABASE_URL` sai hoặc user count = `0`, ưu tiên sửa chỗ này trước. Đây là nguyên nhân phổ biến nhất.

### Bước 2: Kiểm tra auth env

Kiểm tra các biến:

```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker compose exec web env | grep -E 'NEXTAUTH_URL|NEXTAUTH_SECRET|AUTH_SECRET|GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET'"
```

Xác nhận:
- `NEXTAUTH_URL` đúng domain production
- `AUTH_SECRET` và `NEXTAUTH_SECRET` có giá trị
- nếu dùng Google login thì client id/secret không rỗng

### Bước 3: Kiểm tra loại tài khoản đang dùng

Trong code hiện tại ở [src/lib/auth.ts](/d:/BOT/adn-ai-bot/src/lib/auth.ts):
- login credentials chỉ hoạt động nếu user có `password`
- user tạo bằng Google có thể tồn tại nhưng `password` là `null`

Vì vậy:
- nếu tài khoản là Google-only, đăng nhập email/password sẽ fail dù user vẫn còn trong DB

### Bước 4: Xem log auth của web

```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker compose logs web --tail=300"
```

Tìm các lỗi kiểu:
- Prisma connection error
- NextAuth secret/config error
- callback URL error
- Google provider error

### Bước 5: Chỉ khi đã xác định rõ mới sửa DB hoặc reset admin

Không reset user/admin ngay từ đầu khi chưa xác định nguyên nhân.

## 7. Quy trình xử lý khi mất light theme hoặc layout sai sau deploy

Hai nhóm lỗi này thường là lỗi code giao diện, không phải lỗi DB.

Các điểm cần kiểm tra trong repo hiện tại:
- [src/app/layout.tsx](/d:/BOT/adn-ai-bot/src/app/layout.tsx)
- [src/components/providers/ThemeProvider.tsx](/d:/BOT/adn-ai-bot/src/components/providers/ThemeProvider.tsx)
- [src/app/globals.css](/d:/BOT/adn-ai-bot/src/app/globals.css)
- [src/app/dashboard/page.tsx](/d:/BOT/adn-ai-bot/src/app/dashboard/page.tsx)

Các dấu hiệu cần lưu ý:
- app đang mặc định boot vào `dark` nếu `localStorage` chưa có `adn-theme`
- dashboard có `max-w-[1920px]`, dễ bị rộng quá mức
- `overflow-x: hidden` ở `html, body` đã bị bỏ, có thể làm layout tràn ngang

Khi gặp lỗi UI sau deploy:
- không kết luận là do server trước
- so sánh lại code đang deploy với 4 file trên

## 8. Khôi phục admin đúng schema hiện tại

Quan trọng:
- Trong schema hiện tại, `role` là gói thuê bao: `FREE | VIP | PREMIUM`
- Quyền quản trị là `systemRole`

Vì vậy:
- không set `role='ADMIN'`
- đúng là set `systemRole='ADMIN'`

### 8.1 Tạo hash password

```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker compose exec web node -e \"require('bcryptjs').hash('admin123', 12).then(v => console.log(v))\""
```

Copy hash vừa sinh ra.

### 8.2 Insert admin bằng SQL

Thay `HASH_O_DAY` bằng giá trị thật:

```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker compose exec db psql -U adnuser -d adncapital -c \"INSERT INTO \\\"User\\\" (id, email, password, name, role, \\\"systemRole\\\", \\\"createdAt\\\", \\\"updatedAt\\\") VALUES (gen_random_uuid()::text, 'admin@adncapital.com.vn', 'HASH_O_DAY', 'Admin ADN', 'VIP', 'ADMIN', NOW(), NOW()) ON CONFLICT (email) DO NOTHING;\""
```

### 8.3 Nếu admin đã tồn tại nhưng cần cấp lại quyền

```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker compose exec db psql -U adnuser -d adncapital -c \"UPDATE \\\"User\\\" SET role='VIP', \\\"systemRole\\\"='ADMIN', \\\"updatedAt\\\"=NOW() WHERE email='admin@adncapital.com.vn';\""
```

## 9. Những lệnh không được tự ý chạy

Không được tự ý chạy các lệnh sau trên production nếu chưa xác nhận rõ mục đích:

```bash
docker compose down
docker compose down -v
docker system prune -a
docker volume rm ...
git reset --hard
```

## 10. Quy trình chuẩn ngắn gọn

Đây là checklist ngắn để dùng hằng ngày.

### Deploy

```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && git pull origin master && docker compose up -d --build web"
```

### Verify

```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker compose ps web"
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker compose exec web env | grep DATABASE_URL"
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker compose exec db psql -U adnuser -d adncapital -c 'SELECT COUNT(*) FROM \"User\";'"
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker compose exec web wget -qO- http://localhost:3000/api/auth/session"
```

### Nếu login lỗi

```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker compose logs web --tail=300"
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker compose exec web env | grep -E 'NEXTAUTH_URL|NEXTAUTH_SECRET|AUTH_SECRET|GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|DATABASE_URL'"
```

## 11. Ghi chú cuối

Tài liệu cũ trong repo về deploy có phần đã lỗi thời vì phản ánh kiến trúc cũ.

Từ thời điểm này, khi hỗ trợ deploy ADN Capital, ưu tiên áp dụng runbook này:
- không `down`
- không đổi DB host thành `localhost`
- luôn verify user count và auth sau deploy
- chỉ sửa DB/admin sau khi đã xác định nguyên nhân

## 12. Khi Có Thay Đổi Prisma Schema (Bắt Buộc)

Nếu release có thay đổi trong `prisma/schema.prisma`, phải chạy migration deploy sau khi web lên:

```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && git pull origin master && docker compose build --no-cache web && docker compose up -d web && docker compose exec -T web npx prisma migrate deploy"
```

Sau đó verify thêm:

```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker compose exec web env | grep DATABASE_URL"
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker compose exec db psql -U adnuser -d adncapital -c 'SELECT COUNT(*) FROM \"User\";'"
```

Luôn giữ nguyên nguyên tắc:
- Không bao giờ `docker compose down`
- Chỉ rebuild/restart service `web`
- `DATABASE_URL` phải trỏ `@db:5432`
