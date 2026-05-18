CREATE TABLE "DatabaseNewsItem" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "summary" TEXT,
    "publishedAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hash" TEXT NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatabaseNewsItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DatabaseNewsItem_source_url_key" ON "DatabaseNewsItem"("source", "url");
CREATE UNIQUE INDEX "DatabaseNewsItem_source_hash_key" ON "DatabaseNewsItem"("source", "hash");
CREATE INDEX "DatabaseNewsItem_source_category_publishedAt_idx" ON "DatabaseNewsItem"("source", "category", "publishedAt");
CREATE INDEX "DatabaseNewsItem_category_fetchedAt_idx" ON "DatabaseNewsItem"("category", "fetchedAt");
CREATE INDEX "DatabaseNewsItem_fetchedAt_idx" ON "DatabaseNewsItem"("fetchedAt");
