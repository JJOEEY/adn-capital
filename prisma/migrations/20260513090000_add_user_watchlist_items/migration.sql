-- Persist user-managed mobile watchlists without broker or provider-side calls.
CREATE TABLE "UserWatchlistItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "source" TEXT,
    "sourceSignalId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserWatchlistItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserWatchlistItem_userId_ticker_key" ON "UserWatchlistItem"("userId", "ticker");
CREATE INDEX "UserWatchlistItem_userId_updatedAt_idx" ON "UserWatchlistItem"("userId", "updatedAt");
CREATE INDEX "UserWatchlistItem_ticker_idx" ON "UserWatchlistItem"("ticker");

ALTER TABLE "UserWatchlistItem"
ADD CONSTRAINT "UserWatchlistItem_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
