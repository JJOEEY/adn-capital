-- CreateTable
CREATE TABLE "LandingProcessStep" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageAlt" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingProcessStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LandingProcessStep_isPublished_sortOrder_idx" ON "LandingProcessStep"("isPublished", "sortOrder");

-- CreateIndex
CREATE INDEX "LandingProcessStep_sortOrder_idx" ON "LandingProcessStep"("sortOrder");

-- Seed default landing process steps
INSERT INTO "LandingProcessStep"
("id", "title", "description", "imageUrl", "imageAlt", "isPublished", "sortOrder", "createdAt", "updatedAt")
VALUES
  (
    'landing-process-register',
    'Đăng ký tài khoản',
    'Mở tài khoản chứng khoán miễn phí qua link giới thiệu của ADN Capital. Phí giao dịch ưu đãi từ 0.15%.',
    '/logo.jpg',
    'Bước đăng ký tài khoản',
    true,
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'landing-process-connect',
    'Kết nối hệ thống',
    'Đăng nhập ADN Capital bằng Google. Hệ thống tự động kích hoạt gói VIP khi xác nhận tài khoản.',
    '/logo.jpg',
    'Bước kết nối hệ thống',
    true,
    2,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'landing-process-follow',
    'Theo dõi tín hiệu',
    'Nhận tín hiệu Mua/Bán đã được AI lọc. Dashboard hiển thị RS Rating và Market Score realtime.',
    '/logo.jpg',
    'Bước theo dõi tín hiệu',
    true,
    3,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("id") DO NOTHING;
