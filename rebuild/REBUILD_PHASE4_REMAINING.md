# REBUILD_PHASE4_REMAINING.md — Các trang còn lại

> Rebuild các trang: Pricing, Nhật ký giao dịch, Backtest, Admin, Margin, Hướng dẫn.
> Đọc `ADN_DESIGN_SYSTEM.md` trước. KHÔNG dùng backdrop-filter, blur, glass.
> Đây là phase cuối — sau phase này toàn bộ app đồng nhất light/dark.

---

## 1. THỨ TỰ THỰC HIỆN

```
Bước 1: Trang Pricing (/pricing)
Bước 2: Trang Nhật ký giao dịch (/journal)
Bước 3: Trang Backtest (/backtest)
Bước 4: Trang Margin (/margin)
Bước 5: Trang Admin (/admin)
Bước 6: Trang Hướng dẫn (/hdsd)
Bước 7: Trang Auth (/auth) — login/register
Bước 8: Final audit toàn app
```

---

## 2. TRANG PRICING (`/pricing`)

File: `src/app/(app)/pricing/page.tsx` hoặc `src/app/pricing/page.tsx`

### Page header
```
text-align: center, padding: 60px 48px 40px

Label: "Bảng giá đầu tư"
  font 500 12px uppercase letter-spacing 0.1em
  Light: #7D8471 | Dark: #9aab9e

Headline: "Chọn Gói Phù Hợp Với Đại Ca"
  font 700 40px Manrope | Light: #1C2B22 | Dark: #EBE2CF

Sub: font 400 17px | Light: #7D8471 | Dark: #9aab9e
```

### DNSE promo banner
```
border-radius: 14px, padding: 20px 24px
border: 1px solid
text-align: center

Light: bg rgba(46,77,61,0.04), border rgba(46,77,61,0.15)
Dark:  bg rgba(23,54,39,0.20), border rgba(235,226,207,0.12)

Icon: 🎁
Text: font 500 15px | Light: #1C2B22 | Dark: #EBE2CF
Sub:  font 400 14px | Light: #7D8471 | Dark: #9aab9e

Input DNSE ID:
  border-radius: 10px, height 40px
  Light: bg #FFFFFF, border #E8E4DB
  Dark:  bg #111a14, border rgba(235,226,207,0.12)

Button "Áp dụng":
  Light: bg #2E4D3D, color white
  Dark:  bg #173627, color #EBE2CF
  border-radius: 10px
```

### Pricing cards grid (2x2 hoặc 1x4)
```
display: grid, grid-template-columns: repeat(2, 1fr) (desktop) | 1fr (mobile)
gap: 16px

Mỗi card:
  border-radius: 14px, padding: 28px
  border: 1px solid
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s

  Light normal:  bg #FFFFFF, border #E8E4DB
                 hover: border #D6CDBB, shadow 0 4px 16px rgba(46,77,61,0.08), translateY(-2px)
  Dark normal:   bg #111a14, border rgba(235,226,207,0.10)
                 hover: border rgba(235,226,207,0.20), translateY(-2px)

  Card "Bán chạy nhất":
    Light: border #2E4D3D, bg rgba(46,77,61,0.02)
           hover: border #2E4D3D, shadow 0 8px 24px rgba(46,77,61,0.12), translateY(-3px)
    Dark:  border rgba(235,226,207,0.30), bg rgba(23,54,39,0.15)
           hover: border rgba(235,226,207,0.40), translateY(-3px)

  Badge "Bán chạy nhất" / "Tiết kiệm nhất":
    Light: bg #2E4D3D, color white
    Dark:  bg #173627, color #EBE2CF
    border-radius: 99px, padding: 4px 12px, font 600 11px uppercase

  Plan name: font 600 15px
    Light: #1C2B22 | Dark: #EBE2CF

  Price:
    Original (gạch): font 400 16px text-muted, text-decoration line-through
    DNSE price: font 700 32px Primary color

  Period: font 400 14px text-secondary

  Feature list:
    Mỗi item: checkmark icon + text
    Checkmark: color Success (Success (#16a34a))
    Text: font 400 14px | Light: #1C2B22 | Dark: #EBE2CF

  CTA button: Primary button full width, border-radius 10px
```

---

## 3. TRANG NHẬT KÝ GIAO DỊCH (`/journal`)

File: `src/app/(app)/journal/page.tsx`

### Summary cards row
```
display: grid, grid-template-columns: repeat(4, 1fr), gap: 12px

Mỗi card:
  border-radius: 12px, padding: 16px 20px
  border: 1px solid

  Light: bg #FFFFFF, border #E8E4DB
  Dark:  bg #111a14, border rgba(235,226,207,0.10)

  Label: font 500 12px uppercase | Light: #7D8471 | Dark: #9aab9e
  Value: font 700 24px
    Profit: Success (#16a34a) | Loss: Danger (#C0392B light / #c0614a dark) | Neutral: Light #1C2B22 Dark #EBE2CF
  Sub: font 400 12px text-secondary
```

### Transaction table
```
border-radius: 14px, overflow: hidden
border: 1px solid (Light: #E8E4DB | Dark: rgba(235,226,207,0.10))

Table header:
  Light: bg #F3F1EB, color #7D8471
  Dark:  bg #162019, color #9aab9e
  font: 500 12px uppercase letter-spacing
  border-bottom: 1px solid (Light: #E8E4DB | Dark: rgba(235,226,207,0.10))

Table row:
  Light: bg #FFFFFF, hover bg #F8F7F2
  Dark:  bg #111a14, hover bg #162019
  border-bottom: 1px solid (Light: #E8E4DB | Dark: rgba(235,226,207,0.06))

  Ticker cell: font 700 14px | Light: #1C2B22 | Dark: #EBE2CF
  PnL+:  color Success, font 600
  PnL-:  color Danger, font 600
  Other: font 400 14px text-secondary

Pagination:
  Light: bg #F3F1EB, border-top 1px solid #E8E4DB
  Dark:  bg #162019, border-top 1px solid rgba(235,226,207,0.08)
  Page button active: Light bg #2E4D3D color white | Dark bg #173627 color #EBE2CF
```

### AI phân tích nhật ký
```
border-radius: 14px, padding: 20px 24px
border: 1px solid

Light: bg #FFFFFF, border #E8E4DB
Dark:  bg #111a14, border rgba(235,226,207,0.10)

Header: "NHẬT KÝ AI — Phân tích tâm lý & Cơ cấu danh mục"
  font 600 14px | Light: #1C2B22 | Dark: #EBE2CF

Content: render markdown bằng react-markdown
  Light: #1C2B22 | Dark: #EBE2CF
  line-height: 1.8
```

---

## 4. TRANG BACKTEST (`/backtest`)

File: `src/app/(app)/backtest/page.tsx`

### Filter controls
```
display: flex, gap: 12px, flex-wrap: wrap

Select dropdowns:
  border-radius: 10px, height 40px, padding 0 14px
  Light: bg #FFFFFF, border #E8E4DB, color #1C2B22
  Dark:  bg #111a14, border rgba(235,226,207,0.12), color #EBE2CF

Date range inputs: same style
Run button: Primary button
```

### Results chart
```
border-radius: 14px, padding: 20px 24px
border: 1px solid

Light: bg #FFFFFF, border #E8E4DB
Dark:  bg #111a14, border rgba(235,226,207,0.10)

Equity curve line: Success (#16a34a) (profit) / Danger (#C0392B light / #c0614a dark) (loss)
Drawdown fill: rgba(Danger-rgb,0.08)
Grid: Light rgba(0,0,0,0.04) | Dark rgba(255,255,255,0.04)
Axis: Light #B0ADA4 | Dark #5a6b5e
```

### Stats cards
```
Dùng Summary cards style (xem Journal mục 3)
Metrics: Win Rate / Profit Factor / Max Drawdown / Sharpe Ratio
```

---

## 5. TRANG MARGIN (`/margin`)

File: `src/app/(app)/margin/page.tsx` hoặc landing

### Hero section
```
text-align: center, padding: 60px 48px

Headline: font 700 40px | Light: #1C2B22 | Dark: #EBE2CF
Highlight "5.99%/năm": color Primary
Sub: font 400 17px text-secondary

CTA: Primary button "Đăng ký tư vấn"
```

### Feature cards (3 columns)
```
Dùng Feature card style từ Phase 1 (Mục 6)
```

### Contact form
```
border-radius: 14px, padding: 32px
border: 1px solid
max-width: 560px, margin: 0 auto

Light: bg #FFFFFF, border #E8E4DB
Dark:  bg #111a14, border rgba(235,226,207,0.10)

Inputs: theo Input spec ADN_DESIGN_SYSTEM.md
Submit: Primary button full width
```

---

## 6. TRANG ADMIN (`/admin`)

File: `src/app/(app)/admin/page.tsx`

> Chỉ accessible khi role = ADMIN. Redirect về dashboard nếu không phải admin.

### Admin nav tabs
```
User Management | Signal Management | System Settings
Tab style: giống Tab bar ở Tin Tức (mục 2)
```

### User management table
```
Dùng Transaction table style (mục 3)

Action buttons:
  "Cấp Admin": Light bg rgba(46,77,61,0.10) color #2E4D3D | Dark similar
               border-radius 8px, padding 5px 12px, font 500 13px
  "Thu hồi":   Light bg rgba(Danger-rgb,0.10) color Danger | Dark similar
  hover: opacity 0.8
```

### System stats cards
```
Dùng Summary cards style (mục 3)
Metrics: Total users / Active subscriptions / API calls today / Revenue
```

---

## 7. TRANG HƯỚNG DẪN (`/hdsd`)

File: `src/app/(app)/hdsd/page.tsx`

### Layout: sidebar nav + content
```
Sidebar nav (left, 220px):
  Light: bg #FFFFFF, border-right 1px solid #E8E4DB
  Dark:  bg #111a14, border-right 1px solid rgba(235,226,207,0.10)

  Nav item: dùng Nav item style từ Phase 2

Content area:
  max-width: 720px
  Heading: font 700 24px
  Body: font 400 15px, line-height 1.8

Badge "UPDATING":
  Light: bg rgba(125,132,113,0.10), color #7D8471
  Dark:  bg rgba(125,132,113,0.15), color #9aab9e
  border-radius: 99px, font 500 11px uppercase
```

---

## 8. TRANG AUTH (`/auth`)

File: `src/app/auth/page.tsx`

### Auth card
```
max-width: 440px, margin: auto
border-radius: 16px, padding: 40px
border: 1px solid

Light: bg #FFFFFF, border #E8E4DB, shadow 0 8px 24px rgba(0,0,0,0.06)
Dark:  bg #111a14, border rgba(235,226,207,0.12)

Page background:
  Light: bg #F8F7F2
  Dark:  bg #0D1410
```

### Logo + brand
```
text-align: center, margin-bottom: 32px

Logo: 56px circle, border-radius 14px
  Light: bg #2E4D3D | Dark: bg #173627

Brand: font 700 22px | Light: #1C2B22 | Dark: #EBE2CF
Tagline: font 400 14px text-secondary
```

### Tab (Đăng nhập | Đăng ký)
```
display: grid, grid-template-columns: 1fr 1fr
border-radius: 10px, overflow: hidden
border: 1px solid

Light: border #E8E4DB
Dark:  border rgba(235,226,207,0.10)

Tab active:
  Light: bg #2E4D3D, color white
  Dark:  bg #173627, color #EBE2CF

Tab inactive:
  Light: bg #F3F1EB, color #7D8471
  Dark:  bg #162019, color #9aab9e
```

### Google OAuth button
```
border-radius: 10px, padding: 12px
border: 1px solid
display: flex, align-items: center, justify-content: center, gap: 10px
font: 500 14px

Light: bg #FFFFFF, border #E8E4DB, color #1C2B22
       hover: bg #F3F1EB, border #D6CDBB
Dark:  bg #162019, border rgba(235,226,207,0.12), color #EBE2CF
       hover: bg #1a2a1d
```

### Divider "HOẶC"
```
display: flex, align-items: center, gap: 12px

Line: Light #E8E4DB | Dark rgba(235,226,207,0.10), height 1px, flex 1
Text: font 500 12px uppercase | Light: #B0ADA4 | Dark: #5a6b5e
```

### Form inputs
```
Dùng Input spec từ ADN_DESIGN_SYSTEM.md
Label: font 500 14px | Light: #1C2B22 | Dark: #EBE2CF

Error message:
  Light: color Danger, bg rgba(Danger-rgb,0.06), border rgba(Danger-rgb,0.20)
  Dark:  color Danger, bg rgba(Danger-rgb,0.08)
  border-radius: 8px, padding: 10px 14px, font 400 14px
```

### Submit button
```
Primary button, full width, height 46px
font: 600 15px
```

### "Chưa có tài khoản?" link
```
text-align: center, font 400 14px

Link "Đăng ký ngay":
  Light: color #2E4D3D, hover underline
  Dark:  color #9aab9e, hover underline
```

---

## 9. FINAL AUDIT — SAU KHI HOÀN THÀNH TẤT CẢ PHASE

Chạy lệnh này để verify không còn legacy màu nào:

```bash
grep -r 'backdrop-filter\|backdrop-blur\|liquid-glass\|bg-gray-[789]\|bg-zinc-[789]\|bg-slate-[789]\|bg-neutral-[789]\|bg-black' \
  src/ --include='*.tsx' --include='*.ts' --include='*.css' \
  | grep -v node_modules | grep -v '.next'
```

Kết quả phải là **0 lines**. Nếu còn → fix hết trước khi báo done.

---

## 10. RESPONSIVE — TẤT CẢ TRANG

```
Desktop ≥ 1280px: layout đầy đủ
Tablet 768-1279px: grid collapse, sidebar icon-only
Mobile < 768px: single column, font scale down

Pricing grid:   desktop 2x2 → mobile 1x4
Journal table:  desktop full → mobile horizontal scroll
Backtest chart: giữ aspect ratio, horizontal scroll nếu cần
Admin table:    horizontal scroll trên mobile
```

---

## 11. KHÔNG LÀM

- Không đụng Phase 1 (landing), Phase 2 (layout), Phase 3 (tools)
- Không thay đổi logic business
- Không dùng backdrop-filter, blur, glass
- Không hardcode màu ngoài ADN_DESIGN_SYSTEM.md token
- Deploy từng trang, verify rồi mới tiếp
- Phase 4 là phase cuối — sau khi xong chạy final audit (mục 9)
