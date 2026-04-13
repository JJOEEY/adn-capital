# REBUILD_PHASE3_TOOLS.md — Dashboard & Công cụ

> Rebuild các trang công cụ chính: Morning Brief, EOD Brief, Chỉ báo ART, Thang đo sức mạnh thị trường, ADN AI Broker, Tư vấn đầu tư.
> Đọc `ADN_DESIGN_SYSTEM.md` trước. KHÔNG dùng backdrop-filter, blur, glass.
> Làm từng trang, deploy verify trước khi làm trang tiếp theo.

---

## 1. THỨ TỰ THỰC HIỆN

```
Bước 1: Trang Tin Tức (Morning Brief + EOD Brief)
Bước 2: Trang Chỉ báo ART
Bước 3: Trang Dashboard (Thang đo sức mạnh + các widget)
Bước 4: Trang ADN AI Broker (Signal Map)
Bước 5: Trang Tư vấn đầu tư (Investment Chat)
```

---

## 2. TRANG TIN TỨC (`/tin-tuc`)

File: `src/app/(app)/tin-tuc/page.tsx`

### Layout
```
2 tab chính: "Cập nhật thông tin" | "Tư vấn đầu tư"
Tab bar:
  Light: bg #FFFFFF, border-bottom 1px solid #E8E4DB
  Dark:  bg #0D1410, border-bottom 1px solid rgba(235,226,207,0.10)

  Tab active:
    Light: color #2E4D3D, border-bottom 2px solid #2E4D3D, font 600
    Dark:  color #EBE2CF, border-bottom 2px solid #EBE2CF, font 600

  Tab inactive:
    Light: color #7D8471
    Dark:  color #9aab9e
```

### Time selector buttons (10:00 | 11:30 | 14:00 | 14:45)
```
border-radius: 99px
padding: 4px 14px
font: 500 13px Manrope

Chưa có data (future):
  Light: bg #F3F1EB, color #B0ADA4, border 1px solid #E8E4DB
  Dark:  bg #162019, color #5a6b5e, border 1px solid rgba(235,226,207,0.08)

Đã có data:
  Light: bg rgba(46,77,61,0.10), color #2E4D3D, border 1px solid rgba(46,77,61,0.20)
  Dark:  bg rgba(23,54,39,0.40), color #9aab9e, border 1px solid rgba(235,226,207,0.15)

Selected:
  Light: bg #2E4D3D, color white
  Dark:  bg #173627, color #EBE2CF
```

### Nút "Bật thông báo"
```
border-radius: 10px
padding: 8px 16px
font: 500 13px

Light: bg #F3F1EB, color #7D8471, border 1px solid #E8E4DB
Dark:  bg #162019, color #9aab9e, border 1px solid rgba(235,226,207,0.10)
hover: border Primary color
```

### Card tin nhắn rỗng (Chưa có thông báo)
```
border-radius: 14px
padding: 48px 24px
text-align: center

Light: bg #FFFFFF, border 1px solid #E8E4DB
Dark:  bg #111a14, border 1px solid rgba(235,226,207,0.10)

Icon clock: 48px, opacity 0.3
  Light: #7D8471 | Dark: #5a6b5e

Title: font 600 16px
  Light: #1C2B22 | Dark: #EBE2CF

Sub: font 400 14px
  Light: #7D8471 | Dark: #9aab9e
```

### Card bản tin (khi có data)
```
border-radius: 14px
padding: 20px 24px
border: 1px solid

Light: bg #FFFFFF, border #E8E4DB
Dark:  bg #111a14, border rgba(235,226,207,0.10)

Header:
  Title: font 700 15px uppercase letter-spacing
    Light: #1C2B22 | Dark: #EBE2CF
  Sub label: "MORNING BRIEF" / "END-OF-DAY BRIEF"
    font 500 11px uppercase
    Light: #7D8471 | Dark: #9aab9e
  Date badge: border-radius 99px, padding 3px 10px
    Light: bg rgba(46,77,61,0.08), color #2E4D3D
    Dark:  bg rgba(23,54,39,0.40), color #9aab9e

Chỉ số tham chiếu (indices grid):
  display: grid, grid-template-columns: repeat(3, 1fr), gap: 12px
  Mỗi item:
    border-radius: 10px, padding: 12px
    Light: bg #F3F1EB | Dark: bg #162019
    Name: font 500 12px text-secondary
    Value: font 700 16px (Light: #1C2B22 | Dark: #EBE2CF)
    Change+: Success (#16a34a) | Change-: Danger (#C0392B light / #c0614a dark)

Content sections:
  Section label: font 500 11px uppercase letter-spacing 0.08em
    Với icon bullet ●
    Light: #2E4D3D | Dark: #9aab9e
  Bullet list: font 400 14px line-height 1.8
    Light: #1C2B22 | Dark: #EBE2CF
  Divider: Light #E8E4DB | Dark rgba(235,226,207,0.08)
```

---

## 3. TRANG CHỈ BÁO ART (`/tei`)

File: `src/app/(app)/tei/page.tsx`

### Page header
```
padding: 24px 24px 0

Title: "ART — Analytical Reversal Tracker"
  font 700 22px | Light: #1C2B22 | Dark: #EBE2CF

Sub: "Chỉ báo điểm đảo chiều thị trường cho VN30"
  font 400 14px | Light: #7D8471 | Dark: #9aab9e

Badge "MỚI":
  Light: bg rgba(46,77,61,0.10), color #2E4D3D
  Dark:  bg rgba(23,54,39,0.40), color #9aab9e
  border-radius: 99px, padding: 3px 10px, font 500 11px uppercase
```

### Main gauge card
```
border-radius: 14px, padding: 32px
border: 1px solid

Light: bg #FFFFFF, border #E8E4DB, shadow 0 2px 8px rgba(0,0,0,0.04)
Dark:  bg #111a14, border rgba(235,226,207,0.10)

Status badge (góc phải trên):
  RỦI RO ĐẢO CHIỀU GIẢM: bg rgba(Danger-rgb,0.10), color Danger, border rgba(Danger-rgb,0.20)
  TRUNG TÍNH:             bg rgba(Warning-rgb,0.10), color Warning, border rgba(Warning-rgb,0.20)
  CƠ HỘI ĐẢO CHIỀU TĂNG: bg rgba(Success-rgb,0.10),  color Success, border rgba(Success-rgb,0.20)
  border-radius: 99px, padding: 5px 14px, font 600 12px
```

### Semicircle gauge
```
Gauge zones (trái → phải):
  0.0–1.0: Success (#16a34a)  "Cơ hội tăng"
  1.0–2.5: Success  "An toàn"
  2.5–4.0: Warning (#f59e0b)  "Trung tính"
  4.0–5.0: Danger (#C0392B light / #c0614a dark)  "Rủi ro giảm"

Background track:
  Light: #F3F1EB | Dark: #162019

Needle:
  Light: #1C2B22 | Dark: #EBE2CF

Center value: font 700 48px
  Màu theo zone hiện tại

Center label "ĐIỂM": font 500 12px uppercase
  Light: #7D8471 | Dark: #9aab9e

Center sub (phân loại): font 500 14px
  Màu theo zone
```

### Score labels list (bên phải gauge)
```
Mỗi label:
  display: flex, justify-content: space-between, align-items: center
  padding: 8px 0
  border-bottom: 1px solid (Light: #F3F1EB | Dark: rgba(235,226,207,0.06))

  Label text: font 400 13px (Light: #7D8471 | Dark: #9aab9e)
  Score badge: font 600 13px, border-radius 99px, padding 2px 10px
    Màu theo zone tương ứng
```

### Components breakdown
```
5 component cards (grid 2+3 hoặc scroll):
  border-radius: 10px, padding: 14px 16px
  border: 1px solid

  Light: bg #F3F1EB, border #E8E4DB
  Dark:  bg #162019, border rgba(235,226,207,0.08)

  Component name: font 500 13px
  Weight: font 400 12px text-secondary
  Score bar: height 6px, border-radius 99px
    bg: Light #E8E4DB | Dark rgba(235,226,207,0.10)
    fill: màu theo zone
```

### History chart (30 phiên)
```
border-radius: 14px, padding: 20px 24px
border: 1px solid

Light: bg #FFFFFF, border #E8E4DB
Dark:  bg #111a14, border rgba(235,226,207,0.10)

Title: "LỊCH SỬ RPI — 30 PHIÊN"
  font 600 13px uppercase | Light: #7D8471 | Dark: #9aab9e

Line RPI:  Light #2E4D3D | Dark #9aab9e, strokeWidth 2
Line MA7:  Light #7D8471 | Dark #5a6b5e, strokeWidth 1.5, dashed

Zone bands (horizontal fills):
  0-1:   rgba(Success-rgb,0.06)
  1-2.5: rgba(Success-rgb,0.04)
  2.5-4: rgba(Warning-rgb,0.04)
  4-5:   rgba(Danger-rgb,0.06)

Grid: Light rgba(0,0,0,0.04) | Dark rgba(255,255,255,0.04)
Axis: Light #B0ADA4 | Dark #5a6b5e, font 11px
Tooltip:
  Light: bg #FFFFFF, border #E8E4DB, shadow 0 4px 12px rgba(0,0,0,0.08)
  Dark:  bg #111a14, border rgba(235,226,207,0.15)
```

---

## 4. TRANG DASHBOARD — THANG ĐO SỨC MẠNH

File: `src/app/(app)/dashboard/page.tsx`

### ADN Composite Score card
```
border-radius: 14px, padding: 24px
border: 1px solid

Light: bg #FFFFFF, border #E8E4DB
Dark:  bg #111a14, border rgba(235,226,207,0.10)

Gauge donut/arc:
  Màu theo score:
    0–4   (NGỦ ĐÔNG):   Danger (#C0392B light / #c0614a dark)
    5–7   (THĂM DÒ):    Warning (#f59e0b)
    8–10  (THIÊN THỜI): Success (#16a34a)
    11–14 (MAX):        #2E4D3D (light) / #9aab9e (dark)

  Background arc: Light #F3F1EB | Dark #162019

Score center: font 700 52px, màu theo level
"/14": font 400 20px text-secondary

Level badge:
  NGỦ ĐÔNG:   bg rgba(Danger-rgb,0.10),  color Danger,  border rgba(Danger-rgb,0.20)
  THĂM DÒ:    bg rgba(Warning-rgb,0.10), color Warning,  border rgba(Warning-rgb,0.20)
  THIÊN THỜI: bg rgba(Success-rgb,0.10),  color Success,  border rgba(Success-rgb,0.20)
  border-radius: 99px, padding: 5px 14px, font 600 13px

Sub scores row:
  "TA: X/10 · Định giá: X/4"
  font 400 13px | Light: #7D8471 | Dark: #9aab9e

Liquidity:
  font 600 14px | Light: #1C2B22 | Dark: #EBE2CF

Action message:
  border-radius: 10px, padding: 12px 16px
  font 400 14px italic
  Light: bg #F3F1EB, border #E8E4DB, color #1C2B22
  Dark:  bg #162019, border rgba(235,226,207,0.10), color #EBE2CF
```

### Độ rộng thị trường card
```
Stacked progress bar:
  Tăng:   Success (#16a34a)
  TC:     Warning (#f59e0b)
  Giảm:   Danger (#C0392B light / #c0614a dark)
  Trần:   Success (đậm hơn)
  Sàn:    Danger (đậm hơn)
  Height: 12px, border-radius 99px
  bg:     Light #F3F1EB | Dark #162019

Stats row:
  Tăng XXX | TC XX | Giảm XXX | Trần XX | Sàn XX
  font 500 13px, màu tương ứng
```

### Circuit Breaker / Leader Radar card
```
Status header bar:
  border-radius: 10px, padding: 12px 16px
  BÌNH THƯỜNG: bg rgba(Success-rgb,0.08), border rgba(Success-rgb,0.20), color Success
  CẢNH BÁO:   bg rgba(Warning-rgb,0.08), border rgba(Warning-rgb,0.20), color Warning
  THOÁT HÀNG: bg rgba(Danger-rgb,0.08),  border rgba(Danger-rgb,0.20),  color Danger
  font 700 14px

Cash ratio:
  0%:   text-secondary
  50%:  color Warning, font 700
  100%: color Danger, font 700

Leader list:
  Mỗi leader: ticker badge + RS rating progress
  RS bar: Light bg #F3F1EB | Dark bg #162019
          fill: màu Primary theo theme
```

---

## 5. TRANG ADN AI BROKER (`/dashboard/signal-map`)

File: `src/app/(app)/dashboard/signal-map/page.tsx`

### Tab bar (Tầm ngắm | Đang nắm giữ | Đã đóng)
```
border-radius: 99px overflow
Light: bg #F3F1EB
Dark:  bg #162019

Tab active:
  Light: bg #FFFFFF, color #1C2B22, shadow 0 1px 4px rgba(0,0,0,0.08)
  Dark:  bg #111a14, color #EBE2CF

Tab inactive:
  Light: color #7D8471
  Dark:  color #9aab9e

Badge count:
  Light: bg rgba(46,77,61,0.10), color #2E4D3D
  Dark:  bg rgba(23,54,39,0.40), color #9aab9e
  border-radius: 99px, padding: 1px 8px, font 600 12px
```

### Filter tags (Tất cả | Leader | Trung hạn | Ngắn hạn | Tiếp cận)
```
border-radius: 99px, padding: 5px 14px, font 500 13px

Default:
  Light: bg #F3F1EB, color #7D8471, border 1px solid #E8E4DB
  Dark:  bg #162019, color #9aab9e, border 1px solid rgba(235,226,207,0.08)

Active:
  Leader:    Light bg rgba(46,77,61,0.10) color #2E4D3D   | Dark rgba(23,54,39,0.40) #9aab9e
  Trung hạn: Light bg rgba(Warning-rgb,0.10) color Warning | Dark similar
  Ngắn hạn:  Light bg rgba(Success-rgb,0.10) color Success  | Dark similar
  Tiếp cận:  Light bg rgba(125,132,113,0.10) color #7D8471 | Dark similar
```

### Signal Card
```
border-radius: 14px, padding: 20px
border: 1px solid
transition: border-color 0.2s, transform 0.2s
cursor: pointer

Light: bg #FFFFFF, border #E8E4DB
       hover: border #D6CDBB, shadow 0 4px 12px rgba(46,77,61,0.08), translateY(-2px)
Dark:  bg #111a14, border rgba(235,226,207,0.10)
       hover: border rgba(235,226,207,0.20), translateY(-2px)

Ticker badge (góc trên trái):
  font 700 15px, border-radius 8px, padding 4px 10px
  Light: bg rgba(46,77,61,0.10), color #2E4D3D
  Dark:  bg rgba(23,54,39,0.40), color #9aab9e

Type badge (NGẮN HẠN / TRUNG HẠN / LEADER):
  border-radius: 99px, padding: 3px 10px, font 500 11px uppercase

Signal type bar màu:
  LEADER:    #2E4D3D (light) / #173627 (dark)
  TRUNG HẠN: Warning (#f59e0b)
  NGẮN HẠN:  Success (#16a34a)
  TIẾP CẬN:  #7D8471

Entry / Target / Stoploss boxes:
  border-radius: 8px, padding: 8px 12px
  Light: bg #F3F1EB | Dark: bg #162019
  Label: font 500 11px uppercase text-secondary
  Value: font 700 15px (Light: #1C2B22 | Dark: #EBE2CF)
  Stoploss value: color Danger

Stats row (R/R | WR | Sharpe):
  font 500 12px
  Label: text-secondary
  Value: Light #1C2B22 | Dark #EBE2CF

AI Broker insight box:
  border-radius: 8px, padding: 10px 14px
  border-left: 3px solid Primary
  Light: bg rgba(46,77,61,0.04), border-left #2E4D3D
  Dark:  bg rgba(23,54,39,0.20), border-left #173627
  font 400 13px, line-height 1.6
  Light: #1C2B22 | Dark: #EBE2CF
```

---

## 6. TRANG TƯ VẤN ĐẦU TƯ (`/terminal`)

File: `src/app/(app)/terminal/page.tsx`

Spec đầy đủ đã có trong `ADN_DESIGN_SYSTEM.md` mục 9 (Investment Chat).

### Bổ sung cho light mode:

```
Chat container:
  Light: bg #F8F7F2
  Dark:  bg #0D1410

Message area:
  max-height: calc(100vh - 200px)
  overflow-y: auto

User bubble:
  Light: bg #2E4D3D, color white
  Dark:  bg #173627, color #EBE2CF
  border-radius: 16px 16px 4px 16px

Bot bubble:
  Light: bg #FFFFFF, border 1px solid #E8E4DB, color #1C2B22
  Dark:  bg #111a14, border 1px solid rgba(235,226,207,0.10), color #EBE2CF
  border-radius: 4px 16px 16px 16px

4 Card grid (khi nhận ticker):
  Light: bg #FFFFFF, border 1px solid #E8E4DB
         hover: border #2E4D3D, shadow 0 4px 12px rgba(46,77,61,0.10), translateY(-1px)
  Dark:  bg #111a14, border 1px solid rgba(235,226,207,0.10)
         hover: border rgba(235,226,207,0.25), translateY(-1px)

Input bar:
  Light: bg #FFFFFF, border 1px solid #E8E4DB, border-radius 99px
  Dark:  bg #111a14, border 1px solid rgba(235,226,207,0.12), border-radius 99px

Send button:
  Light: bg #2E4D3D, hover #243d30
  Dark:  bg #173627, hover #1f4a34

react-markdown render:
  Cài: npm install react-markdown
  Dùng <ReactMarkdown>{data.analysis}</ReactMarkdown>
  KHÔNG dùng dangerouslySetInnerHTML
```

---

## 7. CHECKLIST VERIFY MỖI TRANG

Sau khi deploy từng trang:
- [ ] Light mode hiển thị đúng màu cream + primary green
- [ ] Dark mode hiển thị đúng màu deep forest
- [ ] Toggle light/dark không bị flash
- [ ] Không còn blur/glass nào
- [ ] Chart colors (Success/Warning/Danger) đúng cả 2 theme
- [ ] Không có text trắng trên nền trắng hoặc text tối trên nền tối

---

## 8. KHÔNG LÀM

- Không đụng landing page (Phase 1) hay layout (Phase 2)
- Không thay đổi logic API, data fetching
- Không dùng backdrop-filter, blur, glass
- Không hardcode màu ngoài token
- Deploy từng trang riêng lẻ, không gộp
