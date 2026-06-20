-- CreateTable
CREATE TABLE IF NOT EXISTS "LabBacktest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LabBacktest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LabBacktest_userId_createdAt_idx" ON "LabBacktest"("userId", "createdAt");

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "LabBacktest" ADD CONSTRAINT "LabBacktest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
