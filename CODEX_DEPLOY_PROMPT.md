# CODEX DEPLOY PROMPT (Clean UTF-8)

## Main prompt

```md
Bạn đang làm việc trong local workspace của dự án ADN Capital.

Mục tiêu: chuẩn hóa và thực thi quy trình deploy production an toàn cho các thay đổi đã hoàn tất đến Phase 0-3, không làm gián đoạn trải nghiệm người dùng.

Bắt buộc:
1. Plan trước.
2. Audit deploy path hiện tại.
3. Chuẩn hóa script/runbook/checklist/smoke/rollback.
4. Chỉ đề xuất lệnh deploy production khi tất cả guardrail đều PASS.
5. Không chạy lệnh phá hủy hệ thống.

Ràng buộc cứng:
- Không rewrite stack.
- Không dùng `docker-compose down` hoặc `docker compose down` trong normal deploy.
- Mặc định chỉ rebuild/restart `web`.
- `PYTHON_BRIDGE_URL` là canonical bridge env (`FIINQUANT_URL` là fallback tương thích).
- `DATABASE_URL` -> `pgbouncer`, `DIRECT_DATABASE_URL` -> `db`.
- Scheduler canonical names:
  - `signal_scan_type1`
  - `market_stats_type2`
  - `morning_brief`
  - `close_brief_15h`
  - `eod_full_19h`
- Legacy aliases chỉ dùng để tương thích, không dùng làm source-of-truth.
- AI chỉ explain/summarize/personalize, không override deterministic core.
- Migration production dùng `prisma migrate deploy` (không dùng flow dev-only).
- Không để secret thật trong docs/scripts/.env.example/logs.

Tài liệu bắt buộc đọc:
- `docs/ops/SOURCE_OF_TRUTH.md`
- `DEPLOY_SAFE_RUNBOOK.md`
- `docker-compose.yml`
- `.env.example`
- `deploy/` scripts

Deliverables:
- `deploy/predeploy-check.sh`
- `deploy/safe-web-deploy.sh`
- `deploy/postdeploy-smoke.sh`
- `deploy/rollback-web.sh`
- `docs/ops/PRODUCTION_DEPLOY_CHECKLIST.md`

Validation bắt buộc:
- build
- lint (hoặc equivalent)
- shell script syntax validation (`bash -n`)
- precheck local/mock mode
- smoke local/mock mode (nếu phù hợp)

Final output:
1. Danh sách file sửa/tạo
2. Diff summary ngắn
3. Kết quả validation
4. PASS/FAIL từng nhóm A-F
5. Nếu tất cả PASS: in đúng 2 lệnh:
   - deploy production chuẩn duy nhất
   - rollback chuẩn duy nhất
6. Nếu còn FAIL: không in lệnh deploy production, chỉ in blocker còn lại
```

## Review prompt after implementation

```md
Hãy review lại toàn bộ thay đổi deploy như một senior release engineer.

Yêu cầu:
- Không sửa thêm trước khi audit xong.
- Đọc các file deploy/runbook/checklist/scripts đã thay đổi.
- Tìm mọi mismatch giữa:
  - `docs/ops/SOURCE_OF_TRUTH.md`
  - `DEPLOY_SAFE_RUNBOOK.md`
  - `.env.example`
  - `docker-compose.yml`
  - `deploy/*`
  - runtime config / cron contracts / health endpoints

Xác minh:
- Không có `docker-compose down` trong normal deploy path
- `PYTHON_BRIDGE_URL` canonical
- `DATABASE_URL` -> `pgbouncer`
- `DIRECT_DATABASE_URL` -> `db`
- migration production dùng `prisma migrate deploy`
- precheck/smoke/rollback dùng được
- logs/exit code rõ ràng

Kết quả trả về:
1. PASS/FAIL tổng thể
2. PASS/FAIL từng hạng mục
3. file cần sửa tiếp (nếu có)
4. lệnh deploy production cuối cùng
5. lệnh rollback cuối cùng
```
