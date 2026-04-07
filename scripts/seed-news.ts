/**
 * Seed script: Tạo Categories + Mock Articles vào database.
 * Chạy: npx tsx scripts/seed-news.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const categories = [
  { name: "Thị trường", slug: "thi-truong", sortOrder: 1 },
  { name: "Vĩ mô", slug: "vi-mo", sortOrder: 2 },
  { name: "Doanh nghiệp", slug: "doanh-nghiep", sortOrder: 3 },
  { name: "Quốc tế", slug: "quoc-te", sortOrder: 4 },
  { name: "Chính sách", slug: "chinh-sach", sortOrder: 5 },
  { name: "Ngân hàng", slug: "ngan-hang", sortOrder: 6 },
  { name: "Bất động sản", slug: "bat-dong-san", sortOrder: 7 },
  { name: "Crypto", slug: "crypto", sortOrder: 8 },
  { name: "Chứng khoán", slug: "chung-khoan", sortOrder: 9 },
];

async function main() {
  console.log("🌱 Seeding Categories...");

  // Upsert categories
  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, sortOrder: cat.sortOrder },
      create: cat,
    });
  }

  console.log(`✅ ${categories.length} categories seeded`);

  // Check if admin user exists for article authorship
  const admin = await prisma.user.findFirst({
    where: { systemRole: "ADMIN" },
  });

  if (!admin) {
    console.log("⚠️  Không tìm thấy ADMIN user. Bỏ qua seed articles.");
    console.log("   Tạo admin trước: npx tsx scripts/seed-admin.js");
    return;
  }

  console.log(`📝 Seeding Articles (author: ${admin.email})...`);

  const catMap: Record<string, string> = {};
  const dbCats = await prisma.category.findMany();
  for (const c of dbCats) catMap[c.slug] = c.id;

  const articles = [
    {
      title: "Nhà đầu tư ồ ạt mở tài khoản, khối ngoại lập kỷ lục trong tháng VN-Index mất hơn 200 điểm",
      slug: "nha-dau-tu-o-at-mo-tai-khoan-khoi-ngoai-lap-ky-luc",
      excerpt: "Tháng 3 ghi nhận số lượng tài khoản chứng khoán tăng đột biến đến từ cả nhà đầu tư trong nước và nước ngoài.",
      content: "<p>Tháng 3 ghi nhận số lượng tài khoản chứng khoán tăng đột biến.</p>",
      aiSummary: "Tháng 3/2026: +346K tài khoản CK mới, khối ngoại mở kỷ lục 5.800 TK dù VN-Index giảm >200 điểm.",
      tags: '["Tin tức","Thị trường"]',
      sentiment: "Tích cực",
      categorySlug: "thi-truong",
      imageUrl: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=450&fit=crop",
      sourceUrl: "https://cafef.vn",
    },
    {
      title: "Cổ phiếu giảm, dầu tăng vì căng thẳng Mỹ - Iran",
      slug: "co-phieu-giam-dau-tang-vi-cang-thang-my-iran",
      excerpt: "Thị trường chứng khoán giảm điểm, giá dầu tăng mạnh do lo ngại xung đột Trung Đông leo thang.",
      content: "<p>Thị trường chứng khoán giảm điểm, giá dầu tăng mạnh.</p>",
      aiSummary: "Căng thẳng Mỹ-Iran đẩy giá dầu Brent lên 89 USD, S&P 500 -1.2%, vàng +0.8%.",
      tags: '["Quốc tế","Dầu mỏ"]',
      sentiment: "Tiêu cực",
      categorySlug: "quoc-te",
      imageUrl: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=800&h=450&fit=crop",
      sourceUrl: "https://bloomberg.com",
    },
    {
      title: "Dragon Capital: Dòng tiền lớn đã vào cổ phiếu VN",
      slug: "dragon-capital-dong-tien-lon-da-vao-co-phieu-vn",
      excerpt: "Dragon Capital nhận định dòng tiền ngoại lớn đang chảy vào cổ phiếu Việt Nam.",
      content: "<p>Dragon Capital nhận định cơ hội vàng cho cổ phiếu Việt Nam.</p>",
      aiSummary: "Dragon Capital: PE 10x, rẻ nhất châu Á. Target VN-Index 1.450-1.500 (+25-30%).",
      tags: '["Thị trường","Khối ngoại"]',
      sentiment: "Tích cực",
      categorySlug: "thi-truong",
      imageUrl: "https://images.unsplash.com/photo-1642790106117-e829e14a795f?w=800&h=450&fit=crop",
      sourceUrl: null,
    },
    {
      title: "MBS: Lợi nhuận quý I đạt 292 tỷ đồng, tăng 8%",
      slug: "mbs-loi-nhuan-quy-i-dat-292-ty-dong-tang-8",
      excerpt: "CTCP Chứng khoán MB (MBS) công bố BCTC quý I/2026 khả quan.",
      content: "<p>MBS công bố kết quả kinh doanh quý I/2026 khả quan.</p>",
      aiSummary: "MBS Q1/2026: DT 1.120 tỷ (+12%), LNST 292 tỷ (+8%).",
      tags: '["Doanh nghiệp","Chứng khoán"]',
      sentiment: "Tích cực",
      categorySlug: "doanh-nghiep",
      imageUrl: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=450&fit=crop",
      sourceUrl: "https://vietnambiz.vn",
    },
    {
      title: "Bitcoin vượt 90.000 USD giữa bất ổn địa chính trị",
      slug: "bitcoin-vuot-90000-usd-giua-bat-on-dia-chinh-tri",
      excerpt: "Bitcoin tiếp tục đà tăng vượt 90.000 USD khi nhà đầu tư tìm tài sản trú ẩn.",
      content: "<p>Bitcoin đã vượt mốc 90.000 USD.</p>",
      aiSummary: "Bitcoin vượt 90.000 USD (ATH). ETF inflow 500M/ngày. ETH 4.200, SOL 280.",
      tags: '["Crypto","Bitcoin"]',
      sentiment: "Tích cực",
      categorySlug: "crypto",
      imageUrl: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800&h=450&fit=crop",
      sourceUrl: null,
    },
  ];

  for (const art of articles) {
    const categoryId = catMap[art.categorySlug] || null;
    await prisma.article.upsert({
      where: { slug: art.slug },
      update: {
        title: art.title,
        content: art.content,
        excerpt: art.excerpt,
        aiSummary: art.aiSummary,
        tags: art.tags,
        sentiment: art.sentiment,
        categoryId,
        imageUrl: art.imageUrl,
        sourceUrl: art.sourceUrl,
      },
      create: {
        title: art.title,
        slug: art.slug,
        content: art.content,
        excerpt: art.excerpt,
        aiSummary: art.aiSummary,
        tags: art.tags,
        sentiment: art.sentiment,
        categoryId,
        imageUrl: art.imageUrl,
        sourceUrl: art.sourceUrl,
        authorId: admin.id,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
  }

  console.log(`✅ ${articles.length} articles seeded`);
  console.log("\n🎉 Done! Truy cập /khac/tin-tuc để xem.");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
