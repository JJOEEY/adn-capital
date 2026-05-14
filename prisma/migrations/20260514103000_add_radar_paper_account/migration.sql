CREATE TABLE "RadarPaperAccount" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL DEFAULT 'adn-radar',
    "initialNav" DOUBLE PRECISION NOT NULL DEFAULT 1000000000,
    "cash" DOUBLE PRECISION NOT NULL DEFAULT 1000000000,
    "realizedPnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "seededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RadarPaperAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RadarPaperPosition" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "signalId" TEXT,
    "ticker" TEXT NOT NULL,
    "exchange" TEXT NOT NULL DEFAULT 'HOSE',
    "signalType" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL,
    "costBasis" DOUBLE PRECISION NOT NULL,
    "navAllocation" DOUBLE PRECISION NOT NULL,
    "target" DOUBLE PRECISION,
    "stoploss" DOUBLE PRECISION,
    "currentPrice" DOUBLE PRECISION,
    "marketValue" DOUBLE PRECISION,
    "currentPnl" DOUBLE PRECISION,
    "currentPnlValue" DOUBLE PRECISION,
    "maxPnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sellableAt" TIMESTAMP(3) NOT NULL,
    "pendingExitReason" TEXT,
    "pendingExitTriggeredAt" TIMESTAMP(3),
    "pendingExitPrice" DOUBLE PRECISION,
    "closePrice" DOUBLE PRECISION,
    "closeValue" DOUBLE PRECISION,
    "realizedPnl" DOUBLE PRECISION,
    "realizedPnlPct" DOUBLE PRECISION,
    "closedAt" TIMESTAMP(3),
    "holdingAction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RadarPaperPosition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RadarPaperTrade" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "positionId" TEXT,
    "signalId" TEXT,
    "ticker" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL,
    "grossValue" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "tradedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RadarPaperTrade_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RadarPaperSnapshot" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "snapshotDate" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "cash" DOUBLE PRECISION NOT NULL,
    "investedValue" DOUBLE PRECISION NOT NULL,
    "totalNav" DOUBLE PRECISION NOT NULL,
    "unrealizedPnl" DOUBLE PRECISION NOT NULL,
    "realizedPnl" DOUBLE PRECISION NOT NULL,
    "totalPnl" DOUBLE PRECISION NOT NULL,
    "totalPnlPct" DOUBLE PRECISION NOT NULL,
    "positionsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RadarPaperSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RadarPaperAccount_slug_key" ON "RadarPaperAccount"("slug");
CREATE INDEX "RadarPaperPosition_accountId_status_idx" ON "RadarPaperPosition"("accountId", "status");
CREATE INDEX "RadarPaperPosition_ticker_status_idx" ON "RadarPaperPosition"("ticker", "status");
CREATE INDEX "RadarPaperPosition_signalId_idx" ON "RadarPaperPosition"("signalId");
CREATE INDEX "RadarPaperTrade_accountId_tradedAt_idx" ON "RadarPaperTrade"("accountId", "tradedAt");
CREATE INDEX "RadarPaperTrade_ticker_tradedAt_idx" ON "RadarPaperTrade"("ticker", "tradedAt");
CREATE UNIQUE INDEX "RadarPaperSnapshot_accountId_snapshotDate_slot_key" ON "RadarPaperSnapshot"("accountId", "snapshotDate", "slot");
CREATE INDEX "RadarPaperSnapshot_snapshotDate_slot_idx" ON "RadarPaperSnapshot"("snapshotDate", "slot");

ALTER TABLE "RadarPaperPosition" ADD CONSTRAINT "RadarPaperPosition_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "RadarPaperAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RadarPaperTrade" ADD CONSTRAINT "RadarPaperTrade_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "RadarPaperAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RadarPaperSnapshot" ADD CONSTRAINT "RadarPaperSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "RadarPaperAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
