import { prisma } from "@/lib/prisma";
import { getBatchPrices } from "@/lib/PriceCache";
import { getPythonBridgeUrl } from "@/lib/runtime-config";
import { getVnDateISO, getVnNow, isVnTradingDay, toVnTime } from "@/lib/time";
import { pushNotification } from "@/lib/cronHelpers";
import { normalizeSignalPrice } from "@/lib/signals/price-units";
import { invalidateTopics } from "@/lib/datahub/core";

export const RADAR_PAPER_INITIAL_NAV = 1_000_000_000;
const ACCOUNT_SLUG = "adn-radar";
const MAX_UNIQUE_POSITIONS = 10;
const MID_TERM_MIN_NAV_PCT = 20;
const SWING_MIN_NAV_PCT = 9;
const MID_TERM_MAX_PCT = 60;
const SWING_MAX_PCT = 30;
const MIN_CASH_NAV_PCT = 10;
const HOLD_TO_DIE_THRESHOLD = 20;
const ART_EXIT_THRESHOLD = 4.8;
const PYTHON_BRIDGE = getPythonBridgeUrl();

type SignalLike = {
  id: string;
  ticker: string;
  type: string;
  status: string;
  tier: string;
  entryPrice: number;
  target: number | null;
  stoploss: number | null;
  currentPrice: number | null;
  navAllocation: number;
  winRate: number | null;
  rrRatio: string | null;
  restoredOpenedAt?: Date;
  restoredCurrentPrice?: number | null;
};

type OpenPosition = {
  id: string;
  ticker: string;
  tier: string;
  status: string;
  quantity: number;
  costBasis: number;
  marketValue: number | null;
};

function round2(value: number) {
  return Number.isFinite(value) ? +value.toFixed(2) : 0;
}

function isValidPrice(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isMidTermTier(tier: string | null | undefined) {
  return tier === "LEADER" || tier === "TRUNG_HAN";
}

function isSwingTier(tier: string | null | undefined) {
  return tier === "NGAN_HAN" || tier === "DAU_CO";
}

function recommendedNavPct(signal: Pick<SignalLike, "navAllocation">) {
  const nav = Number(signal.navAllocation ?? 0);
  return Number.isFinite(nav) ? nav : 0;
}

function minimumNavPctForTier(tier: string | null | undefined) {
  if (isMidTermTier(tier)) return MID_TERM_MIN_NAV_PCT;
  if (isSwingTier(tier)) return SWING_MIN_NAV_PCT;
  return Number.POSITIVE_INFINITY;
}

function isEligibleNavForTier(signal: Pick<SignalLike, "tier" | "navAllocation">) {
  return recommendedNavPct(signal) >= minimumNavPctForTier(signal.tier);
}

function inferExchangeForTicker(ticker: string) {
  const symbol = ticker.toUpperCase().trim();
  const hnx = new Set([
    "ACB", "BVS", "CEO", "DTD", "DHT", "HUT", "IDC", "IDJ", "IPA", "LAS", "MBS", "MVB", "NTP", "PVB",
    "PVS", "SHS", "TNG", "TVC", "VC3", "VCG", "VCS", "VIG", "VNR",
  ]);
  const upcom = new Set([
    "ABI", "BSR", "CTR", "DDV", "FOX", "GEG", "GVR", "MCH", "MML", "MSR", "OIL", "PAT", "QNS", "SIP",
    "VGI", "VGT", "VTP",
  ]);
  if (hnx.has(symbol)) return "HNX";
  if (upcom.has(symbol)) return "UPCOM";
  return "HOSE";
}

function addTradingDays(from: Date, days: number) {
  let cursor = toVnTime(from);
  let added = 0;
  while (added < days) {
    cursor = cursor.add(1, "day");
    if (isVnTradingDay(cursor.toDate())) added += 1;
  }
  return cursor.hour(13).minute(0).second(0).millisecond(0).toDate();
}

export function isExchangeSellOpen(exchange: string, at = new Date()) {
  if (!isVnTradingDay(at)) return false;
  const now = toVnTime(at);
  const minute = now.hour() * 60 + now.minute();
  const ex = exchange.toUpperCase();
  if (ex === "UPCOM") return minute >= 9 * 60 && minute <= 15 * 60;
  if (ex === "HNX") return minute >= 9 * 60 && minute <= 14 * 60 + 45;
  return minute >= 9 * 60 + 15 && minute <= 14 * 60 + 45;
}

function isPositionSellable(position: { exchange: string; sellableAt: Date }, at = new Date()) {
  return at.getTime() >= position.sellableAt.getTime() && isExchangeSellOpen(position.exchange, at);
}

function portfolioValues(positions: OpenPosition[]) {
  let mid = 0;
  let swing = 0;
  let total = 0;
  for (const position of positions) {
    const value = position.marketValue ?? position.costBasis;
    total += value;
    if (isMidTermTier(position.tier)) mid += value;
    if (isSwingTier(position.tier)) swing += value;
  }
  return { mid, swing, total };
}

function passesAllocationCapsAfterBuy(positions: OpenPosition[], nextTier: string, nextValue: number, totalNav: number) {
  if (totalNav <= 0) return false;
  const current = portfolioValues(positions);
  const invested = current.total + nextValue;
  const mid = current.mid + (isMidTermTier(nextTier) ? nextValue : 0);
  const swing = current.swing + (isSwingTier(nextTier) ? nextValue : 0);
  return (
    (mid / totalNav) * 100 <= MID_TERM_MAX_PCT &&
    (swing / totalNav) * 100 <= SWING_MAX_PCT &&
    (invested / totalNav) * 100 <= 100 - MIN_CASH_NAV_PCT
  );
}

function isPortfolioWithinCaps(positions: OpenPosition[], cash: number, totalNav: number) {
  if (totalNav <= 0) return false;
  const values = portfolioValues(positions);
  return (
    positions.length <= MAX_UNIQUE_POSITIONS &&
    new Set(positions.map((position) => position.ticker.toUpperCase())).size === positions.length &&
    positions.every((position) => position.tier !== "TAM_NGAM") &&
    (values.mid / totalNav) * 100 <= MID_TERM_MAX_PCT &&
    (values.swing / totalNav) * 100 <= SWING_MAX_PCT &&
    (values.total / totalNav) * 100 <= 100 - MIN_CASH_NAV_PCT &&
    (cash / totalNav) * 100 >= MIN_CASH_NAV_PCT
  );
}

function needsPaperAccountReseed(positions: OpenPosition[], cash: number) {
  if (positions.length === 0) return false;
  const invested = positions.reduce((sum, position) => sum + (position.marketValue ?? position.costBasis), 0);
  const totalNav = cash + invested;
  return (
    positions.some((position) => !Number.isInteger(position.quantity) || position.quantity <= 0 || position.quantity % 100 !== 0) ||
    !isPortfolioWithinCaps(positions, cash, totalNav)
  );
}

async function restorableReseededMidTermSignals(accountId: string, existingTickers = new Set<string>()) {
  const oldPositions = await prisma.radarPaperPosition.findMany({
    where: {
      accountId,
      status: "RESEEDED",
      tier: { in: ["LEADER", "TRUNG_HAN"] },
      signalId: { not: null },
    },
    orderBy: [{ openedAt: "asc" }, { updatedAt: "asc" }],
    select: {
      signalId: true,
      ticker: true,
      navAllocation: true,
      entryPrice: true,
      currentPrice: true,
      target: true,
      stoploss: true,
      openedAt: true,
    },
  });
  const signalIds = [...new Set(oldPositions.map((row) => row.signalId).filter((id): id is string => Boolean(id)))];
  if (signalIds.length === 0) return [];

  const signals = await prisma.signal.findMany({
    where: {
      id: { in: signalIds },
      status: { in: ["ACTIVE", "HOLD_TO_DIE"] },
      tier: { in: ["LEADER", "TRUNG_HAN"] },
    },
  });
  const signalById = new Map(signals.map((row) => [row.id, row]));
  const seen = new Set([...existingTickers].map((ticker) => ticker.toUpperCase()));
  const result: SignalLike[] = [];
  for (const oldPosition of oldPositions) {
    if (!oldPosition.signalId) continue;
    const signal = signalById.get(oldPosition.signalId);
    const restoreNavPct = Number(oldPosition.navAllocation ?? 0);
    if (!signal || restoreNavPct < MID_TERM_MIN_NAV_PCT) continue;
    const ticker = signal.ticker.toUpperCase().trim();
    if (seen.has(ticker)) continue;
    const price = normalizeSignalPrice(oldPosition.entryPrice) ?? normalizeSignalPrice(signal.entryPrice);
    if (!isValidPrice(price)) continue;
    seen.add(ticker);
    result.push({
      ...signal,
      entryPrice: price,
      target: normalizeSignalPrice(signal.target) ?? normalizeSignalPrice(oldPosition.target),
      stoploss: normalizeSignalPrice(signal.stoploss) ?? normalizeSignalPrice(oldPosition.stoploss),
      currentPrice: normalizeSignalPrice(signal.currentPrice) ?? normalizeSignalPrice(oldPosition.currentPrice) ?? price,
      navAllocation: restoreNavPct,
      restoredOpenedAt: oldPosition.openedAt,
      restoredCurrentPrice: normalizeSignalPrice(signal.currentPrice) ?? normalizeSignalPrice(oldPosition.currentPrice) ?? price,
    });
  }
  return result;
}

async function hasRestorableReseededMidTerm(accountId: string, positions: OpenPosition[], cash: number) {
  const invested = positions.reduce((sum, position) => sum + (position.marketValue ?? position.costBasis), 0);
  const totalNav = cash + invested;
  const existingTickers = new Set(positions.map((position) => position.ticker.toUpperCase()));
  const candidates = await restorableReseededMidTermSignals(accountId, existingTickers);
  return candidates.some((signal) => {
    const navPct = recommendedNavPct(signal);
    const price = normalizeSignalPrice(signal.entryPrice);
    if (!isValidPrice(price)) return false;
    const orderValue = totalNav * (navPct / 100);
    const quantity = Math.floor(orderValue / price / 100) * 100;
    const grossValue = round2(quantity * price);
    if (quantity <= 0) return false;
    return grossValue <= cash && passesAllocationCapsAfterBuy(positions, signal.tier, grossValue, totalNav);
  });
}

async function getOrCreateAccount() {
  const existing = await prisma.radarPaperAccount.findUnique({ where: { slug: ACCOUNT_SLUG } });
  if (existing) return existing;
  return prisma.radarPaperAccount.create({
    data: {
      slug: ACCOUNT_SLUG,
      initialNav: RADAR_PAPER_INITIAL_NAV,
      cash: RADAR_PAPER_INITIAL_NAV,
      realizedPnl: 0,
      status: "ACTIVE",
    },
  });
}

async function activePositions(accountId: string) {
  return prisma.radarPaperPosition.findMany({
    where: { accountId, status: { in: ["ACTIVE", "HOLD_TO_DIE", "PENDING_EXIT"] } },
    orderBy: [{ openedAt: "asc" }],
  });
}

async function accountTotalNav(accountId: string, cash: number) {
  const positions = await activePositions(accountId);
  const invested = positions.reduce((sum, row) => sum + (row.marketValue ?? row.costBasis), 0);
  return cash + invested;
}

async function buyPaperPosition(params: {
  accountId: string;
  signal: SignalLike;
  price: number;
  navPct: number;
  reason: string;
  now?: Date;
  currentPrice?: number | null;
}) {
  const now = params.now ?? new Date();
  const account = await prisma.radarPaperAccount.findUnique({ where: { id: params.accountId } });
  if (!account) throw new Error("radar_paper_account_missing");
  const totalNav = await accountTotalNav(account.id, account.cash);
  const orderValue = totalNav * (params.navPct / 100);
  const quantity = Math.floor(orderValue / params.price / 100) * 100;
  const grossValue = round2(quantity * params.price);
  if (quantity <= 0 || grossValue > account.cash) {
    return null;
  }
  const currentPrice = normalizeSignalPrice(params.currentPrice) ?? params.price;
  const marketValue = round2(quantity * currentPrice);
  const currentPnlValue = round2(marketValue - grossValue);
  const currentPnl = grossValue > 0 ? round2((currentPnlValue / grossValue) * 100) : 0;
  const exchange = inferExchangeForTicker(params.signal.ticker);
  const sellableAt = addTradingDays(now, 2);
  const created = await prisma.radarPaperPosition.create({
    data: {
      accountId: account.id,
      signalId: params.signal.id,
      ticker: params.signal.ticker.toUpperCase().trim(),
      exchange,
      signalType: params.signal.type,
      tier: params.signal.tier,
      status: "ACTIVE",
      entryPrice: params.price,
      quantity,
      costBasis: grossValue,
      navAllocation: round2((grossValue / totalNav) * 100),
      target: normalizeSignalPrice(params.signal.target),
      stoploss: normalizeSignalPrice(params.signal.stoploss),
      currentPrice,
      marketValue,
      currentPnl,
      currentPnlValue,
      maxPnl: Math.max(0, currentPnl),
      openedAt: now,
      sellableAt,
    },
  });
  await prisma.$transaction([
    prisma.radarPaperAccount.update({
      where: { id: account.id },
      data: { cash: round2(account.cash - grossValue) },
    }),
    prisma.radarPaperTrade.create({
      data: {
        accountId: account.id,
        positionId: created.id,
        signalId: params.signal.id,
        ticker: created.ticker,
        exchange,
        side: "BUY",
        price: params.price,
        quantity,
        grossValue,
        reason: params.reason,
        tradedAt: now,
      },
    }),
    prisma.signal.update({
      where: { id: params.signal.id },
      data: { status: "ACTIVE", entryPrice: params.price, currentPrice, currentPnl },
    }),
  ]);
  return created;
}

export async function ensureRadarPaperAccountSeeded() {
  const account = await getOrCreateAccount();
  const existingPositions = await activePositions(account.id);
  if (
    account.seededAt &&
    !needsPaperAccountReseed(existingPositions, account.cash) &&
    !(await hasRestorableReseededMidTerm(account.id, existingPositions, account.cash))
  ) {
    return account;
  }
  if (existingPositions.length > 0) {
    await prisma.$transaction([
      prisma.radarPaperPosition.updateMany({
        where: { accountId: account.id, status: { in: ["ACTIVE", "HOLD_TO_DIE", "PENDING_EXIT"] } },
        data: { status: "RESEEDED", holdingAction: "RESEEDED_BY_POLICY" },
      }),
      prisma.radarPaperAccount.update({
        where: { id: account.id },
        data: { cash: RADAR_PAPER_INITIAL_NAV, realizedPnl: 0, seededAt: null },
      }),
    ]);
  }

  const reseededMidTermCandidates = await restorableReseededMidTermSignals(account.id);
  const restoredSignalIds = new Set(reseededMidTermCandidates.map((row) => row.id));
  const candidates = await prisma.signal.findMany({
    where: {
      status: { in: ["ACTIVE", "HOLD_TO_DIE"] },
      tier: { not: "TAM_NGAM" },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: 120,
  });
  const seen = new Set<string>();
  const uniqueCandidates = candidates
    .filter((row) => {
      const ticker = row.ticker.toUpperCase().trim();
      if (seen.has(ticker)) return false;
      seen.add(ticker);
      return isEligibleNavForTier(row);
    });
  const sortByNav = (a: Pick<SignalLike, "navAllocation">, b: Pick<SignalLike, "navAllocation">) =>
    recommendedNavPct(b) - recommendedNavPct(a);
  const sorted = [
    ...reseededMidTermCandidates,
    ...uniqueCandidates.filter((row) => isMidTermTier(row.tier) && !restoredSignalIds.has(row.id)).sort(sortByNav),
    ...uniqueCandidates.filter((row) => isSwingTier(row.tier)).sort(sortByNav),
  ];

  let cash = existingPositions.length > 0 ? RADAR_PAPER_INITIAL_NAV : account.cash;
  const seeded: OpenPosition[] = [];
  for (const row of sorted) {
    const signal = row as SignalLike;
    if (seeded.length >= MAX_UNIQUE_POSITIONS) break;
    const navPct = recommendedNavPct(signal);
    const price = signal.restoredOpenedAt
      ? normalizeSignalPrice(signal.entryPrice)
      : normalizeSignalPrice(signal.currentPrice) ?? normalizeSignalPrice(signal.entryPrice);
    if (!isValidPrice(price)) continue;
    const grossValue = RADAR_PAPER_INITIAL_NAV * (navPct / 100);
    if (grossValue > cash || !passesAllocationCapsAfterBuy(seeded, signal.tier, grossValue, RADAR_PAPER_INITIAL_NAV)) continue;
    const created = await buyPaperPosition({
      accountId: account.id,
      signal,
      price,
      navPct,
      reason: signal.restoredOpenedAt ? "restore_from_reseeded_mid_term" : "seed_from_current_active",
      now: signal.restoredOpenedAt,
      currentPrice: signal.restoredCurrentPrice,
    });
    if (!created) continue;
    cash -= created.costBasis;
    seeded.push({
      id: created.id,
      ticker: created.ticker,
      tier: created.tier,
      status: created.status,
      quantity: created.quantity,
      costBasis: created.costBasis,
      marketValue: created.marketValue,
    });
  }
  return prisma.radarPaperAccount.update({ where: { id: account.id }, data: { seededAt: new Date() } });
}

export async function tryActivateRadarSignal(signal: SignalLike, currentPrice?: number) {
  const account = await ensureRadarPaperAccountSeeded();
  if (signal.tier === "TAM_NGAM" || signal.type === "TAM_NGAM") {
    return { activated: false, reason: "tam_ngam_blocked" };
  }
  const openRows = await activePositions(account.id);
  const openTickers = new Set(openRows.map((row) => row.ticker.toUpperCase()));
  const ticker = signal.ticker.toUpperCase().trim();
  if (openTickers.has(ticker)) return { activated: false, reason: "duplicate_ticker" };
  if (openTickers.size >= MAX_UNIQUE_POSITIONS) return { activated: false, reason: "max_10_unique_tickers" };

  const navPct = Number(signal.navAllocation ?? 0);
  if (!Number.isFinite(navPct) || navPct < minimumNavPctForTier(signal.tier)) {
    return { activated: false, reason: isMidTermTier(signal.tier) ? "nav_under_20pct" : "nav_under_9pct" };
  }
  const price = normalizeSignalPrice(currentPrice) ?? normalizeSignalPrice(signal.currentPrice) ?? normalizeSignalPrice(signal.entryPrice);
  if (!isValidPrice(price)) return { activated: false, reason: "missing_market_price" };

  const totalNav = await accountTotalNav(account.id, account.cash);
  const orderValue = totalNav * (navPct / 100);
  if (orderValue < totalNav * (minimumNavPctForTier(signal.tier) / 100) || orderValue > account.cash) {
    return { activated: false, reason: "order_value_blocked" };
  }
  if (!passesAllocationCapsAfterBuy(openRows, signal.tier, orderValue, totalNav)) {
    return { activated: false, reason: "allocation_cap_60_30_cash10_blocked" };
  }
  const created = await buyPaperPosition({
    accountId: account.id,
    signal,
    price,
    navPct,
    reason: "radar_active_gate_passed",
  });
  if (!created) return { activated: false, reason: "order_size_blocked" };
  await invalidateTopics({ topics: ["signal:map:latest"], tags: ["signal"] });
  return { activated: true, reason: "paper_buy_created", positionId: created.id };
}

async function fetchARTBatch(tickers: string[]) {
  if (tickers.length === 0) return {};
  try {
    const res = await fetch(`${PYTHON_BRIDGE}/api/v1/batch-tei`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-FiinQuant-User": process.env.FIINQUANT_USER ?? "",
        "X-FiinQuant-Pass": process.env.FIINQUANT_PASS ?? "",
      },
      body: JSON.stringify({ tickers }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return {};
    const data = await res.json();
    return (data.results ?? {}) as Record<string, { tei?: number; sentiment?: string }>;
  } catch (error) {
    console.error("[RadarPaper] ART fetch failed:", error);
    return {};
  }
}

function trailingStopPct(maxPnl: number) {
  if (maxPnl < HOLD_TO_DIE_THRESHOLD) return 0;
  if (maxPnl < 30) return 15;
  return round2(maxPnl - 10);
}

async function closePosition(position: Awaited<ReturnType<typeof activePositions>>[number], price: number, reason: string, now: Date) {
  const account = await prisma.radarPaperAccount.findUnique({ where: { id: position.accountId } });
  if (!account) return;
  const grossValue = round2(position.quantity * price);
  const realizedPnl = round2(grossValue - position.costBasis);
  const realizedPnlPct = round2((realizedPnl / position.costBasis) * 100);
  await prisma.$transaction([
    prisma.radarPaperPosition.update({
      where: { id: position.id },
      data: {
        status: "CLOSED",
        currentPrice: price,
        marketValue: grossValue,
        currentPnl: realizedPnlPct,
        currentPnlValue: realizedPnl,
        closePrice: price,
        closeValue: grossValue,
        realizedPnl,
        realizedPnlPct,
        closedAt: now,
        pendingExitReason: null,
        pendingExitTriggeredAt: null,
        pendingExitPrice: null,
      },
    }),
    prisma.radarPaperAccount.update({
      where: { id: position.accountId },
      data: {
        cash: round2(account.cash + grossValue),
        realizedPnl: round2(account.realizedPnl + realizedPnl),
      },
    }),
    prisma.radarPaperTrade.create({
      data: {
        accountId: position.accountId,
        positionId: position.id,
        signalId: position.signalId,
        ticker: position.ticker,
        exchange: position.exchange,
        side: "SELL",
        price,
        quantity: position.quantity,
        grossValue,
        reason,
        tradedAt: now,
      },
    }),
    ...(position.signalId
      ? [
          prisma.signal.update({
            where: { id: position.signalId },
            data: {
              status: "CLOSED",
              closePrice: price,
              currentPrice: price,
              currentPnl: realizedPnlPct,
              pnl: realizedPnlPct,
              closedReason: reason,
              closedAt: now,
            },
          }),
        ]
      : []),
  ]);
  await pushNotification("radar_paper_exit", `ADN Radar ban ${position.ticker}`, `${reason}. Gia ban: ${price.toLocaleString("vi-VN")}. PnL: ${realizedPnlPct}%`);
}

async function markPendingExit(position: Awaited<ReturnType<typeof activePositions>>[number], price: number, reason: string, now: Date) {
  if (position.pendingExitReason) return;
  await prisma.radarPaperPosition.update({
    where: { id: position.id },
    data: {
      status: "PENDING_EXIT",
      pendingExitReason: reason,
      pendingExitTriggeredAt: now,
      pendingExitPrice: price,
      currentPrice: price,
      marketValue: round2(position.quantity * price),
      currentPnl: round2(((price - position.entryPrice) / position.entryPrice) * 100),
      currentPnlValue: round2(position.quantity * price - position.costBasis),
    },
  });
  await pushNotification("radar_paper_pending_exit", `ADN Radar kich hoat ban ${position.ticker}`, `${reason}. Gia thi truong ghi nhan: ${price.toLocaleString("vi-VN")}. Cho dung T+2.5/gio san de ban.`);
}

export async function syncRadarPaperAccountPrices(options: { slot?: "11:30" | "15:00" | "manual"; now?: Date } = {}) {
  const account = await ensureRadarPaperAccountSeeded();
  const now = options.now ?? new Date();
  const openRows = await activePositions(account.id);
  if (openRows.length === 0) {
    if (options.slot) await saveSnapshot(account.id, options.slot);
    return { processed: 0, closed: 0, pendingExits: 0, holdToDie: 0, snapshots: options.slot ? 1 : 0 };
  }

  const prices = await getBatchPrices([...new Set(openRows.map((row) => row.ticker))]);
  const holdTickers = openRows.filter((row) => row.status === "HOLD_TO_DIE").map((row) => row.ticker);
  const art = await fetchARTBatch([...new Set(holdTickers)]);
  let closed = 0;
  let pendingExits = 0;
  let holdToDie = 0;

  for (const position of openRows) {
    const price = normalizeSignalPrice(prices[position.ticker]?.close) ?? normalizeSignalPrice(position.currentPrice);
    if (!isValidPrice(price)) continue;
    const marketValue = round2(position.quantity * price);
    const pnlValue = round2(marketValue - position.costBasis);
    const pnl = round2((pnlValue / position.costBasis) * 100);
    const maxPnl = Math.max(position.maxPnl ?? 0, pnl);

    let nextStatus = position.status;
    let nextStoploss = position.stoploss;
    let exitReason: string | null = null;

    if (position.pendingExitReason) {
      exitReason = position.pendingExitReason;
    } else if (isMidTermTier(position.tier) && position.status === "ACTIVE" && pnl >= HOLD_TO_DIE_THRESHOLD) {
      const stopPct = trailingStopPct(maxPnl);
      nextStatus = "HOLD_TO_DIE";
      nextStoploss = round2(position.entryPrice * (1 + stopPct / 100));
      holdToDie++;
    } else if (position.status === "HOLD_TO_DIE") {
      const stopPct = trailingStopPct(maxPnl);
      const trailingStop = round2(position.entryPrice * (1 + stopPct / 100));
      nextStoploss = Math.max(position.stoploss ?? 0, trailingStop);
      if (price <= nextStoploss) exitReason = `Trailing stop ${nextStoploss.toLocaleString("vi-VN")}`;
      const artScore = Number(art[position.ticker]?.tei ?? 0);
      if (!exitReason && artScore >= ART_EXIT_THRESHOLD) exitReason = `ART ${artScore.toFixed(1)} >= ${ART_EXIT_THRESHOLD}`;
    } else {
      const stoploss = normalizeSignalPrice(position.stoploss);
      const target = normalizeSignalPrice(position.target);
      if (isValidPrice(stoploss) && price <= stoploss) exitReason = `Stoploss kich hoat ${stoploss.toLocaleString("vi-VN")}`;
      if (!exitReason && !isMidTermTier(position.tier) && isValidPrice(target) && price >= target) {
        exitReason = `Take Profit kich hoat ${target.toLocaleString("vi-VN")}`;
      }
    }

    if (exitReason) {
      if (isPositionSellable(position, now)) {
        await closePosition(position, price, exitReason, now);
        closed++;
      } else {
        await markPendingExit(position, price, exitReason, now);
        pendingExits++;
      }
      continue;
    }

    await prisma.radarPaperPosition.update({
      where: { id: position.id },
      data: {
        status: nextStatus,
        stoploss: nextStoploss,
        currentPrice: price,
        marketValue,
        currentPnl: pnl,
        currentPnlValue: pnlValue,
        maxPnl,
        holdingAction: nextStatus === "HOLD_TO_DIE" ? "HOLD_TO_DIE" : position.holdingAction,
      },
    });
    if (position.signalId) {
      await prisma.signal.update({
        where: { id: position.signalId },
        data: { status: nextStatus === "HOLD_TO_DIE" ? "HOLD_TO_DIE" : "ACTIVE", currentPrice: price, currentPnl: pnl, stoploss: nextStoploss },
      });
    }
  }

  if (options.slot) await saveSnapshot(account.id, options.slot);
  if (closed > 0 || pendingExits > 0 || holdToDie > 0) {
    await invalidateTopics({ topics: ["signal:map:latest"], tags: ["signal"] });
  }
  return { processed: openRows.length, closed, pendingExits, holdToDie, snapshots: options.slot ? 1 : 0 };
}

async function saveSnapshot(accountId: string, slot: string) {
  const account = await prisma.radarPaperAccount.findUnique({ where: { id: accountId } });
  if (!account) return null;
  const positions = await activePositions(accountId);
  const investedValue = round2(positions.reduce((sum, row) => sum + (row.marketValue ?? row.costBasis), 0));
  const costBasis = positions.reduce((sum, row) => sum + row.costBasis, 0);
  const unrealizedPnl = round2(investedValue - costBasis);
  const totalNav = round2(account.cash + investedValue);
  const totalPnl = round2(totalNav - account.initialNav);
  const totalPnlPct = round2((totalPnl / account.initialNav) * 100);
  const snapshotDate = getVnDateISO(new Date());
  return prisma.radarPaperSnapshot.upsert({
    where: { accountId_snapshotDate_slot: { accountId, snapshotDate, slot } },
    update: {
      cash: account.cash,
      investedValue,
      totalNav,
      unrealizedPnl,
      realizedPnl: account.realizedPnl,
      totalPnl,
      totalPnlPct,
      positionsJson: JSON.stringify(positions),
    },
    create: {
      accountId,
      snapshotDate,
      slot,
      cash: account.cash,
      investedValue,
      totalNav,
      unrealizedPnl,
      realizedPnl: account.realizedPnl,
      totalPnl,
      totalPnlPct,
      positionsJson: JSON.stringify(positions),
    },
  });
}

export async function getRadarPaperAccountPayload() {
  const account = await ensureRadarPaperAccountSeeded();
  const [positions, trades, latestSnapshot] = await Promise.all([
    prisma.radarPaperPosition.findMany({
      where: { accountId: account.id, status: { in: ["ACTIVE", "HOLD_TO_DIE", "PENDING_EXIT"] } },
      orderBy: [{ openedAt: "asc" }],
    }),
    prisma.radarPaperTrade.findMany({ where: { accountId: account.id }, orderBy: { tradedAt: "desc" }, take: 40 }),
    prisma.radarPaperSnapshot.findFirst({ where: { accountId: account.id }, orderBy: { createdAt: "desc" } }),
  ]);
  const signalIds = [...new Set(positions.map((row) => row.signalId).filter((id): id is string => Boolean(id)))];
  const signalById = new Map(
    signalIds.length > 0
      ? (await prisma.signal.findMany({
          where: { id: { in: signalIds } },
          select: {
            id: true,
            triggerSignal: true,
            aiReasoning: true,
            reason: true,
            rrRatio: true,
            winRate: true,
            sharpeRatio: true,
          },
        })).map((row) => [row.id, row])
      : [],
  );
  const invested = round2(positions.reduce((sum, row) => sum + (row.marketValue ?? row.costBasis), 0));
  const costBasis = positions.reduce((sum, row) => sum + row.costBasis, 0);
  const totalNav = round2(account.cash + invested);
  const unrealizedPnl = round2(invested - costBasis);
  const totalPnl = round2(totalNav - account.initialNav);
  const totalPnlPct = round2((totalPnl / account.initialNav) * 100);
  return {
    initialNav: account.initialNav,
    cash: account.cash,
    invested,
    totalNav,
    realizedPnl: account.realizedPnl,
    unrealizedPnl,
    totalPnl,
    totalPnlPct,
    positions: positions.map((row) => {
      const signal = row.signalId ? signalById.get(row.signalId) : null;
      return {
        id: row.id,
        signalId: row.signalId,
        ticker: row.ticker,
        exchange: row.exchange,
        signalType: row.signalType,
        tier: row.tier,
        status: row.status,
        entryPrice: row.entryPrice,
        currentPrice: row.currentPrice,
        quantity: row.quantity,
        costBasis: row.costBasis,
        marketValue: row.marketValue ?? row.costBasis,
        navPct: totalNav > 0 ? round2(((row.marketValue ?? row.costBasis) / totalNav) * 100) : 0,
        currentPnl: row.currentPnl,
        currentPnlValue: row.currentPnlValue,
        target: row.target,
        stoploss: row.stoploss,
        openedAt: row.openedAt.toISOString(),
        sellableAt: row.sellableAt.toISOString(),
        pendingExitReason: row.pendingExitReason,
        pendingExitTriggeredAt: row.pendingExitTriggeredAt?.toISOString() ?? null,
        pendingExitPrice: row.pendingExitPrice,
        holdingAction: row.holdingAction,
        triggerSignal: signal?.triggerSignal ?? null,
        aiReasoning: signal?.aiReasoning ?? null,
        reason: signal?.reason ?? null,
        rrRatio: signal?.rrRatio ?? null,
        winRate: signal?.winRate ?? null,
        sharpeRatio: signal?.sharpeRatio ?? null,
      };
    }),
    trades: trades.map((row) => ({
      id: row.id,
      ticker: row.ticker,
      exchange: row.exchange,
      side: row.side,
      price: row.price,
      quantity: row.quantity,
      grossValue: row.grossValue,
      reason: row.reason,
      tradedAt: row.tradedAt.toISOString(),
    })),
    latestSnapshot: latestSnapshot
      ? {
          snapshotDate: latestSnapshot.snapshotDate,
          slot: latestSnapshot.slot,
          cash: latestSnapshot.cash,
          investedValue: latestSnapshot.investedValue,
          totalNav: latestSnapshot.totalNav,
          totalPnl: latestSnapshot.totalPnl,
          totalPnlPct: latestSnapshot.totalPnlPct,
          createdAt: latestSnapshot.createdAt.toISOString(),
        }
      : null,
    pendingExits: positions
      .filter((row) => row.pendingExitReason)
      .map((row) => ({
        ticker: row.ticker,
        reason: row.pendingExitReason,
        triggeredAt: row.pendingExitTriggeredAt?.toISOString() ?? null,
        price: row.pendingExitPrice,
        sellableAt: row.sellableAt.toISOString(),
      })),
  };
}
