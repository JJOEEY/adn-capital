# ADN Capital — Project Rules

Trả lời tiếng Việt, ngắn gọn, thực dụng. Đọc code trước khi sửa, sửa nhỏ gọn, không refactor lan man.
(Style chi tiết + quy trình video reels: xem `AGENTS.md`.)

---

# 🚨 DEPLOY — ĐỌC KỸ, LÀM ĐÚNG ĐỂ KHÔNG PHÁ PROD

Prod = VPS `root@14.225.204.117`:
- Web (Next.js, trong git): `/home/adncapital/app/adn-capital`
- Bridge (FiinQuant/scanner, **KHÔNG trong git**): `/home/adncapital/app/fiinquant-bridge`

## Deploy WEB — quy trình DUY NHẤT đúng

1. **Commit + push lên `origin/master` TRƯỚC.** Script deploy kéo `origin/master` về build — code chưa commit/push sẽ KHÔNG lên prod.
2. Chạy script hardened (web-only, tự lưu rollback + smoke). SSH hay rớt khi build lâu → chạy nền + poll log:
   ```bash
   ssh root@14.225.204.117 'cd /home/adncapital/app/adn-capital && nohup bash deploy/safe-web-deploy.sh > /tmp/deploy.log 2>&1 & echo PID=$!'
   # rồi tail /tmp/deploy.log tới khi thấy "[safe-deploy] done"
   ```
3. Script tự bảo vệ 3 lớp: **master-only · clean-tree · forward-only**, build `tsc --noEmit` + `next build`, chạy predeploy-check + postdeploy-smoke. **Bất kỳ bước nào fail → ABORT và web CŨ vẫn chạy** (không bao giờ để prod hỏng nửa chừng). Xong in `DEPLOYED commit: <sha>` + `[safe-deploy] done`.

## TUYỆT ĐỐI KHÔNG
- ❌ Deploy nhánh `codex/*` / feature branch lên prod → làm các fix khác về code cũ. **Merge vào `master` trước.**
- ❌ Dùng `deploy/full-deploy.sh` hay `update.sh` cho deploy thường (có thể down cả stack). **Chỉ dùng `safe-web-deploy.sh`.**
- ❌ Override guard (`ALLOW_NON_MASTER` / `ALLOW_DIRTY_TREE` / `ALLOW_NON_FORWARD`) trừ khi có chủ đích rõ ràng.
- ❌ Commit secret (`.env`, API key, SSH key, `vps-credentials.json`). Repo Private.

## Rollback khi lỗi
```bash
ssh root@14.225.204.117 'cd /home/adncapital/app/adn-capital && bash deploy/rollback-web.sh'
```
(ref cũ tự lưu ở `.deploy_prev_ref`, image cũ ở `.deploy_prev_image`.)

## Deploy BRIDGE (scanner.py / FiinQuant — không trong git)
Sửa local `D:\BOT\fiinquant-bridge\` → đẩy lên + restart:
```bash
scp <file> root@14.225.204.117:/home/adncapital/app/fiinquant-bridge/
ssh root@14.225.204.117 'docker cp /home/adncapital/app/fiinquant-bridge/<file> adn-fiinquant:/app/<file> && docker restart adn-fiinquant'
```
- `scanner.py` sạch → scp thoải mái. **KHÔNG scp `main.py`** (bản local mojibake; phải vá trực tiếp bản VPS, giữ UTF-8).
- Container không có `curl` → test endpoint bằng `docker exec adn-fiinquant python3` + urllib.

## Đổi schema Prisma
`docker-compose run --rm web npx prisma db push` (hoặc `RUN_MIGRATIONS=1 bash deploy/safe-web-deploy.sh`).

## Kiểm tra nhanh SAU deploy
- `docker ps` → adn-web Up, adn-fiinquant Up, adn-postgres healthy.
- `git log -1 --oneline` trong app dir = đúng commit vừa push.
- CronLog `signal_scan_type1` còn `success` mỗi 5 phút.
- Lỗi log **lành tính** sau deploy (bỏ qua): `Failed to find Server Action` (tab cũ, F5 là hết) · `FiinQuant ... TimeoutError` (đường giá phụ, scan đã chạy DNSE WS).

> DB/CronLog lưu UTC (Prisma naive timestamp). Query giờ VN: `... AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh'`.
