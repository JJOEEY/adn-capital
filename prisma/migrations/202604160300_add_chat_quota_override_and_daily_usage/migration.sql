-- CreateTable
CREATE TABLE "ChatUsageDaily" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatUsageDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminChatQuotaOverride" (
    "id" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "totalQuota" INTEGER NOT NULL,
    "usedQuota" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "updatedByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminChatQuotaOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatUsageDaily_userId_dateKey_key" ON "ChatUsageDaily"("userId", "dateKey");

-- CreateIndex
CREATE INDEX "ChatUsageDaily_dateKey_idx" ON "ChatUsageDaily"("dateKey");

-- CreateIndex
CREATE UNIQUE INDEX "AdminChatQuotaOverride_targetUserId_key" ON "AdminChatQuotaOverride"("targetUserId");

-- CreateIndex
CREATE INDEX "AdminChatQuotaOverride_active_updatedAt_idx" ON "AdminChatQuotaOverride"("active", "updatedAt");

-- CreateIndex
CREATE INDEX "AdminChatQuotaOverride_updatedByAdminId_updatedAt_idx" ON "AdminChatQuotaOverride"("updatedByAdminId", "updatedAt");

-- AddForeignKey
ALTER TABLE "ChatUsageDaily" ADD CONSTRAINT "ChatUsageDaily_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminChatQuotaOverride" ADD CONSTRAINT "AdminChatQuotaOverride_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminChatQuotaOverride" ADD CONSTRAINT "AdminChatQuotaOverride_updatedByAdminId_fkey" FOREIGN KEY ("updatedByAdminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
