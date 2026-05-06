CREATE TABLE "TelegramDispatchLog" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "tradingDate" TEXT,
    "slot" TEXT,
    "payloadHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sending',
    "targetChatIdHash" TEXT,
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramDispatchLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TelegramDispatchLog_eventKey_key" ON "TelegramDispatchLog"("eventKey");
CREATE INDEX "TelegramDispatchLog_eventType_tradingDate_idx" ON "TelegramDispatchLog"("eventType", "tradingDate");
CREATE INDEX "TelegramDispatchLog_status_createdAt_idx" ON "TelegramDispatchLog"("status", "createdAt");
CREATE INDEX "TelegramDispatchLog_sentAt_idx" ON "TelegramDispatchLog"("sentAt");
