# ADN_DESIGN_SYSTEM.md — ADN Capital

> Nguồn sự thật duy nhất về UI/UX. Antigravity đọc file này TRƯỚC KHI đụng vào bất kỳ file giao diện nào.
> File này bao gồm: Design tokens, Theme rules, Component specs, Investment Chat UI.

---

## 1. NGUYÊN TẮC

- **2 theme:** `.light` và `.dark` — toggle bằng class trên `<html>` (dùng `document.documentElement`)
- **Font duy nhất:** Manrope 400/500/600/700, subset `['latin', 'vietnamese']`
- **CẤM TUYỆT ĐỐI** dùng `backdrop-filter`, `blur`, `bg-opacity`, `liquid-glass`, `liquid-glass-subtle`. Mọi background phải là màu Solid (màu đặc) 100%.
- **Chỉ thay đổi theo theme:** màu nền, màu chữ, màu border, màu surface
- **Không hardcode** màu hex nào ngoài bảng token dưới đây

---

## 2. COLOR TOKENS

### Light (`.light`)

| Token | Hex |
|---|---|
| Primary | `#2E4D3D` |
| Primary hover | `#243d30` |
| Primary light | `rgba(46,77,61,0.08)` |
| Secondary | `#D6CDBB` |
| Tertiary | `#7D8471` |
| BG page | `#F8F7F2` |
| BG surface | `#FFFFFF` |
| BG hover | `#F3F1EB` |
| Text primary | `#1C2B22` |
| Text secondary | `#7D8471` |
| Text muted | `#B0ADA4` |
| Border | `#E8E4DB` |
| Border strong | `#D6CDBB` |
| Success | `#16a34a` | Tăng, tích cực, xác nhận |
| Warning | `#f59e0b` | Cảnh báo, thăm dò, trung tính |
| Danger | `#C0392B` |
| Accent-FA | `#5B8C5A` | Icon card Phân tích cơ bản |
| Accent-News | `#A0845C` | Icon card Tin tức & sự kiện |

### Dark (`.dark`)

| Token | Hex |
|---|---|
| Primary | `#173627` |
| Primary hover | `#1f4a34` |
| Primary light | `rgba(23,54,39,0.40)` |
| Secondary | `#EBE2CF` |
| Tertiary | `#492628` |
| BG page | `#0D1410` |
| BG surface | `#111a14` |
| BG surface-2 | `#162019` |
| BG hover | `#1a2a1d` |
| Text primary | `#EBE2CF` |
| Text secondary | `#9aab9e` |
| Text muted | `#5a6b5e` |
| Border | `rgba(235,226,207,0.10)` |
| Border strong | `rgba(235,226,207,0.18)` |
| Success | `#16a34a` | Tăng, tích cực, xác nhận |
| Warning | `#f59e0b` | Cảnh báo, thăm dò, trung tính |
| Danger | `#c0614a` |
| Accent-FA | `#7ab87a` | Icon card Phân tích cơ bản |
| Accent-News | `#EBE2CF` | Icon card Tin tức & sự kiện |

---

## 3. TYPOGRAPHY

| Role | Size | Weight | Line-height |
|---|---|---|---|
| Headline | 24px | 700 | 1.3 |
| Title | 18px | 600 | 1.4 |
| Body | 15px | 400 | 1.6 |
| Label | 13px | 500 | 1.4 |
| Caption | 12px | 400 | 1.5 |
| Nav item | 14px | 500 | — |
| Section label | 11px | 500 | — (uppercase, letter-spacing 0.08em) |

---

## 4. LAYOUT TOÀN TRANG

```
┌──────────────────────────────────────────────┐
│  Sidebar 240px  │  Main Content (flex: 1)     │
│  bg: surface    │  bg: page                   │
│  border-right   │                             │
└──────────────────────────────────────────────┘
```

---

## 5. SIDEBAR

```
Light: bg #FFFFFF, border-right 1px solid #E8E4DB
Dark:  bg #111a14, border-right 1px solid rgba(235,226,207,0.10)
width: 240px | padding: 24px 16px
```

**Section label:**
```
font: 500 11px Manrope | uppercase | letter-spacing 0.08em
Light: #B0ADA4 | Dark: #5a6b5e
```

**Nav item:**
```
padding: 10px 12px | border-radius: 10px | font: 500 14px Manrope

Light normal:  #7D8471
Light hover:   bg #F3F1EB, color #2E4D3D
Light active:  bg rgba(46,77,61,0.10), color #2E4D3D, weight 600

Dark normal:   #9aab9e
Dark hover:    bg #1a2a1d, color #EBE2CF
Dark active:   bg rgba(23,54,39,0.50), color #EBE2CF, weight 600
```

**Premium badge:**
```
Light: bg #2E4D3D, color #F8F7F2
Dark:  bg #173627, color #EBE2CF
border-radius: 12px | padding: 16px
```

**User info:**
```
Avatar: 36px circle
Light: bg #2E4D3D, text white
Dark:  bg #173627, text #EBE2CF
Name: 14px 600 | Role: 12px (text-secondary)
```

---

## 6. HEADER

```
height: 60px | padding: 0 24px
Light: bg #FFFFFF, border-bottom 1px solid #E8E4DB
Dark:  bg #111a14, border-bottom 1px solid rgba(235,226,207,0.10)

Title: 700 20px | Light: #1C2B22 | Dark: #EBE2CF
Subtitle: 400 13px | Light: #7D8471 | Dark: #9aab9e

Tab active:
  Light: color #2E4D3D, border-bottom 2px solid #2E4D3D, weight 600
  Dark:  color #EBE2CF, border-bottom 2px solid #EBE2CF, weight 600

Tab inactive:
  Light: #7D8471 | Dark: #9aab9e

Icon button (36px circle):
  Light hover: bg #F3F1EB, color #2E4D3D
  Dark hover:  bg #1a2a1d, color #EBE2CF
```

---

## 7. COMPONENTS

### Button
```
Primary:
  Light: bg #2E4D3D, color #FFFFFF, hover #243d30
  Dark:  bg #173627, color #EBE2CF, hover #1f4a34
  border-radius: 10px | padding: 10px 20px | font: 600 14px

Outlined:
  Light: border 1.5px solid #D6CDBB, color #1C2B22
         hover: border #2E4D3D, color #2E4D3D
  Dark:  border 1.5px solid rgba(235,226,207,0.25), color #EBE2CF
         hover: border #EBE2CF, color #EBE2CF
  border-radius: 10px

Ghost:
  Light: color #2E4D3D, hover bg rgba(46,77,61,0.08)
  Dark:  color #EBE2CF, hover bg rgba(235,226,207,0.06)

Danger:
  Light: bg #C0392B | Dark: bg #c0614a | color: white
```

### Card
```
border-radius: 14px | padding: 20px
transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s

Light: bg #FFFFFF, border 1px solid #E8E4DB
       hover: border #D6CDBB, shadow 0 4px 16px -4px rgba(46,77,61,0.10)

Dark:  bg #111a14, border 1px solid rgba(235,226,207,0.10)
       hover: border rgba(235,226,207,0.20), shadow 0 4px 20px -6px rgba(0,0,0,0.40)
```

### Input
```
border-radius: 10px | height: 40px | padding: 0 14px | font: 400 14px

Light: bg #FFFFFF, border 1px solid #E8E4DB, color #1C2B22
       placeholder #B0ADA4
       focus: border #2E4D3D, shadow 0 0 0 3px rgba(46,77,61,0.08)

Dark:  bg #111a14, border 1px solid rgba(235,226,207,0.12), color #EBE2CF
       placeholder #5a6b5e
       focus: border rgba(235,226,207,0.35), shadow 0 0 0 3px rgba(235,226,207,0.06)
```

### Badge / Tag
```
border-radius: 99px | padding: 3px 10px | font: 500 12px
Light: bg rgba(46,77,61,0.08), color #2E4D3D
Dark:  bg rgba(235,226,207,0.08), color #EBE2CF
```

### Icon button (toolbar)
```
36px circle | transition: background 0.15s

Light: normal #7D8471, hover bg #F3F1EB + color #2E4D3D, active bg #2E4D3D + color white
Dark:  normal #9aab9e, hover bg #1a2a1d + color #EBE2CF, active bg #173627 + color #EBE2CF
```

### Divider
```
height: 1px
Light: #E8E4DB | Dark: rgba(235,226,207,0.10)
```

---

## 8. LANDING PAGE

### Hero section
```
Light: bg #F8F7F2 (hoặc bg-city-light)
Dark:  bg #0D1410 (hoặc bg-city-dark)

Headline: 700 48px Manrope
  Light: #1C2B22 | Dark: #EBE2CF

Sub: 400 18px, line-height 1.7
  Light: #7D8471 | Dark: #9aab9e
```

### Feature cards
Dùng spec Card ở mục 7 — giữ class `glow-card`.

### Stats / Metric
```
Number: 700 36px
  Light: #2E4D3D | Dark: #EBE2CF
Label: 400 14px
  Light: #7D8471 | Dark: #9aab9e
```

### Quote / Testimonial
```
Light: border-left 3px solid #2E4D3D, bg rgba(46,77,61,0.04), color #1C2B22
Dark:  border-left 3px solid rgba(235,226,207,0.30), bg rgba(235,226,207,0.04), color #EBE2CF
```

---

## 9. INVESTMENT CHAT — CHATBOT + 4 CARD

### Hành vi

**Chế độ 1 — User gõ mã cổ phiếu:**
Nhận diện 2-5 ký tự HOA (hoặc khớp WATCHLIST_200 từ `scanner.py`) → hiện 4 card 2x2. User bấm card → gọi endpoint tương ứng → render kết quả vào chat.

**Chế độ 2 — User hỏi tự do:**
Chatbot bình thường, không hiện card.

### Nhận diện ticker
```typescript
function isTicker(text: string): string | null {
  const t = text.trim().toUpperCase()
  if (WATCHLIST.has(t)) return t
  if (/^[A-Z]{2,5}$/.test(t)) return t
  return null
}

function handleSubmit(input: string) {
  const ticker = isTicker(input)
  if (ticker) {
    addUserMessage(ticker)
    showTickerCards(ticker)
  } else {
    addUserMessage(input)
    callChatbot(input)
  }
}
```

### Cấu trúc component
```
File: src/components/InvestmentChat.tsx

InvestmentChat
├── ChatMessages
│   ├── UserBubble
│   ├── BotBubble
│   │   └── TickerCards (chỉ render khi nhận ticker)
│   │       ├── CardTA
│   │       ├── CardFA
│   │       ├── CardTamly
│   │       └── CardNews
│   └── TypingIndicator
└── ChatInput (input + send button)
```

### Chat shell
```
border-radius: 16px
Light: bg #F8F7F2
Dark:  bg #0D1410
```

### User bubble
```
border-radius: 16px 16px 4px 16px
Light: bg #2E4D3D, color #FFFFFF
Dark:  bg #173627, color #EBE2CF
```

### Bot bubble
```
border-radius: 4px 16px 16px 16px
Light: bg #FFFFFF, border 1px solid #E8E4DB, color #1C2B22
Dark:  bg #111a14, border 1px solid rgba(235,226,207,0.10), color #EBE2CF
```

### Bot avatar
```
32px circle
Light: bg rgba(46,77,61,0.10), border 1px solid #E8E4DB, icon #2E4D3D
Dark:  bg rgba(23,54,39,0.40), border 1px solid rgba(235,226,207,0.12), icon #9aab9e
```

### 4 Card (ticker mode)
```
border-radius: 12px | padding: 12px
grid: 2x2, gap: 8px

Light: bg #FFFFFF, border 1px solid #E8E4DB
       hover: border #2E4D3D, shadow 0 4px 12px -4px rgba(46,77,61,0.12), translateY(-1px)

Dark:  bg #111a14, border 1px solid rgba(235,226,207,0.10)
       hover: border rgba(235,226,207,0.25), shadow 0 4px 16px -4px rgba(0,0,0,0.35), translateY(-1px)
```

**Icon màu 4 card:**

| Card | Endpoint | Light icon | Light icon-bg | Dark icon | Dark icon-bg |
|---|---|---|---|---|---|
| Phân tích kỹ thuật | `GET /api/v1/ai/ta/{ticker}` | `#2E4D3D` | `rgba(46,77,61,0.10)` | `#9aab9e` | `rgba(23,54,39,0.40)` |
| Phân tích cơ bản | `GET /api/v1/ai/fa/{ticker}` | `#5B8C5A` | `rgba(91,140,90,0.10)` | `#7ab87a` | `rgba(91,140,90,0.20)` |
| Tâm lý & hành vi | `GET /api/v1/ai/tamly/{ticker}` | `#7D8471` | `rgba(125,132,113,0.10)` | `#9aab9e` | `rgba(125,132,113,0.15)` |
| Tin tức & sự kiện | `GET /api/v1/ai/news/{ticker}` (tin riêng mã) | `#A0845C` | `rgba(160,132,92,0.10)` | `#EBE2CF` | `rgba(73,38,40,0.35)` |

> Tin tức: tự động chọn `morning` trước 15h, `eod` từ 15h trở đi.

### Input + Send button
```
Input:
  border-radius: 99px | height: 40px
  Light: bg #FFFFFF, border 1px solid #E8E4DB
  Dark:  bg #111a14, border 1px solid rgba(235,226,207,0.12)

Send button: 40px circle
  Light: bg #2E4D3D, hover #243d30
  Dark:  bg #173627, hover #1f4a34
```

### Typing indicator
```
Dùng class .typing-dot có sẵn trong globals.css
Light: color #2E4D3D (override trong globals.css)
Dark:  color #10b981 (giữ nguyên)
```

### Khi user bấm card
```typescript
async function handleCardClick(cardId: string, ticker: string) {
  setLoading(true)
  const BRIDGE = process.env.NEXT_PUBLIC_BRIDGE_URL
  const map: Record<string, string> = {
    ta:    `${BRIDGE}/api/v1/ai/ta/${ticker}`,
    fa:    `${BRIDGE}/api/v1/ai/fa/${ticker}`,
    tamly: `${BRIDGE}/api/v1/ai/tamly/${ticker}`,
    news:  `${BRIDGE}/api/v1/ai/news/${ticker}`,  // tin tức riêng của mã, không phải bản tin thị trường
  }
  try {
    const res  = await fetch(map[cardId])
    const data = await res.json()
    appendBotMessage(renderResponse(cardId, ticker, data))
  } catch {
    appendBotMessage('Không thể tải dữ liệu, vui lòng thử lại.')
  } finally {
    setLoading(false)
  }
}
```

### Render response
```typescript
function renderResponse(cardId: string, ticker: string, data: any): string {
  switch (cardId) {
    case 'ta':
      // Hiển thị signal + analysis + <img> nếu media_url có giá trị
      return `**${ticker}** — ${data.signal}\n\n${data.analysis}`
    case 'fa':
      return `**Phân tích cơ bản ${ticker}**\n\n${data.analysis}`
    case 'tamly':
      return `**Tâm lý thị trường ${ticker}**\n\n${data.analysis}`
    case 'news':
      return data.session_summary ?? (data.vn_market ?? []).join('\n')
  }
}
// Nếu data.media_url có → render <img src={data.media_url} />
// Nếu null → ẩn hẳn, không render broken image
// QUAN TRỌNG: data.analysis là Markdown string từ Gemini
// Phải dùng react-markdown để render — KHÔNG dùng dangerouslySetInnerHTML hoặc plain string
// Cài: npm install react-markdown
// Dùng: import ReactMarkdown from 'react-markdown'
//        <ReactMarkdown>{data.analysis}</ReactMarkdown>
// Nếu không có react-markdown, **in đậm** và *in nghiêng* sẽ hiện thô trên màn hình
```

### Animation trong chat
```
Message xuất hiện:  animate-fade-in
Card xuất hiện:     animate-slide-up
Card hover:         glow-card:hover (tự động từ globals.css)
```

---

## 10. SCROLLBAR

```css
Light: thumb #D6CDBB, hover #7D8471, track transparent
Dark:  thumb rgba(255,255,255,0.10), hover rgba(255,255,255,0.20), track rgba(255,255,255,0.02)
width: 4px
```

---

## 11. SELECTION

```css
Light: background rgba(46,77,61,0.15), color #1C2B22
Dark:  background rgba(16,185,129,0.25), color #fff
```

---

## 12. EFFECTS — MODERN MINIMAL

### Shadow (Đổ bóng) — Solid & Flat, KHÔNG blur

```
Light mode:
  Card shadow:   box-shadow: 0 2px 8px rgba(0,0,0,0.04)
  Card hover:    box-shadow: 0 4px 12px rgba(46,77,61,0.08)
  Input focus:   box-shadow: 0 0 0 3px rgba(46,77,61,0.08)

Dark mode:
  Card shadow:   border: 1px solid rgba(235,226,207,0.10)  ← dùng border thay shadow
  Card hover:    border-color: rgba(235,226,207,0.20)
  Input focus:   box-shadow: 0 0 0 3px rgba(235,226,207,0.06)
```

### Classes bị XÓA — KHÔNG được dùng

```
❌ .liquid-glass          (xóa khỏi globals.css)
❌ .liquid-glass-subtle   (xóa khỏi globals.css)
❌ backdrop-filter        (cấm tuyệt đối)
❌ backdrop-blur-*        (cấm tuyệt đối)
❌ bg-opacity-*           (dùng màu hex đặc thay thế)
❌ bg-white/10            (dùng rgba solid thay thế)
```

### Classes được giữ — Animation thuần

```
✅ .glow-card             hover transform translateY(-2px) + border-color thôi
✅ .animate-fade-in
✅ .animate-slide-up
✅ .animate-slide-in-right
✅ .animate-float
✅ .animate-float-delayed
✅ .animate-marquee
✅ .hexagon               clip-path
✅ .animate-pulse-glow    giữ keyframe nhưng chỉ box-shadow màu đặc
```

---

## 13. TIPTAP EDITOR

```
Light: h2/h3 #1C2B22, blockquote border rgba(46,77,61,0.4) + color #7D8471
       hr #E8E4DB, link #2E4D3D, strong #1C2B22, placeholder #B0ADA4

Dark:  h2/h3 #e2e8f0, blockquote border rgba(34,211,238,0.4) + color #94a3b8
       hr rgba(255,255,255,0.1), link #22d3ee, strong #f1f5f9, placeholder #475569
```

---

## 14. KHÔNG LÀM

- Không dùng màu hex nào ngoài bảng token mục 2
- Không hardcode `#10b981` trong light mode — dùng `#2E4D3D`
- Không dùng `backdrop-filter`/`blur` trong light mode — dùng solid bg
- Không dump raw JSON cho user trong chat — phải render có cấu trúc
- Không để `media_url: null` render thành broken image
- Không gọi FiinQuantX trực tiếp từ Frontend — tất cả qua Bridge
- Không tự bịa endpoint — xem AGENTS.md mục 4 để lấy đúng endpoint
- Không dùng `prefers-color-scheme` — dùng class `.dark` / `.light`
