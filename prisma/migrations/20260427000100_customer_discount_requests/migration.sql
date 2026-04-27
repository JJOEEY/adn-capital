ALTER TABLE "User" ADD COLUMN "trialVipActivatedAt" TIMESTAMP(3);

ALTER TABLE "PaymentOrder" ADD COLUMN "customerCode" TEXT;
ALTER TABLE "PaymentOrder" ADD COLUMN "discountPercent" INTEGER;
ALTER TABLE "PaymentOrder" ADD COLUMN "discountStatus" TEXT;

CREATE TABLE "CustomerDiscountRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "email" TEXT,
  "customerCode" TEXT NOT NULL,
  "requestedPlanId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "discountPercent" INTEGER,
  "reviewedByAdminId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomerDiscountRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerDiscountRequest_customerCode_status_idx" ON "CustomerDiscountRequest"("customerCode", "status");
CREATE INDEX "CustomerDiscountRequest_userId_status_idx" ON "CustomerDiscountRequest"("userId", "status");
CREATE INDEX "CustomerDiscountRequest_requestedPlanId_status_idx" ON "CustomerDiscountRequest"("requestedPlanId", "status");
CREATE INDEX "CustomerDiscountRequest_status_createdAt_idx" ON "CustomerDiscountRequest"("status", "createdAt");

ALTER TABLE "CustomerDiscountRequest"
  ADD CONSTRAINT "CustomerDiscountRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CustomerDiscountRequest"
  ADD CONSTRAINT "CustomerDiscountRequest_reviewedByAdminId_fkey"
  FOREIGN KEY ("reviewedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
