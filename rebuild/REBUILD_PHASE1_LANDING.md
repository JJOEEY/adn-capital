# REBUILD_PHASE1_LANDING.md — Landing Page

> Antigravity đọc file này để rebuild trang chủ `src/app/page.tsx` (và các section components).
> Style tham khảo: prospect-finance-saas-webflow-template.webflow.io
> Đọc `ADN_DESIGN_SYSTEM.md` trước để lấy đúng token màu và font.
> KHÔNG dùng backdrop-filter, blur, liquid-glass. Tất cả solid màu đặc.

---

## 1. LAYOUT TỔNG THỂ

```
Header (sticky, 64px)
│
├── Section 1: Hero
├── Section 2: Social proof (ticker tape)
├── Section 3: Stats
├── Section 4: Sản phẩm & tính năng
├── Section 5: Track record / Hiệu suất
├── Section 6: Quy trình 3 bước
├── Section 7: Testimonials
├── Section 8: Pricing
├── Section 9: FAQ
├── Section 10: CTA cuối
│
Footer
```

---

## 2. HEADER (sticky)

```
height: 64px
padding: 0 48px (desktop) | 0 20px (mobile)
border-bottom: 1px solid

Light: bg #FFFFFF, border #E8E4DB
Dark:  bg #0D1410, border rgba(235,226,207,0.10)

Layout: Logo ←→ Nav links (center) ←→ [Đăng nhập] [Mở TK] buttons
```

**Logo:**
```
Light: text #1C2B22, font Manrope 700
Dark:  text #EBE2CF
Kèm icon logo ADN bên trái
```

**Nav links:** Trang Chủ · Sản phẩm · Bảng giá · Về chúng tôi
```
Light: #7D8471, hover #2E4D3D
Dark:  #9aab9e, hover #EBE2CF
font: 500 14px Manrope
```

**Buttons:**
```
Đăng nhập: Ghost button
  Light: color #2E4D3D, hover bg rgba(46,77,61,0.08)
  Dark:  color #EBE2CF, hover bg rgba(235,226,207,0.06)

Mở TK: Primary button
  Light: bg #2E4D3D, color white
  Dark:  bg #173627, color #EBE2CF
  border-radius: 10px, padding: 8px 20px
```

**Dark/Light toggle:** icon sun/moon, 36px circle, góc phải header

---

## 3. HERO SECTION

```
padding: 120px 48px 100px (desktop) | 80px 20px (mobile)
text-align: center
max-width: 820px, margin: 0 auto

Light: bg #F8F7F2
Dark:  bg #0D1410
```

**Label trên headline:**
```
display: inline-flex, align-items: center, gap: 8px
border-radius: 99px
padding: 6px 16px
font: 500 13px Manrope, uppercase, letter-spacing 0.08em

Light: bg rgba(46,77,61,0.08), color #2E4D3D, border 1px solid rgba(46,77,61,0.15)
Dark:  bg rgba(23,54,39,0.40), color #9aab9e, border 1px solid rgba(235,226,207,0.12)

Nội dung: "· ADN CAPITAL · QUANT TRADING SYSTEM"
```

**Headline:**
```
font: 700 64px/1.1 Manrope (desktop) | 700 40px/1.2 (mobile)
Light: color #1C2B22
Dark:  color #EBE2CF

Line 1: "ĐẦU TƯ CÙNG"        → màu text thường
Line 2: "HỆ THỐNG ADN"       → màu Primary (#2E4D3D light / #9aab9e dark)
```

**Sub-headline:**
```
font: 400 18px/1.7 Manrope
max-width: 560px, margin: 20px auto
Light: color #7D8471
Dark:  color #9aab9e

Text: "Hệ thống giao dịch thuật toán kết hợp AI — Tự động quét tín hiệu, quản trị rủi ro và bảo vệ danh mục 24/7."
```

**CTA buttons (2 nút, căn giữa, gap 12px):**
```
Nút 1 - Primary: "Mở Tài Khoản Ngay ↗"
  Light: bg #2E4D3D, color white, border-radius 10px, padding 14px 28px, font 600 15px
  Dark:  bg #173627, color #EBE2CF

Nút 2 - Outlined: "Xem Lịch Sử Lợi Nhuận ›"
  Light: border 1.5px solid #D6CDBB, color #1C2B22
  Dark:  border 1.5px solid rgba(235,226,207,0.25), color #EBE2CF
```

**Hero image/mockup:**
```
Bên dưới CTA, margin-top: 60px
Border-radius: 16px
border: 1px solid (Light: #E8E4DB | Dark: rgba(235,226,207,0.10))
box-shadow: 0 24px 48px rgba(0,0,0,0.08) — Light only
overflow: hidden
Hiển thị screenshot Dashboard thật của ADN Capital
```

---

## 4. SOCIAL PROOF — TICKER TAPE

```
padding: 24px 0
border-top & border-bottom: 1px solid

Light: bg #F3F1EB, border #E8E4DB
Dark:  bg #111a14, border rgba(235,226,207,0.10)

Nội dung: logo/tên các đối tác, cuộn marquee liên tục
Dùng class .animate-marquee có sẵn
```

---

## 5. STATS SECTION

```
padding: 80px 48px
display: grid, grid-template-columns: repeat(3, 1fr), gap: 1px

Light: bg #F8F7F2
Dark:  bg #0D1410

Mỗi stat item:
  padding: 40px
  border: 1px solid (Light: #E8E4DB | Dark: rgba(235,226,207,0.10))
  border-radius: 14px

  Number: font 700 48px Manrope
    Light: #2E4D3D | Dark: #EBE2CF

  Label: font 400 15px Manrope
    Light: #7D8471 | Dark: #9aab9e
```

**3 stats:**
- `210+` — Tín hiệu đã xác nhận thành công
- `5K+` — Lượt truy cập & sử dụng hệ thống
- `97%` — Tỷ lệ hài lòng từ khách hàng

---

## 6. SẢN PHẨM & TÍNH NĂNG

```
padding: 100px 48px
```

**Section label:**
```
font: 500 12px Manrope, uppercase, letter-spacing 0.1em
Light: color #7D8471 | Dark: color #9aab9e
margin-bottom: 16px
Text: "Platform"
```

**Headline:**
```
font: 700 40px/1.2 Manrope
Light: #1C2B22 | Dark: #EBE2CF
Text: "Sản phẩm & Dịch vụ"
```

**Sub:**
```
font: 400 17px Manrope
Light: #7D8471 | Dark: #9aab9e
max-width: 520px
```

**Feature cards (grid 2x2):**
```
display: grid, grid-template-columns: 1fr 1fr, gap: 16px (desktop)
grid-template-columns: 1fr (mobile)

Mỗi card:
  padding: 32px
  border-radius: 14px
  border: 1px solid
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s

  Light: bg #FFFFFF, border #E8E4DB
         hover: border #D6CDBB, shadow 0 4px 16px rgba(46,77,61,0.08), translateY(-2px)

  Dark:  bg #111a14, border rgba(235,226,207,0.10)
         hover: border rgba(235,226,207,0.20)

  Icon: 40px circle, border-radius 10px
  Badge (MỚI/HOT/BETA): border-radius 99px, font 500 11px uppercase
    MỚI:  Light bg rgba(46,77,61,0.10) color #2E4D3D | Dark bg rgba(23,54,39,0.40) color #9aab9e
    HOT:  Light bg rgba(192,57,43,0.10) color #C0392B | Dark bg rgba(192,97,74,0.20) color #c0614a
    BETA: Light bg rgba(125,132,113,0.10) color #7D8471 | Dark similar

  Title: font 600 18px Manrope
  Desc:  font 400 15px, line-height 1.6
```

**4 sản phẩm:**
1. **Chỉ báo ART** `MỚI` — Analytical Reversal Tracker — chỉ báo điểm đảo chiều thị trường
2. **Tư vấn đầu tư** — AI phân tích kỹ thuật, cơ bản, tâm lý theo yêu cầu
3. **ADN AI Broker** — Tự động quét tín hiệu, cảnh báo Mua/Bán realtime
4. **Ký Quỹ Margin** `HOT` — Lãi suất từ 5.99%/năm, tư vấn miễn phí

---

## 7. TRACK RECORD / HIỆU SUẤT

```
padding: 100px 48px
```

**Layout:** 2 cột — trái text, phải metrics cards

**Metrics cards (stacked):**
```
Mỗi card:
  padding: 24px 32px
  border-radius: 14px
  border: 1px solid

  Light: bg #FFFFFF, border #E8E4DB
  Dark:  bg #111a14, border rgba(235,226,207,0.10)

  Label: 12px uppercase letter-spacing
  Value: 700 36px Primary color
  Sub:   15px text-secondary
```

**3 metrics:** Lợi Nhuận Tích Lũy · Nhân Vốn · Win Rate

---

## 8. QUY TRÌNH 3 BƯỚC

```
padding: 100px 48px
text-align: center
```

**3 bước, layout horizontal:**
```
display: flex, gap: 48px, justify-content: center

Mỗi bước:
  flex: 1, max-width: 280px

  Step number: font 700 48px
    Light: rgba(46,77,61,0.12) | Dark: rgba(235,226,207,0.08)

  Title: font 600 18px
  Desc:  font 400 15px, text-secondary

  Connector line giữa các bước:
    Light: #E8E4DB | Dark: rgba(235,226,207,0.10)
```

---

## 9. TESTIMONIALS

```
padding: 100px 48px
```

**3 cards testimonial:**
```
display: grid, grid-template-columns: repeat(3, 1fr), gap: 16px

Mỗi card:
  padding: 28px 32px
  border-radius: 14px
  border: 1px solid

  Light: bg #FFFFFF, border #E8E4DB
  Dark:  bg #111a14, border rgba(235,226,207,0.10)

  Quote: font 400 16px italic, line-height 1.7
  Avatar: 40px circle
  Name:   font 600 14px
  Role:   font 400 13px text-secondary
```

---

## 10. PRICING SECTION

Giữ nguyên nội dung hiện tại, chỉ rebuild visual theo design tokens:

```
padding: 100px 48px

Pricing cards:
  border-radius: 14px
  border: 1px solid

  Light: bg #FFFFFF, border #E8E4DB
         hover: border #D6CDBB, shadow 0 4px 16px rgba(46,77,61,0.08), translateY(-2px)
  Dark:  bg #111a14, border rgba(235,226,207,0.10)
         hover: border rgba(235,226,207,0.20), translateY(-2px)

  "Bán chạy nhất" card:
    Light: border #2E4D3D, bg rgba(46,77,61,0.04)
    Dark:  border rgba(235,226,207,0.25), bg rgba(23,54,39,0.20)

  Price: font 700 40px Primary color
  Feature list: checkmark icon màu Primary
```

---

## 11. FAQ

```
padding: 80px 48px
max-width: 720px, margin: 0 auto

Accordion item:
  border-bottom: 1px solid (Light: #E8E4DB | Dark: rgba(235,226,207,0.10))
  padding: 20px 0

  Question: font 600 16px Manrope
  Answer:   font 400 15px text-secondary, line-height 1.7
  Icon:     + / - toggle, màu Primary
```

---

## 12. CTA CUỐI

```
padding: 100px 48px
text-align: center
border-radius: 20px
margin: 0 48px 80px

Light: bg #2E4D3D, color white
Dark:  bg #173627

Headline: font 700 40px #FFFFFF (cả 2 theme)
Sub:      font 400 17px rgba(255,255,255,0.7)
Button Light: bg white, color #2E4D3D
  Button Dark:  bg white, color #173627
```

---

## 13. FOOTER

```
padding: 60px 48px 40px
border-top: 1px solid (Light: #E8E4DB | Dark: rgba(235,226,207,0.10))

Light: bg #FFFFFF
Dark:  bg #0D1410

Layout: 4 columns — Logo+tagline | Pages | More pages | Social

Copyright: font 400 13px text-muted
Disclaimer: font 400 12px text-muted, max-width 600px
```

---

## 14. RESPONSIVE

```
Desktop: > 1024px — full layout
Tablet:  768-1024px — stack 2 col → 1 col
Mobile:  < 768px — single column, padding 20px
Header mobile: hamburger menu
```

---

## 15. DARK/LIGHT TOGGLE

```
Vị trí: góc phải header
Component: toggle switch hoặc icon button sun/moon
onClick: thêm/xóa class 'dark' trên <html> element
Lưu preference vào localStorage key 'theme'
Default: 'dark'
```

---

## 16. KHÔNG LÀM

- Không dùng backdrop-filter, blur, glass effect
- Không hardcode màu ngoài ADN_DESIGN_SYSTEM.md
- Không thay đổi nội dung text — chỉ rebuild visual
- Không đụng vào các trang khác (dashboard, tools) — chỉ landing page
- Deploy sau khi xong landing page, verify trước khi làm Phase 2
