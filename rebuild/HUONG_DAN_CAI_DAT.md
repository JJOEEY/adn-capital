# HƯỚNG DẪN CÀI ĐẶT — ADN Capital Design System

## Bạn nhận được 3 file:
- `globals.css` — thay thế file cũ
- `tailwind.config.ts` — thay thế file cũ
- `ADN_DESIGN_SYSTEM.md` — spec cho Antigravity đọc

---

## BƯỚC 1 — Thay file globals.css

Mở Windows Explorer, vào thư mục:
```
D:\BOT\adn-ai-bot\src\app\
```
Xóa file `globals.css` cũ, copy file `globals.css` mới vào đây.

---

## BƯỚC 2 — Thay file tailwind.config.ts

Vào thư mục:
```
D:\BOT\adn-ai-bot\
```
Xóa file `tailwind.config.ts` cũ, copy file `tailwind.config.ts` mới vào đây.

---

## BƯỚC 3 — Thêm font Manrope vào layout.tsx

Mở file:
```
D:\BOT\adn-ai-bot\src\app\layout.tsx
```

Tìm dòng import ở đầu file, thêm vào:
```tsx
import { Manrope } from 'next/font/google'

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-manrope',
  display: 'swap',
})
```

Sau đó tìm thẻ `<body` trong file, thêm `${manrope.variable}` vào className:
```tsx
<html className="dark">
```
(Giữ class `dark` hoặc `light` tùy theme mặc định — gán vào `<html>`, KHÔNG phải `<body>`)

---

## BƯỚC 4 — Bỏ ADN_DESIGN_SYSTEM.md vào repo

Copy file `ADN_DESIGN_SYSTEM.md` vào:
```
D:\BOT\adn-ai-bot\ADN_DESIGN_SYSTEM.md
```
Antigravity sẽ tự đọc file này khi build UI.

---

## BƯỚC 5 — Deploy

Paste vào Antigravity:
```
Deploy toàn bộ project sau khi thay đổi globals.css và tailwind.config.ts
```

---

## LƯU Ý QUAN TRỌNG

- File `globals.css` mới đã bao gồm CẢ dark lẫn light — không cần thêm gì nữa
- Tất cả hiệu ứng (glow, blur, scale, animation) được giữ nguyên trong cả 2 theme
- Để switch theme: đổi class trên `<body>` từ `dark` sang `light` hoặc ngược lại
- Nếu có toggle dark/light trên web, chỉ cần thay đổi class `dark`/`light` trên element gốc
