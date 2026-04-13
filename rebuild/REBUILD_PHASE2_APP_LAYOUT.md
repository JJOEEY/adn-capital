# REBUILD_PHASE2_APP_LAYOUT.md — App Layout & Dashboard

> Antigravity đọc file này để rebuild layout chính của app (sau khi đăng nhập).
> Semantic colors (dùng nhất quán cho chart và badge — KHÔNG hardcode hex):
>   Success = `#16a34a`  (Tăng, tích cực)
>   Warning = `#f59e0b`  (Cảnh báo, thăm dò)
>   Danger  = `#C0392B` / `#c0614a`  (Giảm, rủi ro)
> Các màu này có trong bảng token ADN_DESIGN_SYSTEM.md mục 2.
> Đọc `ADN_DESIGN_SYSTEM.md` trước. KHÔNG dùng backdrop-filter, blur, glass effect.
> Làm theo thứ tự: Sidebar → Header → Dashboard → Tools. Deploy sau mỗi bước lớn.

---

## 1. ROOT LAYOUT

File: `src/app/(app)/layout.tsx` hoặc layout wrapper sau đăng nhập

```
Cấu trúc:
<html class="dark"> (default dark, toggle bằng JS)
  <body>
    <Sidebar />
    <main>
      <Header />
      <PageContent />
    </main>
  </body>

Layout CSS:
  display: flex
  min-height: 100vh

  Sidebar: width 240px, flex-shrink: 0
  Main: flex: 1, display: flex, flex-direction: column, overflow: hidden
```

---

## 2. SIDEBAR

File: `src/components/Sidebar.tsx`

```
width: 240px
height: 100vh
position: sticky, top: 0
overflow-y: auto
display: flex, flex-direction: column

Light: bg #FFFFFF, border-right 1px solid #E8E4DB
Dark:  bg #0D1410, border-right 1px solid rgba(235,226,207,0.10)
```

### Brand (top)
```
padding: 20px 16px 16px
display: flex, align-items: center, gap: 10px

Logo icon: 32px, border-radius 8px
Brand name: font 700 15px Manrope
  Light: #1C2B22 | Dark: #EBE2CF
Sub text: font 400 11px
  Light: #B0ADA4 | Dark: #5a6b5e
  Text: "AI-Powered Platform"
```

### User card (dưới brand)
```
margin: 0 8px 16px
padding: 12px
border-radius: 10px
border: 1px solid

Light: bg #F3F1EB, border #E8E4DB
Dark:  bg #111a14, border rgba(235,226,207,0.10)

Layout: Avatar (32px) + Name + Role + Dark/Light toggle

Avatar: 32px circle
  Light: bg #2E4D3D, text white
  Dark:  bg #173627, text #EBE2CF
  Hiển thị chữ cái đầu tên user

Name: font 600 13px
  Light: #1C2B22 | Dark: #EBE2CF

Role: font 400 11px
  Light: #7D8471 | Dark: #9aab9e

Dark/Light toggle (bên phải):
  32px circle button
  Light: icon moon, bg transparent, hover bg #F8F7F2
  Dark:  icon sun,  bg transparent, hover bg #162019
  onClick: toggle class 'dark' trên <html>, lưu localStorage 'theme'
```

### Nav sections
```
padding: 0 8px
flex: 1
```

**Section label:**
```
padding: 8px 8px 4px
font: 500 11px Manrope, uppercase, letter-spacing 0.08em
Light: #B0ADA4 | Dark: #5a6b5e
```

**Nav item:**
```
display: flex, align-items: center, gap: 10px
padding: 9px 10px
border-radius: 9px
font: 500 14px Manrope
cursor: pointer
transition: background 0.15s, color 0.15s

Light normal:  color #7D8471, bg transparent
Light hover:   bg #F3F1EB, color #2E4D3D
Light active:  bg rgba(46,77,61,0.10), color #2E4D3D, font-weight 600

Dark normal:   color #9aab9e, bg transparent
Dark hover:    bg #162019, color #EBE2CF
Dark active:   bg rgba(23,54,39,0.50), color #EBE2CF, font-weight 600

Icon: 16px, same color as text
Badge (MỚI/HOT/BETA/UPDATING): font 500 10px uppercase, border-radius 99px, padding 2px 7px
```

### Nav structure (giữ nguyên menu hiện tại)
```
OVERVIEW
  - Trang Chủ
  - Dashboard

SẢN PHẨM ĐẦU TƯ
  - Chỉ báo ART    [MỚI]
  - Tư vấn đầu tư
  - ADN AI Broker
  - Tin Tức        [BETA]

DỊCH VỤ
  - Ký quỹ · Mua nhanh  [HOT]
  - Nhật ký giao dịch

KHÁC
  - Group Telegram
  - Backtest
  - Hướng dẫn sử dụng   [UPDATING]

VỀ CHÚNG TÔI
  - Updating...

QUẢN LÝ (chỉ hiện nếu role = ADMIN)
  - Quản Lý Hệ Thống
```

### Bottom actions
```
padding: 8px 8px 16px
border-top: 1px solid (Light: #E8E4DB | Dark: rgba(235,226,207,0.08))
margin-top: auto

- Thu gọn sidebar (icon chevron)
- Đăng xuất (màu Danger)
  Light: color #C0392B, hover bg rgba(192,57,43,0.06)
  Dark:  color #c0614a, hover bg rgba(192,97,74,0.06)
```

---

## 3. HEADER (in-app)

File: `src/components/AppHeader.tsx`

```
height: 56px
padding: 0 24px
display: flex, align-items: center, justify-content: space-between
border-bottom: 1px solid

Light: bg #FFFFFF, border #E8E4DB
Dark:  bg #0D1410, border rgba(235,226,207,0.10)
```

**Left: Page title + breadcrumb**
```
Page title: font 700 17px Manrope
  Light: #1C2B22 | Dark: #EBE2CF

Breadcrumb: font 400 13px
  Light: #7D8471 | Dark: #9aab9e
  Ví dụ: "Dashboard · Tổng quan thị trường"
```

**Right: action buttons**
```
gap: 8px

Notification bell: 36px circle icon button
  Light: #7D8471, hover bg #F3F1EB
  Dark:  #9aab9e, hover bg #162019

"Làm mới" button: outlined
  Light: border #E8E4DB, color #7D8471, hover border #2E4D3D color #2E4D3D
  Dark:  border rgba(235,226,207,0.15), color #9aab9e

"ADN AI SYSTEM" badge (nếu có):
  Light: bg rgba(46,77,61,0.08), color #2E4D3D
  Dark:  bg rgba(23,54,39,0.40), color #9aab9e
  border-radius: 99px, padding: 5px 12px, font 500 12px
```

---

## 4. TICKER TAPE (market prices bar)

```
height: 40px
overflow: hidden
border-bottom: 1px solid
display: flex, align-items: center

Light: bg #F3F1EB, border #E8E4DB
Dark:  bg #111a14, border rgba(235,226,207,0.10)

Item format: "VNINDEX 1,750 ▲+0.77%"
  Tên: font 500 12px (Light: #7D8471 | Dark: #9aab9e)
  Giá: font 600 12px (Light: #1C2B22 | Dark: #EBE2CF)
  Change+: color #16a34a (xanh lá — cả 2 theme)
  Change-: color Danger (#C0392B light / #c0614a dark) (đỏ — cả 2 theme)

Dùng .animate-marquee
```

---

## 5. DASHBOARD PAGE

File: `src/app/(app)/dashboard/page.tsx`

```
padding: 24px
display: grid
gap: 16px

Light: bg #F8F7F2
Dark:  bg #0D1410
```

### Card base (dùng cho tất cả widget)
```
border-radius: 14px
border: 1px solid
padding: 20px 24px

Light: bg #FFFFFF, border #E8E4DB
       shadow: 0 2px 8px rgba(0,0,0,0.04)
Dark:  bg #111a14, border rgba(235,226,207,0.10)

Card header:
  display: flex, justify-content: space-between, align-items: center
  margin-bottom: 16px

  Title: font 600 14px uppercase letter-spacing 0.05em
    Light: #7D8471 | Dark: #9aab9e

  Badge/Label: font 500 11px
```

### Grid layout dashboard
```
Desktop: 3 columns
  Row 1: [VN-INDEX Chart 2col] [ADN Composite Score 1col]
  Row 2: [Độ rộng thị trường 2col] [Leader Radar / Level 1col]
  Row 3: [Morning Brief 1col] [EOD Brief 1col] [ART Gauge 1col]
  Row 4: [AI nhận định full width]

Tablet: 2 columns
Mobile: 1 column
```

---

## 6. WIDGET: VN-INDEX CHART

```
Card title: "VN-INDEX 30 PHIÊN"

Badge trạng thái:
  TĂNG: bg rgba(22,163,74,0.10), color #16a34a, border rgba(22,163,74,0.20)
  GIẢM: bg rgba(Danger-rgb,0.10), color Danger (#C0392B light / #c0614a dark), border rgba(Danger-rgb,0.20)
  (Giống nhau cả 2 theme)

Chart line:
  Uptrend:   #16a34a (xanh lá)
  Downtrend: Danger (#C0392B light / #c0614a dark) (đỏ)
  Fill area: rgba(22,163,74,0.06) hoặc rgba(Danger-rgb,0.06)

Grid lines:
  Light: rgba(0,0,0,0.06) | Dark: rgba(255,255,255,0.06)

Axis labels:
  Light: #B0ADA4 | Dark: #5a6b5e
  font: 400 11px

Reference line (MA):
  Light: rgba(46,77,61,0.40) dashed
  Dark:  rgba(235,226,207,0.20) dashed
```

---

## 7. WIDGET: ADN COMPOSITE SCORE (Thang đo sức mạnh)

```
Card title: "ADN COMPOSITE SCORE (W/M + ĐỊNH GIÁ)"

Gauge/Donut chart:
  Màu theo score:
    0-4   (NGỦ ĐÔNG):  Danger (#C0392B light / #c0614a dark)
    5-7   (THĂM DÒ):   #f59e0b
    8-10  (THIÊN THỜI): #16a34a
    11-14 (MAX):        #2E4D3D / #173627

Score number: font 700 48px center
  Màu theo level trên

Level badge:
  NGỦ ĐÔNG:  bg rgba(Danger-rgb,0.10), color Danger (#C0392B light / #c0614a dark)
  THĂM DÒ:   bg rgba(245,158,11,0.10), color #f59e0b
  THIÊN THỜI: bg rgba(22,163,74,0.10), color #16a34a

Sub-scores:
  "TA: X/10 · Định giá: X/4"
  font 400 13px text-secondary

Liquidity:
  "Thanh khoản: X,XXX Tỷ VNĐ"
  font 500 13px
  Light: #1C2B22 | Dark: #EBE2CF
```

---

## 8. WIDGET: ĐỘ RỘNG THỊ TRƯỜNG

```
Card title: "ĐỘ RỘNG THỊ TRƯỜNG"

Progress bar stacked (Tăng | TC | Giảm | Trần | Sàn):
  Tăng:   #16a34a
  TC:     #f59e0b
  Giảm:   Danger (#C0392B light / #c0614a dark)
  Trần:   #16a34a (đậm hơn)
  Sàn:    Danger (opacity 0.7)

  Bar height: 12px, border-radius 99px
  Background: Light #F3F1EB | Dark #162019

Stats row dưới bar:
  "Tăng XXX · TC XX · Giảm XXX · Sàn XX"
  font 500 13px, màu tương ứng
```

---

## 9. WIDGET: MORNING BRIEF & EOD BRIEF

```
Card title: "BẢN TIN SÁNG ADN CAPITAL" / "BẢN TIN TỔNG HỢP"
Sub: "MORNING BRIEF" / "END-OF-DAY BRIEF"

Date badge:
  font 500 12px
  Light: bg rgba(46,77,61,0.08), color #2E4D3D
  Dark:  bg rgba(23,54,39,0.40), color #9aab9e

Indices row (CHỈ SỐ THAM CHIẾU):
  Mỗi index: grid 2 col — Tên | Giá + %change
  Separator: Light #E8E4DB | Dark rgba(235,226,207,0.08)
  font: name 400 12px | value 600 14px | change theo màu tăng/giảm

Content sections (VĨ MÔ, THỊ TRƯỜNG...):
  Section label: font 500 11px uppercase letter-spacing
    Light: #2E4D3D | Dark: #9aab9e
    Có icon bullet màu tương ứng

  Bullet items: font 400 14px line-height 1.7
    Light: #1C2B22 | Dark: #EBE2CF

  Divider giữa sections:
    Light: #E8E4DB | Dark: rgba(235,226,207,0.08)
```

---

## 10. WIDGET: ART GAUGE (Analytical Reversal Tracker)

```
Card title: "ART — ANALYTICAL REVERSAL TRACKER"

Status badge góc phải:
  RỦI RO:   bg rgba(Danger-rgb,0.10), color Danger (#C0392B light / #c0614a dark)
  TRUNG TÍNH: bg rgba(245,158,11,0.10), color #f59e0b
  AN TOÀN:  bg rgba(22,163,74,0.10), color #16a34a

Gauge (bán nguyệt):
  Zones từ trái sang phải:
    0-1:   #16a34a (Cơ hội đảo chiều TĂNG)
    1-2.5: #84cc16 (An toàn)
    2.5-4: #f59e0b (Trung tính)
    4-5:   Danger (#C0392B light / #c0614a dark) (Rủi ro đảo chiều GIẢM)

  Needle: Light #1C2B22 | Dark #EBE2CF
  Center score: font 700 32px, màu theo zone

Score labels (vertical list bên phải):
  Mỗi label: font 400 12px
  Điểm số badge: font 600 12px
  Màu theo zone

History sparkline:
  Line: Light #2E4D3D | Dark #9aab9e
  MA7:  Light #7D8471 | Dark #5a6b5e dashed
  Grid: Light rgba(0,0,0,0.04) | Dark rgba(255,255,255,0.04)
```

---

## 11. WIDGET: AI NHẬN ĐỊNH

```
Full width card
padding: 20px 24px

Quote icon: 32px, màu Primary opacity 0.3
Text: font 400 16px italic line-height 1.8
  Light: #1C2B22 | Dark: #EBE2CF

Source: font 500 13px
  Light: #7D8471 | Dark: #9aab9e
```

---

## 12. LEADER RADAR / CIRCUIT BREAKER WIDGET

```
Status header:
  BÌNH THƯỜNG: bg rgba(22,163,74,0.08), border rgba(22,163,74,0.20)
  CẢNH BÁO:    bg rgba(245,158,11,0.08), border rgba(245,158,11,0.20)
  THOÁT HÀNG:  bg rgba(Danger-rgb,0.08), border rgba(Danger-rgb,0.20)
  border-radius: 10px, padding: 12px 16px

Cash ratio indicator:
  0%:   text-secondary
  50%:  color #f59e0b
  100%: color Danger (#C0392B light / #c0614a dark)

Leader stocks list:
  Mỗi item: ticker badge + RS rating bar
  Bar: Light bg #F3F1EB | Dark bg #162019
       Fill: màu Primary theo theme
```

---

## 13. DARK/LIGHT THEME TOGGLE — TOÀN APP

```javascript
// ThemeToggle component
// Lưu vào localStorage, apply khi load
function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark'
  // Gán vào <html> — chuẩn NextJS/Tailwind (KHÔNG dùng document.body)
  document.documentElement.classList.toggle('dark', saved === 'dark')
  document.documentElement.classList.toggle('light', saved === 'light')
}

function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark')
  const next = isDark ? 'light' : 'dark'
  // Luôn gán vào <html>, không phải <body>
  document.documentElement.classList.remove('dark', 'light')
  document.documentElement.classList.add(next)
  localStorage.setItem('theme', next)
}
```

**Vị trí toggle:**
- Sidebar: bên cạnh user info (icon sun/moon)
- Không cần toggle ở header app (đã có trong sidebar)

---

## 14. RESPONSIVE

```
Desktop ≥ 1280px: sidebar 240px + content full
Tablet 768-1279px: sidebar collapse thành 60px (icon only), hover expand
Mobile < 768px: sidebar ẩn, toggle bằng hamburger menu overlay
```

---

## 15. THỨ TỰ THỰC HIỆN

```
Bước 1: Sidebar component (light/dark) → deploy → verify
Bước 2: Header component → deploy → verify
Bước 3: Ticker tape → deploy → verify
Bước 4: Dashboard grid layout → deploy → verify
Bước 5: Từng widget theo thứ tự: Chart → Score → Breadth → Brief → ART
Bước 6: Theme toggle JS → verify cả 2 theme trên toàn app
```

---

## 16. KHÔNG LÀM

- Không đụng vào landing page (đã làm Phase 1)
- Không thay đổi logic business, API calls, data fetching
- Không dùng backdrop-filter, blur, glass
- Không hardcode màu ngoài token
- Không gộp nhiều bước vào 1 deploy — làm từng bước, verify rồi mới tiếp
