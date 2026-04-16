-- CreateTable
CREATE TABLE "LandingProductCard" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT NOT NULL,
    "bullets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "href" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageAlt" TEXT,
    "badge" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingProductCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LandingProductCard_isPublished_sortOrder_idx" ON "LandingProductCard"("isPublished", "sortOrder");

-- CreateIndex
CREATE INDEX "LandingProductCard_sortOrder_idx" ON "LandingProductCard"("sortOrder");

-- Seed default landing products
INSERT INTO "LandingProductCard"
("id", "title", "subtitle", "description", "bullets", "href", "imageUrl", "imageAlt", "badge", "isPublished", "sortOrder", "createdAt", "updatedAt")
VALUES
  (
    'landing-art',
    'Chỉ báo ART',
    'Analytical Reversal Tracker',
    'Xác định điểm đảo chiều xu hướng thị trường. Đo lường mức độ cạn kiệt để nhận biết khi nào nên vào/thoát lệnh.',
    ARRAY[
      'Gauge trực quan 0–5 điểm',
      'Biểu đồ lịch sử ART + MA7',
      'Hỗ trợ mọi mã CK',
      'Cập nhật theo phiên giao dịch'
    ]::TEXT[],
    '/art',
    '/logo.jpg',
    'ART mockup',
    'MỚI',
    true,
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'landing-terminal',
    'Tư vấn đầu tư',
    'AI phân tích thông minh',
    'Hỏi đáp phân tích kỹ thuật, cơ bản, tâm lý với AI chuyên sâu về thị trường chứng khoán Việt Nam 24/7.',
    ARRAY[
      'Phân tích kỹ thuật theo yêu cầu',
      'Tóm tắt báo cáo tài chính',
      'Market sentiment & vĩ mô',
      'Luận điểm Long / Short'
    ]::TEXT[],
    '/terminal',
    '/logo.jpg',
    'Investment advisor mockup',
    NULL,
    true,
    2,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'landing-broker',
    'ADN AI Broker',
    'Tín hiệu mua/bán tự động',
    'Nhận tín hiệu Mua/Bán theo hệ thống Quant Trading của ADN Capital — bộ lọc đa chiều, tối ưu cho VN.',
    ARRAY[
      'Tín hiệu mua/bán tự động',
      'Bộ lọc Volume & RS cùng lúc',
      'Lịch sử tín hiệu đầy đủ',
      'Thông báo Real-time'
    ]::TEXT[],
    '/dashboard/signal-map',
    '/logo.jpg',
    'ADN AI Broker mockup',
    NULL,
    true,
    3,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'landing-margin',
    'Ký Quỹ Margin',
    'Lãi suất từ 5.99%/năm',
    'Tư vấn miễn phí, phản hồi trong 2 giờ. Tối ưu đòn bẩy, quản lý tỷ lệ ký quỹ chuyên nghiệp.',
    ARRAY[
      'Lãi suất từ 5.99%/năm',
      'Tư vấn miễn phí',
      'Phản hồi trong 2 giờ',
      'Quản lý ký quỹ chuyên nghiệp'
    ]::TEXT[],
    '/margin',
    '/logo.jpg',
    'Margin service mockup',
    'HOT',
    true,
    4,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("id") DO NOTHING;
