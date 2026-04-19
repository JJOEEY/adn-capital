# ADN Capital — Codex Prompts cho UX/UI Redesign

## Prompt 1 — Audit hiện trạng codebase trước khi sửa
```md
Bạn đang làm việc trong codebase ADN Capital.

Mục tiêu:
- Audit toàn bộ phần public marketing/auth pages.
- Xác định file route, layout, component, styling tokens, shared UI components.
- Không sửa code ngay.

Yêu cầu:
1. Tìm toàn bộ route public liên quan tới:
   - homepage
   - pricing
   - products
   - auth
   - backtest
   - guide/docs
   - art
   - journal
2. Liệt kê:
   - file path
   - component tree chính
   - layout đang dùng
   - source dữ liệu nếu có
   - component nào đang placeholder hoặc chưa hoàn thiện
3. Xác định design system hiện có:
   - font
   - color tokens
   - spacing
   - button variants
   - card variants
4. Đề xuất plan refactor nhỏ nhất để redesign mà không phá app.
5. Tạo report dạng markdown: `UX_UI_CODEBASE_AUDIT.md`

Rule:
- Không bịa file.
- Nếu local code khác public repo, ưu tiên local workspace.
- Nếu route chưa hoàn thiện, ghi rõ trạng thái.
```

## Prompt 2 — Redesign homepage
```md
Hãy redesign homepage ADN Capital theo spec UX/UI sau:

Mục tiêu:
- Tăng clarity, trust, conversion.
- Làm rõ ADN là nền tảng AI + quant cho chứng khoán Việt Nam.
- Giảm cảm giác unfinished.

Yêu cầu UI:
1. Refactor homepage theo cấu trúc:
   - Hero
   - Trust bar
   - Product preview
   - How it works
   - Track record / methodology
   - Workflow blocks
   - Testimonials
   - Pricing teaser
   - FAQ
   - Final CTA
2. Hero phải là 2 cột:
   - bên trái: headline, subheadline, CTA
   - bên phải: mockup thật hoặc placeholder frame có cấu trúc rõ ràng
3. Không render KPI nếu dữ liệu null/0 giả.
4. Không dùng animation chữ dài gây nhiễu.
5. Dùng typography hierarchy rõ ràng.
6. CTA chính là `Dùng thử dashboard`.
7. CTA phụ là `Xem demo tín hiệu`.

Yêu cầu code:
- Tạo component tái sử dụng cho:
  - SectionHeader
  - TrustChips
  - ProductPreviewCard
  - KPIStatCard
  - TestimonialCard
  - CTASection
- Giữ code sạch, tách component hợp lý.
- Không làm hỏng SEO và responsive.

Output:
- Thực hiện thay đổi code.
- Tạo file `HOMEPAGE_REDESIGN_NOTES.md` mô tả thay đổi.
```

## Prompt 3 — Sửa pricing
```md
Hãy refactor page pricing ADN Capital để dễ scan, dễ hiểu và tăng conversion.

Mục tiêu:
- Làm rõ khác biệt giữa các gói.
- Tách ưu đãi DNSE khỏi logic định giá chính.
- Giảm cognitive load.

Yêu cầu:
1. Chuyển pricing thành 3 tier rõ ràng nếu code hiện tại cho phép.
2. Nếu vẫn giữ 4 gói, phải làm feature comparison rõ ràng.
3. Tách block `Ưu đãi DNSE` thành section riêng phía trên bảng giá.
4. CTA phải có ngữ cảnh, không chỉ là `Đăng Ký`.
5. Thêm block giải thích quy trình thanh toán/kích hoạt.
6. Nếu chưa có checkout tự động, UI vẫn phải minh bạch thời gian kích hoạt và kênh hỗ trợ.
7. Bổ sung badge như `Phổ biến nhất`, `Tiết kiệm nhất` theo style thống nhất.

Yêu cầu kỹ thuật:
- Reuse shared card/button components.
- Responsive tốt trên mobile.
- Không hiển thị nội dung trùng lặp quá dài trong từng card nếu có thể tách ra thành compare table.

Output:
- Commit thay đổi ở pricing.
- Tạo file `PRICING_REDESIGN_NOTES.md`.
```

## Prompt 4 — Redesign auth page
```md
Hãy redesign trang auth của ADN Capital để tăng trust và giảm ma sát đăng nhập.

Mục tiêu:
- Giải thích user nhận gì sau khi login.
- Tạo cảm giác an toàn và chuyên nghiệp.
- Thêm đường dẫn xem demo trước khi đăng nhập.

Yêu cầu:
1. Thiết kế layout split-screen hoặc centered card cao cấp.
2. Hiển thị rõ:
   - heading
   - 3 lợi ích chính sau đăng nhập
   - nút login chính
   - note bảo mật
   - support contact
   - CTA phụ: xem demo
3. Nếu hệ thống có thể hỗ trợ, thêm preview khung dashboard/terminal ở bên cạnh.
4. Copy phải rõ ràng, bớt hype.
5. Responsive tốt.

Output:
- Sửa auth page.
- Tạo `AUTH_REDESIGN_NOTES.md`.
```

## Prompt 5 — Xử lý route placeholder
```md
Hãy audit và xử lý toàn bộ public routes đang unfinished hoặc placeholder.

Mục tiêu:
- Không để public page nào tạo cảm giác sản phẩm chưa hoàn thiện.

Yêu cầu:
1. Kiểm tra các route như:
   - art
   - journal
   - guide/docs
   - các trang sản phẩm con khác nếu có
2. Phân loại mỗi route vào 1 trong 3 nhóm:
   - publish được
   - cần `coming soon`
   - cần ẩn khỏi nav
3. Implement cơ chế route-level guard hoặc template `coming soon` chuẩn.
4. Loại bỏ text kiểu `Updating...`, `Đang tải...` trên production nếu không thực sự là loading state ngắn hạn.
5. Nav chỉ hiển thị các route đã sẵn sàng.

Output:
- Thực hiện thay đổi code.
- Tạo file `PLACEHOLDER_ROUTE_CLEANUP.md`.
```

## Prompt 6 — Redesign backtest page
```md
Hãy nâng cấp backtest page của ADN Capital thành một product page thuyết phục hơn.

Mục tiêu:
- Biến backtest thành trust engine.
- Trình bày rõ logic, số liệu và case studies.

Yêu cầu:
1. Hero ngắn gọn, rõ value.
2. Hiển thị 4 KPI nếu có data thật:
   - cumulative return hoặc CAGR
   - win rate
   - max drawdown
   - total trades
3. Nếu data chưa sẵn, phải có empty state đẹp, không hiển thị `—` trần.
4. Thêm chart area hoặc chart placeholder component có cấu trúc đúng.
5. Thêm benchmark block.
6. Chuyển case studies thành card trực quan.
7. CTA rõ ràng dẫn về demo hoặc dashboard.

Output:
- Refactor page.
- Tạo `BACKTEST_REDESIGN_NOTES.md`.
```

## Prompt 7 — Tạo design system mini cho public pages
```md
Hãy tạo một mini design system cho ADN Capital public pages.

Mục tiêu:
- Thống nhất visual language giữa homepage, pricing, auth, backtest, products.

Yêu cầu:
1. Xác định hoặc tạo token cho:
   - colors
   - text styles
   - spacing scale
   - radius
   - border/surface styles
2. Tạo reusable component primitives:
   - Button
   - Badge
   - SectionHeader
   - Card
   - StatCard
   - PricingCard
   - TestimonialCard
   - EmptyState
   - CTASection
3. Không rewrite toàn bộ app shell nếu chưa cần.
4. Ưu tiên áp dụng cho public pages trước.
5. Tạo docs markdown ngắn mô tả component usage.

Output:
- Thực hiện refactor vừa đủ.
- Tạo `PUBLIC_UI_SYSTEM.md`.
```
