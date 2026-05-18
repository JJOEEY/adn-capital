CREATE TABLE "DatabaseToolLatest" (
    "id" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "dataset" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "tradingDate" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'database_v2',
    "payload" JSONB NOT NULL,
    "missingFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "providerStatus" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatabaseToolLatest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DatabaseToolLatest_tool_dataset_key_tradingDate_key" ON "DatabaseToolLatest"("tool", "dataset", "key", "tradingDate");
CREATE INDEX "DatabaseToolLatest_tool_dataset_tradingDate_idx" ON "DatabaseToolLatest"("tool", "dataset", "tradingDate");
CREATE INDEX "DatabaseToolLatest_dataset_updatedAt_idx" ON "DatabaseToolLatest"("dataset", "updatedAt");
CREATE INDEX "DatabaseToolLatest_key_updatedAt_idx" ON "DatabaseToolLatest"("key", "updatedAt");
