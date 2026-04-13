# UI/UX — Investment Chat (Tư vấn đầu tư)

> File này chỉ dành cho việc build UI/UX.
> Logic backend, endpoint, AI đã có trong CHATBOT AI.md.

---

## 1. TỔNG QUAN HÀNH VI

Trang tư vấn đầu tư có **2 chế độ tự động chuyển đổi**:

| Input của user | Hành vi |
|---|---|
| Mã cổ phiếu (VD: `HPG`, `VCB`) | Hiện 4 card 2x2 bên dưới bot bubble |
| Câu hỏi tự do | Chatbot bình thường, không hiện card |

---

## 2. NHẬN DIỆN MÃ CỔ PHIẾU

```typescript
// Nhận diện ticker hay câu hỏi tự do
function isTicker(text: string): string | null {
  const t = text.trim().toUpperCase()
  if (WATCHLIST.has(t)) return t        // khớp danh sách cứng từ scanner.py
  if (/^[A-Z]{2,5}$/.test(t)) return t  // pattern fallback
  return null
}

function handleSubmit(input: string) {
  const ticker = isTicker(input)
  if (ticker) {
    addUserMessage(ticker)
    showTickerCards(ticker)   // → hiện 4 card
  } else {
    addUserMessage(input)
    callChatbot(input)        // → chatbot bình thường
  }
}
```

---

## 3. CẤU TRÚC COMPONENT

File: `src/components/InvestmentChat.tsx`

```
InvestmentChat
├── ChatMessages
│   ├── UserBubble           ← phải
│   ├── BotBubble            ← trái
│   │   └── TickerCards      ← chỉ render khi nhận ticker
│   │       ├── CardTA
│   │       ├── CardFA
│   │       ├── CardTamly
│   │       └── CardNews
│   └── TypingIndicator      ← 3 chấm nhấp nháy khi chờ response
└── ChatInput                ← input + send button
```

---

## 4. MÀUSẮC & DESIGN TOKENS

Tất cả lấy từ `globals.css` có sẵn trong project. **Không hardcode màu nào khác.**

| Thành phần | Class / Giá trị |
|---|---|
| Shell wrapper | `liquid-glass` |
| Bot bubble | `liquid-glass-subtle` |
| Card | `liquid-glass-subtle glow-card` |
| User bubble bg | `#10b981` |
| User bubble text | `white` |
| Bot avatar bg | `rgba(16,185,129,0.15)` |
| Bot avatar icon | `#10b981` |
| Send button bg | `#10b981` |
| Send button hover | `rgba(16,185,129,0.85)` |
| Typing dot | class `.typing-dot` (có sẵn) |
| Card hover glow | tự động từ `.glow-card:hover` (amber) |
| Input | `liquid-glass-subtle` |

**Màu icon 4 card:**
| Card | Màu |
|---|---|
| Phân tích kỹ thuật | `#10b981` emerald |
| Phân tích cơ bản | `#22d3ee` cyan |
| Tâm lý & hành vi | `#a78bfa` purple |
| Tin tức & sự kiện | `#f59e0b` amber |

**Dark/light mode:** dùng class `.dark` / `.light` trên parent — KHÔNG dùng `prefers-color-scheme`.

---

## 5. LAYOUT & SPACING

```
Shell
  border-radius: 16px
  padding: 16px
  display: flex
  flex-direction: column
  gap: 12px
  min-height: 540px

ChatMessages
  flex: 1
  display: flex
  flex-direction: column
  gap: 12px
  overflow-y: auto

UserBubble
  align-self: flex-end
  max-width: 72%
  padding: 10px 14px
  border-radius: 16px 16px 4px 16px
  font-size: 14px
  line-height: 1.5

BotBubble wrapper
  display: flex
  gap: 10px
  align-items: flex-start

BotBubble
  max-width: 80%
  padding: 10px 14px
  border-radius: 4px 16px 16px 16px
  font-size: 14px
  line-height: 1.5

BotAvatar
  width: 32px
  height: 32px
  border-radius: 50%
  flex-shrink: 0
  border: 1px solid rgba(255,255,255,0.12)

TickerCards grid
  display: grid
  grid-template-columns: 1fr 1fr
  gap: 8px
  margin-top: 8px

Card
  padding: 12px
  border-radius: 12px
  cursor: pointer
  display: flex
  flex-direction: column
  gap: 6px

CardIcon
  width: 32px
  height: 32px
  border-radius: 8px
  display: flex
  align-items: center
  justify-content: center

ChatInput row
  display: flex
  gap: 8px
  align-items: center

Input
  flex: 1
  height: 40px
  border-radius: 99px
  padding: 0 14px
  font-size: 14px

SendButton
  width: 40px
  height: 40px
  border-radius: 50%
  border: none
  flex-shrink: 0
```

---

## 6. 4 CARD — NỘI DUNG

| # | Title | Sub-text | Icon | Màu icon |
|---|---|---|---|---|
| 1 | Phân tích kỹ thuật | Chart, RSI, MACD, hỗ trợ/kháng cự | Chart line | `#10b981` |
| 2 | Phân tích cơ bản | P/E, P/B, ROE, tăng trưởng lợi nhuận | Screen/monitor | `#22d3ee` |
| 3 | Tâm lý & hành vi | Mua/bán chủ động, khối ngoại, dòng tiền | Heart | `#a78bfa` |
| 4 | Tin tức & sự kiện | Tổng hợp tin, sự kiện doanh nghiệp | Document | `#f59e0b` |

---

## 7. KHI USER BẤM CARD

```typescript
async function handleCardClick(cardId: string, ticker: string) {
  setLoading(true)
  const BRIDGE = process.env.NEXT_PUBLIC_BRIDGE_URL

  const map: Record<string, string> = {
    ta:    `${BRIDGE}/api/v1/ai/ta/${ticker}`,
    fa:    `${BRIDGE}/api/v1/ai/fa/${ticker}`,
    tamly: `${BRIDGE}/api/v1/ai/tamly/${ticker}`,
    news:  `${BRIDGE}/api/v1/news/${new Date().getHours() >= 15 ? 'eod' : 'morning'}`,
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

---

## 8. RENDER RESPONSE THÀNH TEXT

Không dump raw JSON. Phải render có cấu trúc:

```typescript
function renderResponse(cardId: string, ticker: string, data: any): string {
  switch (cardId) {
    case 'ta':
      // Hiển thị signal badge + analysis + ảnh chart nếu có media_url
      return `**${ticker}** — ${data.signal}\n\n${data.analysis}`

    case 'fa':
      return `**Phân tích cơ bản ${ticker}**\n\n${data.analysis}`

    case 'tamly':
      return `**Tâm lý thị trường ${ticker}**\n\n${data.analysis}`

    case 'news':
      // Ưu tiên session_summary (EOD) hoặc vn_market bullets (morning)
      if (data.session_summary) return data.session_summary
      return (data.vn_market ?? []).join('\n')
  }
}
```

**Ảnh chart (chỉ lõi TA):**
- Nếu `data.media_url` có giá trị → render `<img src={data.media_url} />` bên dưới text
- Nếu `data.media_url` là `null` → ẩn hẳn, không render broken image

---

## 9. ANIMATION

Tất cả dùng class animation có sẵn trong `tailwind.config.ts`:

| Trạng thái | Class |
|---|---|
| Message xuất hiện | `animate-fade-in` |
| Card xuất hiện | `animate-slide-up` |
| Typing indicator | `.typing-dot` + `:nth-child(2/3)` delay |
| Card hover | `.glow-card:hover` (amber glow tự động) |

---

## 10. KHÔNG LÀM

- Không tự bịa endpoint mới — tất cả endpoint đã có trong AGENTS.md mục 4
- Không gọi FiinQuantX trực tiếp từ Frontend — tất cả qua Bridge
- Không render raw JSON cho user
- Không để broken image khi `media_url` null
- Không dùng màu hex nào ngoài bảng ở mục 4
- Không dùng `prefers-color-scheme` — dùng class `.dark` / `.light`
- Không dùng `any` TypeScript nếu tránh được
