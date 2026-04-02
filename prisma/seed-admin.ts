/**
 * Script tạo tài khoản Admin VIP.
 *
 * Chạy bằng: npx tsx prisma/seed-admin.ts
 *
 * Tài khoản mặc định:
 *   Email:    admin@adn.vn
 *   Pass:     admin123
 *   Role:     VIP (vĩnh viễn)
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ADMIN_EMAIL = "admin@adn.vn";
const ADMIN_PASSWORD = "admin123";
const ADMIN_NAME = "Admin ADN";

async function main() {
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);

  // Xoá cũ nếu có → tạo mới
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });

  if (existing) {
    await prisma.user.update({
      where: { email: ADMIN_EMAIL },
      data: {
        password: hashedPassword,
        role: "VIP",
        name: ADMIN_NAME,
        vipUntil: new Date("2099-12-31"),
      },
    });
    console.log(`✅ Đã cập nhật tài khoản admin: ${ADMIN_EMAIL}`);
  } else {
    await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        password: hashedPassword,
        name: ADMIN_NAME,
        role: "VIP",
        vipUntil: new Date("2099-12-31"),
      },
    });
    console.log(`✅ Đã tạo tài khoản admin mới: ${ADMIN_EMAIL}`);
  }

  console.log(`   Email:    ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
  console.log(`   Role:     VIP (đến 2099)`);
}

main()
  .catch((e) => {
    console.error("❌ Lỗi seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
