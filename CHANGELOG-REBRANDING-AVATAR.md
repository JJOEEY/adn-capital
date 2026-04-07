# Changelog: Rebranding + Avatar DB — 2026-04-07

## Mục tiêu
1. **Rebranding UI**: Ẩn giấu thuật ngữ kỹ thuật (VSA, Seasonality, SignalEngine) trên giao diện Frontend.
2. **Miễn trừ trách nhiệm**: Thay banner cũ bằng tuyên bố pháp lý.
3. **Avatar Database**: Lưu đường dẫn avatar upload vào bảng DB riêng biệt.

---

## Thay đổi chi tiết

### 1. Rebranding text — `src/components/signals/SignalMapClient.tsx`

| Vị trí | Cũ | Mới |
|--------|-----|-----|
| Header - Tiêu đề chính | `Signal Dashboard` | `ADN AI Broker` |
| Header - Tiêu đề phụ | `UltimateSignalEngine — VSA × Seasonality × AI Broker` | `Broker System Powered by ADN Capital` |
| Footer banner | `🤖 Tín hiệu được xử lý bởi UltimateSignalEngine — VSA scan → Seasonality filter → AI Broker output` | `🤖 Tất cả các khuyến nghị đều mang tính chất tham khảo, khách hàng vui lòng tự chịu trách nhiệm trong quyết định đầu tư của mình.` |

### 2. Dọn sạch từ khóa — `src/components/dashboard/BacktestSection.tsx`

| Vị trí | Cũ | Mới |
|--------|-----|-----|
| Event text Q1/2025 | `SSI breakout RS=95 — Sóng tăng mạnh nhất năm` | `SSI breakout — Sóng tăng mạnh nhất năm` |
| Result text Q1/2025 | `tín hiệu VSA xác nhận` | `tín hiệu ADN xác nhận` |

### 3. Avatar Upload Database — `prisma/schema.prisma`

Thêm model `AvatarUpload`:
```prisma
model AvatarUpload {
  id        String   @id @default(cuid())
  userId    String
  filename  String
  filePath  String   // đường dẫn filesystem tới file ảnh
  url       String   // URL truy cập
  mimeType  String?
  size      Int?     // bytes
  createdAt DateTime @default(now())
  @@index([userId, createdAt])
}
```

### 4. Avatar Route — `src/app/api/user/avatar/route.ts`

- Khi upload avatar, ngoài cập nhật `User.image`, còn tạo bản ghi `AvatarUpload` lưu:
  - `userId`, `filename`, `filePath` (filesystem), `url` (API URL), `mimeType`, `size`
- Không mã hóa hình ảnh, chỉ lưu đường dẫn.

---

## File đã chỉnh sửa (5 files)
1. `src/components/signals/SignalMapClient.tsx` — Header + Footer rebranding
2. `src/components/dashboard/BacktestSection.tsx` — Xóa "RS=95", "VSA"
3. `prisma/schema.prisma` — Thêm model AvatarUpload
4. `src/app/api/user/avatar/route.ts` — Lưu path vào AvatarUpload table
5. `CHANGELOG-REBRANDING-AVATAR.md` — File changelog này
