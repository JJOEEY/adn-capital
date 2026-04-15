-- CreateTable
CREATE TABLE "GuideCategory" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuideCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuideSection" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuideSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuideCategory_slug_key" ON "GuideCategory"("slug");

-- CreateIndex
CREATE INDEX "GuideCategory_sortOrder_idx" ON "GuideCategory"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "GuideSection_categoryId_slug_key" ON "GuideSection"("categoryId", "slug");

-- CreateIndex
CREATE INDEX "GuideSection_categoryId_sortOrder_idx" ON "GuideSection"("categoryId", "sortOrder");

-- AddForeignKey
ALTER TABLE "GuideSection" ADD CONSTRAINT "GuideSection_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "GuideCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default guide categories
INSERT INTO "GuideCategory" ("id", "title", "slug", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('guide-cat-bat-dau', 'Bắt đầu', 'bat-dau', 1, NOW(), NOW()),
  ('guide-cat-cong-cu', 'Công cụ phân tích', 'cong-cu-phan-tich', 2, NOW(), NOW()),
  ('guide-cat-ai-broker', 'ADN AI Broker', 'adn-ai-broker', 3, NOW(), NOW()),
  ('guide-cat-faq', 'FAQ', 'faq', 4, NOW(), NOW())
ON CONFLICT ("slug")
DO UPDATE SET
  "title" = EXCLUDED."title",
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = NOW();

-- Seed default guide sections
INSERT INTO "GuideSection" ("id", "title", "slug", "content", "sortOrder", "published", "categoryId", "createdAt", "updatedAt")
SELECT
  v.id,
  v.title,
  v.slug,
  v.content,
  v.sort_order,
  true,
  c."id",
  NOW(),
  NOW()
FROM (
  VALUES
    ('guide-sec-1',  'Giới thiệu ADN Capital', 'gioi-thieu-adn-capital', 1, '## Giới thiệu ADN Capital\n\nNội dung đang được cập nhật.', 'bat-dau'),
    ('guide-sec-2',  'Hướng dẫn đăng ký tài khoản', 'huong-dan-dang-ky-tai-khoan', 2, '## Hướng dẫn đăng ký tài khoản\n\nNội dung đang được cập nhật.', 'bat-dau'),
    ('guide-sec-3',  'Kết nối tài khoản DNSE', 'ket-noi-tai-khoan-dnse', 3, '## Kết nối tài khoản DNSE\n\nNội dung đang được cập nhật.', 'bat-dau'),
    ('guide-sec-4',  'Chỉ báo ART — Analytical Reversal Tracker', 'chi-bao-art-analytical-reversal-tracker', 1, '## Chỉ báo ART\n\nNội dung đang được cập nhật.', 'cong-cu-phan-tich'),
    ('guide-sec-5',  'Đọc hiểu ADN Composite Score', 'doc-hieu-adn-composite-score', 2, '## ADN Composite Score\n\nNội dung đang được cập nhật.', 'cong-cu-phan-tich'),
    ('guide-sec-6',  'Hướng dẫn dùng AI Broker (Khổng Minh)', 'huong-dan-dung-ai-broker-khong-minh', 3, '## AI Broker (Khổng Minh)\n\nNội dung đang được cập nhật.', 'cong-cu-phan-tich'),
    ('guide-sec-7',  'Tư vấn đầu tư — Chat với AI', 'tu-van-dau-tu-chat-voi-ai', 4, '## Tư vấn đầu tư\n\nNội dung đang được cập nhật.', 'cong-cu-phan-tich'),
    ('guide-sec-8',  'Quy trình tham khảo khuyến nghị đầu tư', 'quy-trinh-tham-khao-khuyen-nghi-dau-tu', 1, '## Quy trình tham khảo khuyến nghị đầu tư\n\nNội dung đang được cập nhật.', 'adn-ai-broker'),
    ('guide-sec-9',  'Quản lý rủi ro & Stoploss', 'quan-ly-rui-ro-stoploss', 2, '## Quản lý rủi ro & Stoploss\n\nNội dung đang được cập nhật.', 'adn-ai-broker'),
    ('guide-sec-10', 'Nhật ký giao dịch', 'nhat-ky-giao-dich', 3, '## Nhật ký giao dịch\n\nNội dung đang được cập nhật.', 'adn-ai-broker'),
    ('guide-sec-11', 'Câu hỏi thường gặp', 'cau-hoi-thuong-gap', 1, '## Câu hỏi thường gặp\n\nNội dung đang được cập nhật.', 'faq'),
    ('guide-sec-12', 'Liên hệ hỗ trợ', 'lien-he-ho-tro', 2, '## Liên hệ hỗ trợ\n\nNội dung đang được cập nhật.', 'faq')
) AS v(id, title, slug, sort_order, content, category_slug)
JOIN "GuideCategory" c ON c."slug" = v.category_slug
ON CONFLICT ("categoryId", "slug")
DO UPDATE SET
  "title" = EXCLUDED."title",
  "content" = EXCLUDED."content",
  "sortOrder" = EXCLUDED."sortOrder",
  "published" = EXCLUDED."published",
  "updatedAt" = NOW();
