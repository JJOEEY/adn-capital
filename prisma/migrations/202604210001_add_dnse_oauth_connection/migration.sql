-- CreateTable
CREATE TABLE "DnseConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'DNSE',
    "accountId" TEXT NOT NULL,
    "accountName" TEXT,
    "subAccountId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT,
    "tokenType" TEXT,
    "scope" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "metadata" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DnseConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DnseOAuthState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DnseOAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DnseConnection_userId_key" ON "DnseConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DnseConnection_accountId_key" ON "DnseConnection"("accountId");

-- CreateIndex
CREATE INDEX "DnseConnection_status_updatedAt_idx" ON "DnseConnection"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "DnseConnection_accountId_status_idx" ON "DnseConnection"("accountId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DnseOAuthState_state_key" ON "DnseOAuthState"("state");

-- CreateIndex
CREATE INDEX "DnseOAuthState_userId_expiresAt_idx" ON "DnseOAuthState"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "DnseOAuthState_expiresAt_idx" ON "DnseOAuthState"("expiresAt");

-- AddForeignKey
ALTER TABLE "DnseConnection" ADD CONSTRAINT "DnseConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DnseOAuthState" ADD CONSTRAINT "DnseOAuthState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
