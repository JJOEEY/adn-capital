/**
 * Seed changelog: Cập nhật tính năng Bảng giá + Lock/Unlock UI (2026-04-08)
 *
 * Chạy:  npx tsx scripts/seed-changelog-pricing.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const entry = await prisma.changelog.create({
    data: {
      component: "PricingSection",
      action: "UPDATE_FEATURES",
      author: "admin",
      description:
        "Cập nhật toàn bộ danh sách tính năng 4 gói cước (1M/3M/6M/12M) + hiệu ứng UI Lock/Unlock (FOMO). " +
        "Tính năng Mở: icon ✔️ xanh, text sáng. Tính năng Khóa: icon 🔒, text mờ (opacity-50). " +
        "Card đồng chiều cao, nút Đăng Ký thẳng hàng.",
      diff: JSON.stringify({
        date: "2026-04-08",
        files: [
          "src/components/landing/Pricing.tsx",
          "src/app/pricing/PricingClient.tsx",
        ],
        changes: {
          "Gói 1 Tháng": { unlocked: 5, locked: 6 },
          "Gói 3 Tháng": { unlocked: 5, locked: 6 },
          "Gói 6 Tháng": { unlocked: 8, locked: 2 },
          "Gói 12 Tháng": { unlocked: 10, locked: 0 },
        },
        ui: "Lock icon + opacity-50 cho tính năng khóa, Check icon + accent color cho tính năng mở",
      }),
    },
  });

  console.log("✅ Changelog created:", entry.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
