-- CreateTable
CREATE TABLE "ArticleAnalyticsEvent" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "sessionIdHash" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "readDepth" INTEGER NOT NULL DEFAULT 0,
    "readTimeSec" INTEGER,
    "source" TEXT,
    "referrerHost" TEXT,
    "deviceType" TEXT,
    "path" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleAnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArticleAnalyticsEvent_articleId_occurredAt_idx" ON "ArticleAnalyticsEvent"("articleId", "occurredAt");

-- CreateIndex
CREATE INDEX "ArticleAnalyticsEvent_eventType_occurredAt_idx" ON "ArticleAnalyticsEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "ArticleAnalyticsEvent_source_occurredAt_idx" ON "ArticleAnalyticsEvent"("source", "occurredAt");

-- CreateIndex
CREATE INDEX "ArticleAnalyticsEvent_sessionIdHash_articleId_eventType_idx" ON "ArticleAnalyticsEvent"("sessionIdHash", "articleId", "eventType");

-- AddForeignKey
ALTER TABLE "ArticleAnalyticsEvent" ADD CONSTRAINT "ArticleAnalyticsEvent_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
