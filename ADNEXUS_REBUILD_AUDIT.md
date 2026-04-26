# ADNexus Rebuild Audit

## Scope
- Sprint đầu chỉ đổi tầng hiển thị sang brand `ADNexus — Analyst. Discipline. Network.`
- Không đổi route, API, DataHub topic, DB schema, cron name hoặc DNSE execution policy.
- DNSE Trading đổi tên hiển thị thành `NexLink` nhưng vẫn chỉ dành cho admin/pilot.

## Findings
- Public landing còn lẫn câu chuyện ADN/AI Broker cũ và có thuật ngữ nội bộ khó hiểu với khách hàng mới.
- Navigation web và PWA còn lẫn tên cũ: `Dashboard`, `ADN AI Broker`, `DNSE Trading`, `Backtest`, `ART`.
- Auth, pricing và trang sản phẩm chưa tách rõ phần sản phẩm public với broker pilot.
- Một số khu vực public từng dùng thuật ngữ như `DataHub`, `upsert`, `phiếu lệnh`, `safe/allowlist`; sprint này chuyển sang ngôn ngữ khách hàng dễ hiểu.
- `NexLink` chưa đủ điều kiện public vì real submit đang tắt và luồng OTP/trading-token/compliance chưa mở đại trà.

## Rename Rules
- Route nội bộ giữ nguyên để tránh phá DataHub, Telegram, PWA và deep-link hiện có.
- Label hiển thị đọc từ `src/lib/brand/productNames.ts` khi có thể.
- Public pages chỉ hiển thị broker preview dạng minh họa/read-only, không gọi DNSE runtime.

## Sprint 1 Checklist
- Landing page public kể câu chuyện ADNexus bằng ngôn ngữ khách hàng dễ hiểu.
- Auth, pricing, sản phẩm, sidebar/header/PWA bottom nav dùng tên ADNexus/Nex*.
- Không mô tả DNSE/NexLink như tính năng đã public.
- Không thêm scheduler, không đổi DNSE policy, không đổi DataHub contract.
