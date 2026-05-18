CREATE TABLE "DatabaseMarketEvent" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'dnse',
    "dataset" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "symbol" TEXT,
    "messageType" TEXT,
    "tradingDate" TEXT NOT NULL,
    "providerTime" TIMESTAMP(3),
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatabaseMarketEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DatabaseMarketLatest" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'dnse',
    "dataset" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "tradingDate" TEXT NOT NULL,
    "providerTime" TIMESTAMP(3),
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatabaseMarketLatest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DatabaseMarketEvent_source_dataset_tradingDate_idx" ON "DatabaseMarketEvent"("source", "dataset", "tradingDate");
CREATE INDEX "DatabaseMarketEvent_channel_symbol_receivedAt_idx" ON "DatabaseMarketEvent"("channel", "symbol", "receivedAt");
CREATE INDEX "DatabaseMarketEvent_tradingDate_receivedAt_idx" ON "DatabaseMarketEvent"("tradingDate", "receivedAt");

CREATE UNIQUE INDEX "DatabaseMarketLatest_source_channel_symbol_tradingDate_key" ON "DatabaseMarketLatest"("source", "channel", "symbol", "tradingDate");
CREATE INDEX "DatabaseMarketLatest_dataset_tradingDate_idx" ON "DatabaseMarketLatest"("dataset", "tradingDate");
CREATE INDEX "DatabaseMarketLatest_symbol_updatedAt_idx" ON "DatabaseMarketLatest"("symbol", "updatedAt");
