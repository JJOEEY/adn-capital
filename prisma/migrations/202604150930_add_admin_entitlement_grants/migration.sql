-- CreateTable
CREATE TABLE "AdminEntitlementGrant" (
    "id" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "badge" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "grantedByAdminId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminEntitlementGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminEntitlementGrant_targetUserId_createdAt_idx" ON "AdminEntitlementGrant"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminEntitlementGrant_targetUserId_expiresAt_idx" ON "AdminEntitlementGrant"("targetUserId", "expiresAt");

-- CreateIndex
CREATE INDEX "AdminEntitlementGrant_grantedByAdminId_createdAt_idx" ON "AdminEntitlementGrant"("grantedByAdminId", "createdAt");

-- AddForeignKey
ALTER TABLE "AdminEntitlementGrant" ADD CONSTRAINT "AdminEntitlementGrant_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminEntitlementGrant" ADD CONSTRAINT "AdminEntitlementGrant_grantedByAdminId_fkey" FOREIGN KEY ("grantedByAdminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
