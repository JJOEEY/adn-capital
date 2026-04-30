CREATE TABLE "DnseRadarAutoConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT,
    "buyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sellEnabled" BOOLEAN NOT NULL DEFAULT false,
    "useLoanPackage" BOOLEAN NOT NULL DEFAULT false,
    "loanPackageId" TEXT,
    "maxNavPctPerOrder" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "maxOrderValue" DOUBLE PRECISION,
    "maxDailyValue" DOUBLE PRECISION,
    "maxDailyOrders" INTEGER NOT NULL DEFAULT 3,
    "allowedTickers" TEXT,
    "blockedTickers" TEXT,
    "maxLossPct" DOUBLE PRECISION,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DnseRadarAutoConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DnseRadarAutoAuthorization" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'INACTIVE',
    "tradingTokenEnc" TEXT,
    "expiresAt" TIMESTAMP(3),
    "authorizedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DnseRadarAutoAuthorization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DnseRadarAutoExecutionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT,
    "signalId" TEXT,
    "ticker" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION,
    "orderType" TEXT NOT NULL DEFAULT 'LO',
    "loanPackageId" TEXT,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "brokerOrderId" TEXT,
    "payloadJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DnseRadarAutoExecutionLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DnseRadarAutoConfig_userId_key" ON "DnseRadarAutoConfig"("userId");
CREATE INDEX "DnseRadarAutoConfig_accountId_idx" ON "DnseRadarAutoConfig"("accountId");
CREATE INDEX "DnseRadarAutoConfig_buyEnabled_sellEnabled_paused_idx" ON "DnseRadarAutoConfig"("buyEnabled", "sellEnabled", "paused");

CREATE UNIQUE INDEX "DnseRadarAutoAuthorization_userId_key" ON "DnseRadarAutoAuthorization"("userId");
CREATE INDEX "DnseRadarAutoAuthorization_status_expiresAt_idx" ON "DnseRadarAutoAuthorization"("status", "expiresAt");
CREATE INDEX "DnseRadarAutoAuthorization_accountId_idx" ON "DnseRadarAutoAuthorization"("accountId");

CREATE INDEX "DnseRadarAutoExecutionLog_userId_createdAt_idx" ON "DnseRadarAutoExecutionLog"("userId", "createdAt");
CREATE INDEX "DnseRadarAutoExecutionLog_signalId_idx" ON "DnseRadarAutoExecutionLog"("signalId");
CREATE INDEX "DnseRadarAutoExecutionLog_status_createdAt_idx" ON "DnseRadarAutoExecutionLog"("status", "createdAt");
