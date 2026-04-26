# ADNexus Full Site Rebuild Audit V2

Ngày audit: 2026-04-27

## 1. Current Routes Map

Public routes chính:
- `/`: landing ADNexus, cần là scroll story full-bleed.
- `/products`: product hub NexSuite mới.
- `/san-pham`: route cũ, giữ tương thích và render cùng product hub.
- `/products/[slug]`: trang chi tiết module NexSuite.
- `/pricing`: bảng giá, đã có PayOS flow trong phần chọn gói.
- `/auth`: đăng nhập/đăng ký, không được hứa auto-trading.
- `/art`: NexART public.
- `/rs-rating`: NexRank, có khóa theo subscription.
- `/backtest`: NexLab.
- `/hdsd`: hướng dẫn sử dụng.
- `/terminal`: ADN Advisory powered by AIDEN.

Authenticated/app routes vẫn giữ route nội bộ:
- `/dashboard`: NexPulse.
- `/dashboard/signal-map`: NexRadar/NexPilot surface.
- `/stock/[ticker]`: NexLens.
- `/portfolio`: NexVault.
- `/dashboard/dnse-trading`: NexLink pilot/admin.
- `/notifications`: NexSentinel.
- `/journal`: NexDiary.
- `/admin/*`: quản trị hệ thống.

## 2. Current Naming Map

Brand:
- Company: ADN Capital.
- Platform: ADNexus.
- Meaning: Analyst. Discipline. Network.
- AI Persona: AIDEN.
- Product Suite: NexSuite.

Module display names:
- NexPulse: Market Intelligence.
- NexLens: Stock Intelligence / Workbench.
- NexRadar: Signal Map.
- NexRank: RS Rating.
- NexART: Action • Risk • Trend.
- NexGuard: Risk / Guardrails.
- NexVault: Portfolio.
- NexLink: Broker Connect / DNSE.
- NexPilot: AI Broker / order preview.
- NexLab: Backtest.
- NexSentinel: Alerts / Notifications.
- NexFlow: Workflow Runtime.
- ADN Advisory powered by AIDEN: Tư vấn đầu tư.

## 3. Safe Display Rename Scope

Được đổi:
- Heading, sidebar label, product card, metadata, public copy, CTA.
- Product hub / landing / module pages.

Không đổi trong sprint này:
- API path.
- DataHub topic key.
- Cron name.
- Prisma model.
- Env key.
- DNSE execution policy.

## 4. Public Pages That Needed Rebuild

Đã xử lý trong phase này:
- `/`: chuyển sang full-site story với section full viewport.
- `/products`: thêm product hub mới.
- `/san-pham`: render lại product hub mới để giữ route cũ.
- `/products/[slug]`: thêm trang chi tiết module cho toàn bộ NexSuite.

Cần kiểm tra tiếp ở phase polish:
- `/pricing`: PayOS flow đã có, cần browser-smoke khi có session thật.
- `/auth`: copy an toàn đã đúng hướng, cần visual polish nếu muốn đồng bộ 100%.
- `/backtest`, `/hdsd`, `/terminal`: chưa rebuild full visual trong phase này.

## 5. App Pages That Need Shell/Product Polish

Đã có trước phase này:
- PWA app-first.
- Bottom nav có Nhật ký.
- Chat app-native đã được sửa theo hướng full-screen.
- DNSE/NexLink ẩn với non-admin.

Còn cần kiểm tra bằng thiết bị thật:
- Safe-area, keyboard chat.
- Update log trong menu APK.
- Back gesture/hardware back.

## 6. Animation / Gauge Opportunities

Đã thêm:
- Full-bleed scroll story dùng `framer-motion`.
- Product scenes bằng component/CSS responsive.
- NexPulse market scene.
- NexPilot/NexRadar signal scene.
- NexART/NexGuard gauge scene không lộ công thức.
- NexRank RS table scene.
- NexLink/NexVault broker/portfolio preview scene.
- AIDEN Advisory chat scene.

Cần polish tiếp nếu có thời gian:
- Parallax background nhẹ.
- Scene transition theo scroll progress.
- SVG illustration người/bối cảnh ADN-owned.
- Reduced-motion visual regression trên mobile.

## 7. Top 15 Gaps Compared With Bridgewise-Class Experience

1. Một số public route phụ chưa được rebuild đồng bộ visual.
2. Chưa có asset minh họa người/bối cảnh ADN-owned dạng SVG hoặc WebP.
3. Chưa có case study thật, chỉ có workflow/pilot-safe proof.
4. Chưa có testimonial thật để public.
5. Chưa browser-smoke toàn bộ routes sau build trong phase này.
6. `/pricing` cần kiểm tra PayOS với session thật.
7. `/auth` có thể cần native visual đồng nhất hơn với landing V2.
8. Chưa có route alias đẹp như `/pulse`, `/rank`, `/advisory`.
9. Chưa có transition scroll progress indicator.
10. Chưa có dedicated FAQ dài cho từng module.
11. Chưa có legal/compliance public page riêng.
12. Chưa có changelog public cho NexSuite.
13. Chưa có analytics event tracking cho CTA.
14. Chưa có OG image riêng cho từng product page.
15. Chưa có automated visual regression test.

## 8. Safety Notes

- Public homepage không gọi DNSE runtime.
- DNSE real submit vẫn off theo source-of-truth.
- NexLink/NexPilot public chỉ hiển thị preview/pilot-safe copy.
- Không dùng KPI giả, không hứa lợi nhuận, không nói AI tự giao dịch.
