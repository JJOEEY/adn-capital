# Changelog - RBAC + RS-Rating Hiding (2025-07-07)

## MỤC TIÊU 1: Tách systemRole / subscriptionTier (RBAC Fix)

### Vấn đề
- Trước đây chỉ có 1 trường `role` (FREE | VIP | ADMIN) trộn lẫn quyền hệ thống và gói đăng ký.
- Admin với role="FREE" không thể truy cập nội dung VIP dù có quyền admin.

### Thay đổi
- **prisma/schema.prisma**: Thêm trường `systemRole String @default("USER")` vào User model. Trường `role` giữ nguyên cho subscription (FREE | VIP).
- **src/lib/auth.ts**: JWT callback đọc cả `systemRole` từ DB, truyền qua token + session.
- **src/types/next-auth.d.ts**: Bổ sung `systemRole` vào User, Session, JWT types.
- **src/app/api/me/route.ts**: Trả `systemRole` + `isAdmin` dựa trên `systemRole === "ADMIN"` thay vì ADMIN_EMAILS env var. vipTier giờ tính từ `vipUntil` bất kể role.
- **src/lib/admin-check.ts**: Tạo mới — helper dùng chung cho tất cả admin API routes.
- **src/app/api/admin/users/[id]/route.ts**: Cho phép PATCH `systemRole` riêng biệt. Admin check chuyển sang dùng DB systemRole.
- **src/app/api/admin/users/route.ts**: Trả thêm `systemRole` trong select. Dùng admin-check.ts.
- **src/app/api/admin/registrations/route.ts**: Chuyển sang admin-check.ts.
- **src/app/api/admin/registrations/[id]/route.ts**: Chuyển sang admin-check.ts.
- **src/app/api/admin/margin/route.ts**: Chuyển sang admin-check.ts.
- **src/hooks/useCurrentDbUser.ts**: `isAdmin` từ `dbUser.systemRole === "ADMIN"`. `isVip` = isAdmin || role === "VIP" || có vipTier.
- **src/hooks/useSubscription.ts**: Không thay đổi logic (vẫn `hasFullAccess = isAdmin || isVip`).
- **src/app/admin/page.tsx**: 
  - Thêm cột "Quyền" hiển thị ADMIN/USER badge.
  - Nút ADMIN toggle giờ set `systemRole` thay vì `role`.
  - VIP presets vẫn set `role` + `vipUntil` — độc lập với systemRole.
- **src/app/profile/page.tsx**: Thay tất cả `role === "ADMIN"` bằng `isAdmin`. Đổi "RS - VIP/Free" thành "ADN - VIP/Free".
- **src/types/index.ts**: Thêm `SystemRole = "ADMIN" | "USER"`.

## MỤC TIÊU 2: Ẩn RS-Rating khỏi Frontend

### Vấn đề
- RS-Rating là "công thức bí mật" — cần giữ nguyên backend nhưng ẩn hoàn toàn khỏi giao diện.

### Thay đổi
- **src/components/layout/Sidebar.tsx**: Xóa RS Rating khỏi navItems.
- **src/components/layout/TopNavbar.tsx**: Xóa RS Rating khỏi serviceItems dropdown.
- **src/components/layout/Header.tsx**: Xóa RS Rating khỏi "Sản phẩm đầu tư" menu section.
- **src/components/layout/DashboardLayout.tsx**: Xóa RS Rating khỏi "Giải pháp đầu tư" submenu.
- **src/components/pwa/BottomTabBar.tsx**: Xóa RS-Rating tab.
- **src/app/dashboard/page.tsx**: Xóa TopLeaders import, rsRaw SWR, leaderRows, TopLeaders render.
- **src/components/dashboard/BacktestSection.tsx**: Đổi "RS Rating top 5%" → "Mùa vụ thuận lợi".
- **src/app/san-pham/page.tsx**: Xóa RS Rating service card. Đổi "Volume & RS" → "Volume & sức mạnh".

### Giữ nguyên (Không xóa)
- `/api/rs-rating` endpoint — vẫn hoạt động.
- `/dashboard/rs-rating` page — vẫn tồn tại, chỉ không có navigation đến.
- Python backend `scanner.py`: `_fetch_rs_ratings()`, `_detect_sieu_co_phieu()` — giữ nguyên.
- `useSubscription.isRsRatingLocked` — vẫn giữ cho RS page nếu ai truy cập trực tiếp.

## DB Migration cần chạy trên VPS
```sql
ALTER TABLE User ADD COLUMN systemRole TEXT NOT NULL DEFAULT 'USER';
-- Migrate existing admin users (nếu có):
-- UPDATE User SET systemRole = 'ADMIN' WHERE email IN ('admin@email.com');
```
Hoặc chạy: `npx prisma db push`
