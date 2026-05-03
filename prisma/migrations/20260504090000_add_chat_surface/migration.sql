ALTER TABLE "Chat" ADD COLUMN "surface" TEXT;

CREATE INDEX "Chat_userId_surface_createdAt_idx" ON "Chat"("userId", "surface", "createdAt");
