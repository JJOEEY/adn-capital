# ADN Capital — Discord Bot (MVP v0.1)

Bản sao web lên Discord. Bot **gọi thẳng `/api` của web** (không xây lại data layer).

## Tính năng MVP
- **AIDEN chat** — `/aiden <câu hỏi>` hoặc **@mention** bot.
- **Auto tín hiệu** — đẩy tín hiệu mua/bán mới vào kênh `CHANNEL_SIGNALS` (poll 2 phút).
- **Bản tin** — tự đăng ảnh bản tin sáng (8:05) & kết phiên (19:10) vào `CHANNEL_BRIEF`.
- **Tra cứu** — `/stock <mã>` · `/rank [ngành]` · `/art <mã>`.
- **Gate tier** qua Discord roles (`/rank /art /aiden` = premium; `/stock` mở).

## Lấy token & ID (làm 1 lần, ~3 phút)
1. https://discord.com/developers/applications → **New Application** → đặt tên *ADN Capital*.
2. Tab **General Information** → copy **Application ID** → `DISCORD_CLIENT_ID`.
3. Tab **Bot** → **Reset Token** → copy → `DISCORD_TOKEN`. Bật **MESSAGE CONTENT INTENT** (cho @mention).
4. Tab **OAuth2 → URL Generator**: tick scope `bot` + `applications.commands`; quyền: *Send Messages, Embed Links, Attach Files, Read Message History*. Mở URL → mời bot vào server.
5. Trong Discord bật **Developer Mode** (Settings → Advanced). Chuột phải **server** → Copy ID → `DISCORD_GUILD_ID`. Chuột phải các **kênh** → `CHANNEL_SIGNALS`, `CHANNEL_BRIEF`. Chuột phải **role** (Server Settings → Roles) → `ROLE_PREMIUM`, `ROLE_VIP`.
6. `INTERNAL_API_KEY` = lấy từ env web (cho ảnh bản tin).

Điền hết vào `.env` (copy từ `.env.example`).

## Chạy local (test nhanh)
```bash
cd discord-bot
npm install
cp .env.example .env   # rồi điền
npm run register       # đăng ký slash command
npm start
```
> Local: đặt `ADN_API_BASE=https://adncapital.com.vn` (gọi API public).

## Deploy lên VPS (container, cùng network với web)
Thêm service vào `docker-compose.yml` của stack:
```yaml
  adn-discord-bot:
    build: ./discord-bot
    container_name: adn-discord-bot
    restart: unless-stopped
    env_file: ./discord-bot/.env     # ADN_API_BASE=http://adn-web:3000
    depends_on: [web]
```
```bash
docker compose up -d --build adn-discord-bot
docker compose run --rm adn-discord-bot node src/deploy-commands.js   # đăng ký lệnh 1 lần
```

## Roadmap (sau MVP)
Phase 2: cảnh báo mẫu hình 2 đáy, chart ảnh, autocomplete mã, `/radar`, `/signal`.
Phase 3: cổng premium tự động, threads cho AIDEN, nhiều lệnh hơn → tiến tới **bản sao đầy đủ**.
