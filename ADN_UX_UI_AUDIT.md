# ADN Capital — UX/UI Audit & Redesign Spec

## Mục tiêu
Tài liệu này dùng làm spec để cải thiện UX/UI cho `adncapital.com.vn` theo hướng:

1. Tăng trust và conversion ở landing page.
2. Giảm ma sát từ anonymous user -> đăng nhập -> dùng thử -> trả phí.
3. Làm rõ giá trị sản phẩm theo ngữ cảnh chứng khoán Việt Nam.
4. Chuẩn hóa lại thông tin, component và visual hierarchy.
5. Loại bỏ trạng thái placeholder khiến sản phẩm trông chưa hoàn thiện.

---

## Phạm vi audit
Audit này dựa trên **public logged-out experience** hiện có:

- `/`
- `/san-pham`
- `/pricing`
- `/auth`
- `/backtest`
- `/terminal`
- `/hdsd`
- `/art`
- `/journal`

Không bao gồm dashboard sau đăng nhập.

---

## Kết luận nhanh
ADN Capital đang có nền tảng sản phẩm tốt và khác biệt rõ ở mảng **AI + quant + tín hiệu cho chứng khoán Việt Nam**, nhưng UX/UI public hiện tại đang gặp 4 vấn đề lớn:

1. **Trust chưa đủ mạnh** ở phần đầu trang.
   - Hero có promise tốt nhưng bằng chứng yếu.
   - Counter/tracking stats và performance stats đang để trạng thái rỗng hoặc `0`, làm giảm độ tin cậy.

2. **Information architecture đang lẫn giữa marketing site, docs site và app shell**.
   - Các trang public lặp lại sidebar/menu kiểu “Overview / Sản phẩm đầu tư / Dịch vụ / Khác / Updating...” thay vì giữ cấu trúc marketing rõ ràng.

3. **Nhiều trang public trông chưa hoàn thiện**.
   - `/art`, `/journal`, `/hdsd` có dấu hiệu placeholder/loading/incomplete content.
   - Điều này phá cảm giác “platform chuyên nghiệp”.

4. **Ma sát conversion còn cao**.
   - CTA đang đẩy mạnh vào mở tài khoản DNSE hoặc đăng nhập, nhưng thiếu demo trực quan, thiếu proof và thiếu self-serve onboarding.

---

## Ưu tiên triển khai

### P1 — Sửa ngay trong 1–3 ngày
- Thay hero + trust section.
- Xóa mọi số liệu rỗng/placeholder.
- Ẩn hoặc unpublish các route chưa hoàn thiện.
- Làm lại pricing block và CTA flow.
- Nâng cấp auth page.

### P2 — Làm trong 1 tuần
- Tạo product hub rõ ràng.
- Làm interactive preview cho AI Terminal / Signal Map / Backtest.
- Chuẩn hóa typography, spacing, card system.
- Làm mobile-first cho landing.

### P3 — Làm trong 2–3 tuần
- Redesign onboarding flow.
- Tạo demo mode.
- Thêm case studies sâu, report samples, benchmark, social proof tốt hơn.
- Chuẩn hóa design system toàn site/app.

---

## 1) IA / Navigation — Cần làm lại

## Vấn đề
Public site hiện đang pha trộn nhiều kiểu điều hướng:

- top nav landing page
- menu kiểu app/docs trên các route con
- nội dung “Updating...” xuất hiện ở nhiều trang
- một số route con không có nội dung thực sự nhưng vẫn public

Điều này làm user khó hiểu ADN là:
- website giới thiệu,
- sản phẩm SaaS,
- hay docs portal.

## Đề xuất cấu trúc mới
Chỉ giữ 2 lớp rõ ràng:

### A. Marketing site
- Trang chủ
- Sản phẩm
- Hiệu suất / Backtest
- Bảng giá
- Hướng dẫn
- Về chúng tôi
- Đăng nhập

### B. App sau đăng nhập
- Dashboard
- Signal Map
- RS Rating
- Portfolio
- AI Terminal
- Backtest Studio
- Journal
- Stock Workbench

## Rule
- Public pages **không dùng sidebar kiểu docs/app**.
- Public pages dùng **top nav + section anchors**.
- Chỉ app sau đăng nhập mới có sidebar hoặc shell navigation.
- Route chưa hoàn thiện phải:
  - ẩn khỏi nav,
  - hoặc đổi thành “Coming soon” page đúng chuẩn,
  - hoặc gộp lại vào `Sản phẩm`.

---

## 2) Landing page — Redesign toàn bộ phần above-the-fold

## Mục tiêu
Khi user vào landing page trong 5 giây đầu phải hiểu ngay:

- ADN giúp ai?
- ADN làm gì?
- Vì sao đáng tin?
- Tôi nên bấm gì tiếp theo?

## Vấn đề hiện tại
Hero copy ổn nhưng chưa đủ “sharp”. Có nhiều tín hiệu cùng lúc:
- AI
- Quant
- Broker
- RS Rating
- Backtest
- ART
- Signal Map

=> Quá nhiều promise ngay đầu, thiếu một thông điệp chính.

Ngoài ra các số liệu/track record ở đầu hoặc giữa trang nếu chưa có dữ liệu thật thì đang phản tác dụng.

## Hero mới đề xuất

### Headline
**Nền tảng AI + Quant dành cho nhà đầu tư chứng khoán Việt Nam**

### Subheadline
Quét tín hiệu mua/bán, đọc sức mạnh thị trường, phân tích từng mã và quản trị rủi ro danh mục trong một workflow duy nhất.

### Primary CTA
**Dùng thử dashboard**

### Secondary CTA
**Xem cách hệ thống chọn tín hiệu**

### Trust bar ngay dưới hero
- Theo dõi thị trường Việt Nam theo thời gian thực
- Backtest nhiều chu kỳ thị trường
- Hỗ trợ AI cho TA / FA / Sentiment / News
- Có quản trị rủi ro theo market regime

## Visual hero đề xuất
Không dùng hero chỉ có text.

Dùng layout 2 cột:
- trái: headline + CTA + trust chips
- phải: mockup thật của 3 khối sản phẩm
  - Signal Map
  - AI Terminal
  - Backtest summary

## Rule triển khai
- Không dùng animation chạy chữ quá dài.
- Không nhồi quá nhiều badge/stat.
- Không hiển thị số liệu nếu chưa fetch được dữ liệu thật.
- Với KPI, chỉ hiển thị khi có nguồn dữ liệu rõ ràng.

---

## 3) Trust & Proof — Đây là chỗ cần cứu conversion nhất

## Vấn đề
Site đang bán một sản phẩm có nature “high-trust / high-risk” là tín hiệu đầu tư. Với loại sản phẩm này, **giao diện đẹp chưa đủ**, user cần bằng chứng.

## Hiện cần bổ sung 5 loại proof

### 1. Product proof
Thêm ảnh/snapshot thật của:
- Signal Map
- RS Rating
- Backtest dashboard
- Ticker analysis cards
- Portfolio risk panel

### 2. Outcome proof
Thay khối số liệu placeholder bằng card thật:
- số tín hiệu trong 12 tháng gần nhất
- tỷ lệ thắng theo rule cụ thể
- max drawdown
- avg holding days
- benchmark so với VNINDEX / VN30

### 3. Method proof
Thêm section “Hệ thống hoạt động như thế nào” theo 4 bước:
1. Scan tín hiệu
2. Lọc market regime
3. Chấm điểm sức mạnh / risk
4. Kích hoạt cảnh báo & theo dõi vòng đời tín hiệu

### 4. Human proof
Testimonials hiện nên nâng cấp thành:
- tên thật hoặc viết tắt kèm vai trò cụ thể
- ảnh/avatar thật hoặc avatar style đồng bộ
- câu chuyện use case rõ hơn

### 5. Risk proof
Đưa disclaimer lên vị trí dễ thấy nhưng văn minh:
- Không cam kết lợi nhuận.
- Tín hiệu là công cụ hỗ trợ quyết định.
- Có cơ chế quản trị rủi ro và trạng thái thị trường.

---

## 4) Product section — Gom lại theo workflow, không liệt kê rời rạc

## Vấn đề
Hiện đang trình bày sản phẩm như một danh sách card:
- ART
- Tư vấn đầu tư
- AI Broker
- Margin

Cách này chưa nói rõ user flow. Người dùng mới khó hiểu nên bắt đầu từ đâu.

## Đề xuất sắp xếp lại theo workflow đầu tư

### A. Khám phá cơ hội
- Signal Map
- RS Rating
- Market overview

### B. Phân tích cổ phiếu
- AI Terminal
- Ticker research cards: TA / FA / Sentiment / News
- ART indicator

### C. Quản trị giao dịch
- AI Broker alerts
- Journal
- Portfolio risk / position review

### D. Kiểm chứng chiến lược
- Backtest studio
- Case studies
- Regime review

### E. Dịch vụ hỗ trợ
- Margin
- Room / Telegram
- Tư vấn 1-1

## UI pattern
Mỗi workflow block nên có:
- title rõ ràng
- 1 câu mô tả outcome
- 3 bullet max
- 1 screenshot thật
- 1 CTA cụ thể

---

## 5) Pricing — Cần giảm rối và tăng clarity

## Vấn đề
Pricing hiện có nhiều điểm khiến user phải suy nghĩ quá nhiều:
- vừa có giá thường, vừa giá DNSE
- vừa có free trial, vừa nhập ID DNSE
- tính năng các gói khá giống nhau, khó thấy khác biệt thật
- thanh toán có vẻ còn manual, tăng friction

## Mục tiêu pricing mới
User phải trả lời được ngay 3 câu:
- Tôi nên chọn gói nào?
- Khác nhau ở đâu?
- Tôi trả tiền và dùng ngay như thế nào?

## Cấu trúc pricing đề xuất

### Option A — 3 tier đơn giản hơn
- Starter
- Pro
- Premium

### Mỗi card chỉ nên khác nhau ở 4 biến
- số lượt AI/ngày hoặc tháng
- realtime alerts có/không
- portfolio/journal có/không
- hỗ trợ 1-1 có/không

### DNSE ưu đãi
Không nhét vào toàn bộ pricing logic.
Thay vào đó dùng 1 khối riêng ngay phía trên pricing table:

**Ưu đãi cho khách hàng DNSE**
- Giảm X%
- Dùng thử Y ngày
- Nhập ID DNSE để xác minh

## CTA pricing mới
- `Bắt đầu dùng thử`
- `Chọn gói Pro`
- `Liên hệ tư vấn`

Không nên để mọi CTA đều chỉ là `Đăng Ký` vì thiếu ngữ cảnh.

## Thông tin thanh toán
Nếu chưa self-serve checkout được, giao diện vẫn phải làm rõ:
- Bước 1: Chọn gói
- Bước 2: Thanh toán
- Bước 3: Hệ thống kích hoạt trong bao lâu
- Bước 4: Hỗ trợ qua kênh nào

Nhưng về lâu dài nên chuyển sang flow tự động kích hoạt tài khoản.

---

## 6) Auth / Onboarding — Hiện là điểm yếu lớn

## Vấn đề
Trang auth phải là nơi chốt conversion, nhưng hiện nên được thiết kế lại để:
- giải thích user sẽ nhận được gì sau khi login,
- tạo trust,
- cho user một “preview” trước khi commit.

## Auth page mới đề xuất

### Layout 2 cột
#### Trái
- logo
- heading: `Đăng nhập để mở dashboard ADN Capital`
- 3 lợi ích ngắn:
  - Theo dõi tín hiệu theo thời gian thực
  - Phân tích từng mã bằng ADN AI
  - Quản trị danh mục và nhật ký giao dịch

#### Phải
- button Google login
- note bảo mật
- link dùng thử / xem demo
- support contact

## Thêm một `demo mode`
Đây là thay đổi UX rất đáng giá.
Cho user chưa đăng nhập được xem:
- 1 dashboard snapshot
- 1 stock analysis mẫu
- 1 backtest summary
- 1 signal map preview read-only

Điều này giảm mạnh tâm lý “vào mà không biết bên trong có gì”.

---

## 7) Backtest page — Có tiềm năng lớn nhưng cần làm như product page thực thụ

## Điểm mạnh hiện tại
Backtest page có hướng đúng: nói được logic quản trị rủi ro, có case studies, có narrative theo giai đoạn thị trường.

## Vấn đề
- KPI đang để placeholder.
- Thiếu chart thật.
- Thiếu benchmark.
- Case studies chưa có visual support.

## Redesign đề xuất

### Top section
- headline ngắn hơn
- 4 KPI thật:
  - CAGR hoặc cumulative return
  - win rate
  - max drawdown
  - số lệnh

### Middle section
- equity curve chart
- benchmark selector
- regime filter
- giai đoạn backtest

### Lower section
- 3 case study cards
- mỗi card có:
  - bối cảnh thị trường
  - tín hiệu gì kích hoạt
  - ADN đã làm gì
  - kết quả bảo vệ vốn / lợi nhuận

### CTA
- `Xem demo backtest`
- `Mở dashboard để chạy mô phỏng`

---

## 8) AI Terminal — Đây là USP, nên đẩy lên trung tâm site

## Điểm mạnh
Terminal là feature dễ hiểu nhất với user mới:
- nhập mã
- nhận 4 lớp phân tích
- hỏi đáp trực tiếp

## Đề xuất
- Đưa preview của terminal lên homepage.
- Cho nhập ticker ngay tại landing page.
- Sau khi nhập:
  - hiện modal/demo hoặc redirect sang terminal preview.

## UX pattern đề xuất
### Input box lớn ở homepage
`Nhập mã cổ phiếu, ví dụ: HPG`

### Quick suggestion chips
- HPG
- FPT
- VCB
- SSI
- Thị trường hôm nay

### Kết quả preview
Hiện read-only 4 card:
- TA
- FA
- Sentiment
- News

Cuối preview mới mời đăng nhập để xem chi tiết hoặc lưu lịch sử.

---

## 9) Hướng dẫn / Docs — Không nên để trạng thái “Đang tải...”

## Vấn đề
Guide page là một trust layer quan trọng. Nếu user mở ra thấy nội dung chưa hoàn thiện, cảm giác sản phẩm chưa sẵn sàng.

## Đề xuất
Làm guide tối giản nhưng đầy đủ:

### Cấu trúc
1. Bắt đầu nhanh trong 3 phút
2. Cách đọc Signal Map
3. Cách dùng AI Terminal
4. Cách xem Backtest
5. Cách dùng Journal
6. Câu hỏi thường gặp

### UI
- có mục lục sticky
- có hình minh họa thật
- mỗi mục 1 video gif/ngắn nếu có
- có CTA “đăng nhập để thử ngay” sau mỗi phần

Nếu chưa viết xong, hãy ẩn route này khỏi nav.

---

## 10) Các route placeholder cần xử lý ngay

## Route nên ẩn tạm thời hoặc thay bằng page hoàn chỉnh
- `/art`
- `/journal`
- `/hdsd` nếu chưa có nội dung thật

## Rule sản phẩm
Không public route nào nếu rơi vào một trong 3 trạng thái:
- chỉ có loading text
- chỉ có footer/contact
- không có nội dung giúp user hiểu feature

---

## 11) Visual System — Chuẩn hóa để trông premium hơn

## Design direction
ADN nên theo hướng:
- dark mode premium
- dữ liệu tài chính sạch, gọn, ít màu nhưng nhấn màu có chủ đích
- typography chắc, hiện đại, không “marketing quá tay”

## Token gợi ý

### Typography
- Display: cho hero/headline
- Heading: cho section title
- Body: cho nội dung mô tả
- Mono/tabular: cho số liệu tài chính, %, price, KPI

### Spacing scale
- 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96

### Radius
- card thường: 16
- panel lớn: 20
- pill/chip: full

### Shadows / borders
- ưu tiên border + nền layer hơn shadow nặng
- card tài chính nên có border subtle, không quá glow

### Color roles
- background
- surface-1
- surface-2
- text-primary
- text-secondary
- success
- danger
- warning
- accent

## Component cần chuẩn hóa
- Button
- Badge
- KPI card
- Product card
- Pricing card
- Section header
- Testimonial card
- Input/search box
- Ticker chip
- Empty state
- Loading state
- Table / stat row

---

## 12) Mobile UX — Phải coi là ưu tiên, không phải hậu kiểm

## Rule
Landing và pricing phải đọc tốt trên mobile trước.

## Mobile fixes bắt buộc
- Hero còn 1 CTA chính.
- Trust chips chuyển thành 2 hàng ngắn.
- Product blocks thành stack dọc.
- Pricing cards có sticky selector hoặc segmented control.
- FAQ accordion phải bấm dễ, vùng chạm lớn.
- Footer/contact không lấn quá nhiều chiều cao.

## App preview trên mobile
Không cố nhét full dashboard screenshot nhỏ xíu.
Thay vào đó:
- dùng 1–2 focused mockup
- crop đúng feature quan trọng
- có caption ngắn giải thích

---

## 13) Copywriting — Cần bớt hype, tăng clarity

## Hiện trạng copy
ADN có nhiều từ mạnh như:
- AI
- quant
- realtime
- win rate
- system
- broker

Nhưng nếu dùng quá dày, user sẽ thấy “nhiều promise hơn bằng chứng”.

## Rule copy mới
- 1 section = 1 promise.
- Mỗi promise phải có proof đi kèm.
- Tránh lặp lại 5–6 cụm tương tự nhau.
- Viết outcome theo ngôn ngữ user:
  - tìm điểm mua
  - theo dõi sức mạnh thị trường
  - biết khi nào nên giảm tỷ trọng
  - đọc nhanh một mã trước khi quyết định

## Ví dụ rewrite
### Cũ
`Hệ thống giao dịch thuật toán kết hợp AI — Tự động quét tín hiệu, quản trị rủi ro và bảo vệ danh mục 24/7.`

### Mới
`Một nền tảng duy nhất để quét cơ hội, đọc thị trường và quản trị rủi ro danh mục cho chứng khoán Việt Nam.`

### Cũ
`Khổng Minh của VNINDEX`

### Mới
`Trợ lý phân tích và quản trị giao dịch cho nhà đầu tư Việt Nam`

---

## 14) CTA Strategy — Mỗi trang chỉ nên có 1 next step chính

## Homepage
Primary: `Dùng thử dashboard`
Secondary: `Xem demo tín hiệu`

## Sản phẩm
Primary: `Xem demo feature`
Secondary: `Đăng nhập để dùng`

## Pricing
Primary: `Bắt đầu dùng thử`
Secondary: `Nhận ưu đãi DNSE`

## Backtest
Primary: `Xem demo backtest`
Secondary: `Mở dashboard`

## Auth
Primary: `Tiếp tục với Google`
Secondary: `Xem giao diện mẫu`

---

## 15) Quick wins cực nhanh

### Trong 2 giờ
- Ẩn số liệu `0+`, `0K+`, `0%`.
- Ẩn metric `—` ở backtest nếu chưa có dữ liệu thật.
- Xóa/ẩn `Updating...` khỏi public pages.
- Ẩn route rỗng khỏi nav.
- Đổi CTA `Đăng Ký` thành CTA có ngữ cảnh.

### Trong 1 ngày
- Viết lại hero.
- Thêm trust bar.
- Thêm 3 screenshot thật.
- Sửa pricing comparison cho rõ.
- Nâng cấp auth page.

### Trong 1 tuần
- Tạo demo mode.
- Tạo product hub theo workflow.
- Hoàn thiện guide.
- Hoàn thiện backtest page có chart + benchmark.

---

## 16) Suggested page structure mới cho homepage

1. Hero
2. Trust bar
3. Product preview (Signal Map / AI Terminal / Backtest)
4. How it works
5. Track record / methodology
6. Workflow blocks
7. Testimonials
8. Pricing
9. FAQ
10. Final CTA

---

## 17) Dev checklist cho Codex

## Landing
- Refactor hero into 2-column layout.
- Add trust chips component.
- Remove placeholder KPI rendering when values are null.
- Build reusable screenshot/mockup frame component.
- Group product cards by workflow.

## Pricing
- Create feature matrix.
- Separate DNSE promotion from main pricing logic.
- Add explicit CTA labels.
- Add billing/help disclosure block.

## Auth
- Redesign to split-screen layout.
- Add preview/demo CTA.
- Add support + security copy.

## Backtest
- Add KPI cards with empty-state fallback.
- Add chart area.
- Add benchmark block.
- Convert case studies into visual cards.

## Guide
- If docs unavailable, hide route.
- Else create structured guide page with TOC and screenshots.

## Placeholder policy
- Add route-level guard for unpublished feature pages.
- Any incomplete feature should render `coming-soon` template, not broken production page.

---

## 18) Acceptance criteria

### UX
- User hiểu sản phẩm trong 5 giây đầu.
- User biết CTA tiếp theo trên mỗi page.
- Không còn public page nào tạo cảm giác unfinished.

### UI
- Typography hierarchy rõ.
- Card/layout nhất quán.
- Screenshot thật thay placeholder.
- Pricing scan được trong dưới 15 giây.

### Conversion
- Giảm bounce ở homepage.
- Tăng click từ homepage -> demo/auth.
- Tăng conversion từ pricing -> signup.

---

## 19) Hướng triển khai thực tế

### Sprint 1
- Homepage
- Pricing
- Auth
- Hide placeholder routes

### Sprint 2
- Product hub
- Backtest redesign
- Guide page

### Sprint 3
- Demo mode
- Better onboarding
- Design system hardening

---

## 20) Khuyến nghị cuối cùng
ADN không cần làm site “nhiều hiệu ứng hơn”.
ADN cần làm site:
- rõ hơn,
- đáng tin hơn,
- có demo tốt hơn,
- ít placeholder hơn,
- và dẫn user vào đúng feature nhanh hơn.

Với sản phẩm chứng khoán Việt Nam, UX chiến thắng không nằm ở animation mà nằm ở:
- clarity,
- proof,
- tốc độ hiểu giá trị,
- và cảm giác hệ thống đã sẵn sàng để sử dụng thật.
