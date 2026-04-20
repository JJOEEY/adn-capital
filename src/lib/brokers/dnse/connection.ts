import { prisma } from "@/lib/prisma";
import { decryptDnseToken, encryptDnseToken } from "./crypto";
import {
  DnseOAuthTokenResponse,
  exchangeDnseAuthorizationCode,
  extractDnseAccountIdentity,
  generateDnseOauthState,
  generatePkcePair,
  refreshDnseAccessToken,
} from "./oauth";
import { fetchDnseAccountProfile } from "./client";
import { writeDnseExecutionAudit } from "./audit";

type ConnectionState = {
  id: string;
  userId: string;
  accountId: string;
  accountName: string | null;
  subAccountId: string | null;
  status: string;
  accessTokenEnc: string;
  refreshTokenEnc: string | null;
  tokenType: string | null;
  scope: string | null;
  accessTokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  metadata: string | null;
  lastSyncedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function parseJson(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function toIsoNow() {
  return new Date().toISOString();
}

export async function getDnseConnectionForUser(userId: string) {
  return prisma.dnseConnection.findUnique({
    where: { userId },
  });
}

export async function createDnseOAuthState(userId: string, redirectUri: string) {
  const { verifier, challenge } = generatePkcePair();
  const state = generateDnseOauthState();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.dnseOAuthState.create({
    data: {
      userId,
      state,
      codeVerifier: verifier,
      redirectUri,
      expiresAt,
    },
  });

  return { state, verifier, challenge, expiresAt };
}

export async function consumeDnseOAuthState(args: { userId: string; state: string }) {
  const record = await prisma.dnseOAuthState.findUnique({
    where: { state: args.state },
  });
  if (!record) return null;

  await prisma.dnseOAuthState.delete({
    where: { state: args.state },
  });

  if (record.userId !== args.userId) return null;
  if (record.expiresAt.getTime() < Date.now()) return null;
  return record;
}

function resolveAccountIdentity(args: {
  token: DnseOAuthTokenResponse;
  profile: Awaited<ReturnType<typeof fetchDnseAccountProfile>> | null;
  fallbackAccountId: string | null;
}) {
  const tokenIdentity = extractDnseAccountIdentity(args.token.raw);
  const profileIdentity = args.profile ?? null;
  const accountId =
    profileIdentity?.accountId ??
    tokenIdentity.accountId ??
    args.fallbackAccountId;
  const accountName = profileIdentity?.accountName ?? tokenIdentity.accountName ?? null;
  const subAccountId = profileIdentity?.subAccountId ?? tokenIdentity.subAccountId ?? null;
  return { accountId, accountName, subAccountId };
}

async function saveConnectionForUser(args: {
  userId: string;
  accountId: string;
  accountName: string | null;
  subAccountId: string | null;
  token: DnseOAuthTokenResponse;
  metadata?: Record<string, unknown> | null;
}) {
  const now = new Date();
  const accessTokenEnc = encryptDnseToken(args.token.accessToken);
  const refreshTokenEnc = args.token.refreshToken
    ? encryptDnseToken(args.token.refreshToken)
    : null;
  const metadata = args.metadata ? JSON.stringify(args.metadata) : null;

  const connection = await prisma.dnseConnection.upsert({
    where: { userId: args.userId },
    update: {
      provider: "DNSE",
      accountId: args.accountId,
      accountName: args.accountName,
      subAccountId: args.subAccountId,
      status: "ACTIVE",
      accessTokenEnc,
      refreshTokenEnc,
      tokenType: args.token.tokenType,
      scope: args.token.scope,
      accessTokenExpiresAt: args.token.accessTokenExpiresAt,
      refreshTokenExpiresAt: args.token.refreshTokenExpiresAt,
      metadata,
      lastError: null,
      lastSyncedAt: now,
    },
    create: {
      userId: args.userId,
      provider: "DNSE",
      accountId: args.accountId,
      accountName: args.accountName,
      subAccountId: args.subAccountId,
      status: "ACTIVE",
      accessTokenEnc,
      refreshTokenEnc,
      tokenType: args.token.tokenType,
      scope: args.token.scope,
      accessTokenExpiresAt: args.token.accessTokenExpiresAt,
      refreshTokenExpiresAt: args.token.refreshTokenExpiresAt,
      metadata,
      lastError: null,
      lastSyncedAt: now,
    },
  });

  await prisma.user.update({
    where: { id: args.userId },
    data: {
      dnseId: args.accountId,
      dnseVerified: true,
      dnseAppliedAt: now,
    },
  });

  return connection;
}

export async function completeDnseOAuthLink(args: {
  userId: string;
  code: string;
  codeVerifier: string;
  fallbackAccountId?: string | null;
}) {
  const token = await exchangeDnseAuthorizationCode(args.code, args.codeVerifier);
  const profile = await fetchDnseAccountProfile({
    accessToken: token.accessToken,
    accountId: args.fallbackAccountId ?? "",
    userId: args.userId,
  }).catch(() => null);
  const identity = resolveAccountIdentity({
    token,
    profile,
    fallbackAccountId: args.fallbackAccountId ?? null,
  });

  if (!identity.accountId) {
    throw new Error("Không xác định được số tài khoản DNSE từ luồng OAuth");
  }

  const connection = await saveConnectionForUser({
    userId: args.userId,
    accountId: identity.accountId,
    accountName: identity.accountName,
    subAccountId: identity.subAccountId,
    token,
    metadata: profile?.raw ?? token.raw,
  });

  await writeDnseExecutionAudit({
    action: "oauth_link_success",
    description: "DNSE OAuth linked successfully",
    actorUserId: args.userId,
    targetUserId: args.userId,
    payload: {
      accountId: identity.accountId,
      linkedAt: toIsoNow(),
      tokenType: token.tokenType,
      scope: token.scope,
    },
  });

  return connection;
}

async function refreshConnectionToken(connection: ConnectionState) {
  if (!connection.refreshTokenEnc) {
    throw new Error("DNSE refresh token không tồn tại");
  }
  const refreshToken = decryptDnseToken(connection.refreshTokenEnc);
  const nextToken = await refreshDnseAccessToken(refreshToken);
  const updated = await saveConnectionForUser({
    userId: connection.userId,
    accountId: connection.accountId,
    accountName: connection.accountName,
    subAccountId: connection.subAccountId,
    token: nextToken,
    metadata: {
      previousMetadata: parseJson(connection.metadata),
      refreshedAt: toIsoNow(),
    },
  });

  await writeDnseExecutionAudit({
    action: "oauth_token_refreshed",
    description: "DNSE OAuth access token refreshed",
    actorUserId: connection.userId,
    targetUserId: connection.userId,
    payload: {
      accountId: connection.accountId,
      refreshedAt: toIsoNow(),
    },
  });

  return updated;
}

export async function ensureDnseAccessTokenForUser(userId: string) {
  const connection = await prisma.dnseConnection.findUnique({
    where: { userId },
  });
  if (!connection || connection.status !== "ACTIVE") {
    return null;
  }

  const expiresSoon =
    connection.accessTokenExpiresAt != null &&
    connection.accessTokenExpiresAt.getTime() < Date.now() + 60_000;

  let current = connection;
  try {
    if (expiresSoon) {
      current = await refreshConnectionToken(connection);
    }
    const accessToken = decryptDnseToken(current.accessTokenEnc);
    return {
      connection: current,
      accessToken,
    };
  } catch (error) {
    await prisma.dnseConnection.update({
      where: { userId },
      data: {
        lastError: error instanceof Error ? error.message : "refresh_failed",
      },
    });
    throw error;
  }
}

export async function unlinkDnseConnectionForUser(userId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.dnseConnection.deleteMany({
      where: { userId },
    });
    await tx.user.update({
      where: { id: userId },
      data: {
        dnseId: null,
        dnseVerified: false,
      },
    });
    await tx.dnseOAuthState.deleteMany({
      where: { userId },
    });
  });

  await writeDnseExecutionAudit({
    action: "oauth_link_removed",
    description: "DNSE OAuth connection removed by user",
    actorUserId: userId,
    targetUserId: userId,
    payload: {
      removedAt: toIsoNow(),
    },
  });
}
