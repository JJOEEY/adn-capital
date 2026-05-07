import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTopicEnvelope } from "@/lib/datahub/core";
import { requireDnseAccountContext } from "@/app/api/dnse/_shared";
import { getDnseTradingClient } from "@/lib/providers/dnse/trading-client";
import {
  BALANCE_BUYING_POWER_KEYS,
  BALANCE_TOTAL_ASSET_KEYS,
  calculateOrderSizing,
  extractArrayPayload,
  extractAvailableSellQty,
  normalizeLoanPackageRows,
  normalizeOrderPrice,
  PPSE_BUYING_POWER_KEYS,
  PPSE_MAX_BUY_QTY_KEYS,
  PPSE_MAX_SELL_QTY_KEYS,
  PPSE_SELLING_POWER_KEYS,
  readBestPositiveNumber,
  toRecord,
  type DnseSizingSide,
} from "@/lib/brokers/dnse/order-sizing";

export const dynamic = "force-dynamic";

type SizingBody = {
  ticker?: string;
  side?: string;
  price?: number | string | null;
  orderType?: string;
  loanPackageId?: string | null;
  source?: string | null;
  signalId?: string | null;
  navPct?: number | string | null;
};

function parseBody(value: unknown): SizingBody {
  const row = toRecord(value) ?? {};
  return {
    ticker: typeof row.ticker === "string" ? row.ticker.trim().toUpperCase() : undefined,
    side: typeof row.side === "string" ? row.side.trim().toUpperCase() : undefined,
    price: typeof row.price === "number" || typeof row.price === "string" ? row.price : null,
    orderType: typeof row.orderType === "string" ? row.orderType.trim().toUpperCase() : "LO",
    loanPackageId:
      typeof row.loanPackageId === "string" && row.loanPackageId.trim()
        ? row.loanPackageId.trim()
        : null,
    source: typeof row.source === "string" ? row.source.trim().toLowerCase() : null,
    signalId: typeof row.signalId === "string" && row.signalId.trim() ? row.signalId.trim() : null,
    navPct: typeof row.navPct === "number" || typeof row.navPct === "string" ? row.navPct : null,
  };
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(
    typeof value === "string" ? value.trim().replace(",", ".") : value,
  );
  return Number.isFinite(parsed) ? parsed : null;
}

async function firstSuccess<T>(
  candidates: string[],
  run: (accountNo: string) => Promise<T>,
): Promise<{ accountNo: string | null; value: T | null; error: string | null }> {
  let lastError: string | null = null;
  for (const accountNo of candidates) {
    try {
      return { accountNo, value: await run(accountNo), error: null };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Không đọc được dữ liệu tài khoản.";
    }
  }
  return { accountNo: null, value: null, error: lastError };
}

async function firstUsefulSuccess<T>(
  candidates: string[],
  run: (accountNo: string) => Promise<T>,
  isUseful: (value: T) => boolean,
): Promise<{ accountNo: string | null; value: T | null; error: string | null }> {
  let lastError: string | null = null;
  let firstValue: { accountNo: string; value: T } | null = null;
  for (const accountNo of candidates) {
    try {
      const value = await run(accountNo);
      if (!firstValue) firstValue = { accountNo, value };
      if (isUseful(value)) return { accountNo, value, error: null };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "KhÃ´ng Ä‘á»c Ä‘Æ°á»£c dá»¯ liá»‡u tÃ i khoáº£n.";
    }
  }
  if (firstValue) return { ...firstValue, error: lastError };
  return { accountNo: null, value: null, error: lastError };
}

function isUsefulBalance(value: unknown) {
  const totalAsset = readBestPositiveNumber(value, BALANCE_TOTAL_ASSET_KEYS, null);
  const buyingPower = readBestPositiveNumber(value, BALANCE_BUYING_POWER_KEYS, null);
  return Boolean((totalAsset != null && totalAsset > 0) || (buyingPower != null && buyingPower > 0));
}

function positiveOrNull(value: number | null) {
  return value != null && value > 0 ? value : null;
}

function readWorkbenchPrice(value: unknown): number | null {
  const row = toRecord(value);
  const ta = toRecord(row?.ta);
  const realtime = toRecord(row?.realtime);
  return normalizeOrderPrice(
    ta?.currentPrice ??
      realtime?.currentPrice ??
      realtime?.close ??
      row?.currentPrice ??
      row?.price,
  );
}

async function readCurrentUserBrokerTopic(topic: string, userId: string): Promise<unknown | null> {
  try {
    const envelope = await getTopicEnvelope(topic, { userId });
    return envelope.error ? null : envelope.value;
  } catch {
    return null;
  }
}

function unwrapTopicPayload(value: unknown, key: string): unknown {
  const row = toRecord(value);
  return row && key in row ? row[key] : value;
}

export async function POST(req: NextRequest) {
  try {
    const resolved = await requireDnseAccountContext();
    if (!resolved.ok) return resolved.response;

    const body = parseBody(await req.json().catch(() => null));
    const ticker = (body.ticker ?? "").replace(/[^A-Z0-9]/g, "").slice(0, 10);
    if (!ticker) {
      return NextResponse.json({ error: "Vui lòng chọn mã cổ phiếu." }, { status: 400 });
    }

    const side: DnseSizingSide = body.side === "SELL" ? "SELL" : "BUY";
    const warnings: string[] = [];
    const signal =
      body.signalId
        ? await prisma.signal.findUnique({
            where: { id: body.signalId },
            select: {
              id: true,
              ticker: true,
              entryPrice: true,
              currentPrice: true,
              target: true,
              stoploss: true,
              navAllocation: true,
              status: true,
            },
          })
        : null;

    if (signal && signal.ticker.trim().toUpperCase() !== ticker) {
      warnings.push("Tín hiệu được chọn không trùng mã hiện tại, hệ thống chỉ dùng mã đang mở.");
    }

    let topicPrice: number | null = null;
    try {
      const workbench = await getTopicEnvelope(`research:workbench:${ticker}`, {
        userId: resolved.context.userId,
      });
      topicPrice = readWorkbenchPrice(workbench.value);
    } catch {
      topicPrice = null;
    }

    const price =
      normalizeOrderPrice(body.price) ??
      normalizeOrderPrice(signal?.entryPrice) ??
      normalizeOrderPrice(signal?.currentPrice) ??
      topicPrice;

    if (!price) {
      warnings.push("Chưa có giá tham chiếu phù hợp, vui lòng nhập giá đặt để hệ thống tính khối lượng.");
    }

    const client = getDnseTradingClient({
      userJwtToken: resolved.context.userJwtToken,
      isolated: true,
    });
    const candidates = resolved.context.accountCandidates.length
      ? resolved.context.accountCandidates
      : [resolved.context.brokerAccountNo];

    const [balanceResult, positionsResult, loanPackagesResult] = await Promise.all([
      firstUsefulSuccess(candidates, (accountNo) => client.getBalance(accountNo), isUsefulBalance),
      firstSuccess(candidates, (accountNo) => client.getPositions(accountNo)),
      firstSuccess(candidates, (accountNo) => client.getLoanPackages(accountNo, "STOCK", ticker)),
    ]);
    const directPositions = extractArrayPayload(positionsResult.value);
    const directPackageRows = extractArrayPayload(loanPackagesResult.value);
    const [balanceTopicValue, positionsTopicValue, holdingsTopicValue, loanPackagesTopicValue] = await Promise.all([
      isUsefulBalance(balanceResult.value)
        ? Promise.resolve(null)
        : readCurrentUserBrokerTopic("broker:dnse:current-user:balance", resolved.context.userId),
      directPositions.length
        ? Promise.resolve(null)
        : readCurrentUserBrokerTopic("broker:dnse:current-user:positions", resolved.context.userId),
      directPositions.length
        ? Promise.resolve(null)
        : readCurrentUserBrokerTopic("broker:dnse:current-user:holdings", resolved.context.userId),
      directPackageRows.length
        ? Promise.resolve(null)
        : readCurrentUserBrokerTopic("broker:dnse:current-user:loan-packages", resolved.context.userId),
    ]);
    const fallbackPositions = extractArrayPayload(positionsTopicValue).length
      ? extractArrayPayload(positionsTopicValue)
      : extractArrayPayload(holdingsTopicValue);
    const packageRows = directPackageRows.length
      ? directPackageRows
      : extractArrayPayload(loanPackagesTopicValue);
    const loanPackages = normalizeLoanPackageRows(packageRows);
    const preferredCashPackage =
      loanPackages.find((item) => item.isCash && item.loanPackageId !== "CASH") ??
      loanPackages.find((item) => item.loanPackageId !== "CASH") ??
      loanPackages[0];
    const selectedLoanPackageId =
      body.loanPackageId && loanPackages.some((item) => item.loanPackageId === body.loanPackageId)
        ? body.loanPackageId
        : preferredCashPackage?.loanPackageId ?? "CASH";
    const ppseResult = await firstSuccess(candidates, (accountNo) =>
      client.getPPSE(accountNo, ticker, {
        marketType: "STOCK",
        price: price ?? undefined,
        loanPackageId: selectedLoanPackageId !== "CASH" ? selectedLoanPackageId : undefined,
      }),
    );
    const ppseTopicValue = ppseResult.value
      ? null
      : await readCurrentUserBrokerTopic(`broker:dnse:current-user:ppse:${ticker}`, resolved.context.userId);
    const brokerWarningStart = warnings.length;

    if (balanceResult.error) warnings.push("Chưa đọc được tổng tài sản ròng mới nhất.");
    if (positionsResult.error) warnings.push("Chưa đọc được danh mục nắm giữ mới nhất.");
    if (loanPackagesResult.error) warnings.push("Chưa đọc được danh sách gói giao dịch mới nhất.");
    if (ppseResult.error) warnings.push("Chưa đọc được sức mua/sức bán theo mã ở thời điểm hiện tại.");

    const balance = isUsefulBalance(balanceResult.value) ? balanceResult.value : balanceTopicValue;
    const positions = directPositions.length ? directPositions : fallbackPositions;
    const ppse = ppseResult.value ?? unwrapTopicPayload(ppseTopicValue, "ppse");
    warnings.splice(brokerWarningStart);
    if (balanceResult.error && !isUsefulBalance(balance)) warnings.push("Chưa đọc được tổng tài sản ròng mới nhất.");
    if (positionsResult.error && positions.length === 0) warnings.push("Chưa đọc được danh mục nắm giữ mới nhất.");
    if (loanPackagesResult.error && packageRows.length === 0) warnings.push("Chưa đọc được danh sách gói giao dịch mới nhất.");
    if (ppseResult.error && !ppse) warnings.push("Chưa đọc được sức mua/sức bán theo mã ở thời điểm hiện tại.");

    const totalAsset =
      readBestPositiveNumber(balance, BALANCE_TOTAL_ASSET_KEYS, null) ??
      readBestPositiveNumber(balance, ["totalAsset", "netAssetValue"], null);
    const buyingPower =
      readBestPositiveNumber(ppse, PPSE_BUYING_POWER_KEYS, null) ??
      readBestPositiveNumber(balance, BALANCE_BUYING_POWER_KEYS, null);
    const sellingPower = readBestPositiveNumber(ppse, PPSE_SELLING_POWER_KEYS, null);
    const dnseMaxBuyQty = readBestPositiveNumber(ppse, PPSE_MAX_BUY_QTY_KEYS, null);
    const dnseMaxSellQty = readBestPositiveNumber(ppse, PPSE_MAX_SELL_QTY_KEYS, null);
    const availableSellQty = extractAvailableSellQty(positions, ticker);
    const navPct =
      toFiniteNumber(body.navPct) ??
      (signal && signal.ticker.trim().toUpperCase() === ticker ? signal.navAllocation : null);
    const sizing = calculateOrderSizing({
      side,
      price,
      totalAsset,
      buyingPower,
      sellingPower,
      availableSellQty,
      dnseMaxBuyQty: positiveOrNull(dnseMaxBuyQty),
      dnseMaxSellQty: positiveOrNull(dnseMaxSellQty),
      recommendedNavPct: navPct,
      fallbackNavPct: 5,
    });

    const accountNo =
      ppseResult.accountNo ??
      balanceResult.accountNo ??
      positionsResult.accountNo ??
      resolved.context.brokerAccountNo;

    return NextResponse.json({
      success: true,
      sizing: {
        ticker,
        side,
        accountNo,
        orderType: body.orderType ?? "LO",
        selectedLoanPackageId,
        loanPackages,
        price: sizing.price,
        displayPrice: sizing.displayPrice,
        totalAsset: sizing.totalAsset,
        buyingPower: sizing.buyingPower,
        sellingPower: sizing.sellingPower,
        buyMaxQuantity: sizing.buyMaxQuantity,
        sellMaxQuantity: sizing.sellMaxQuantity,
        recommendedQuantity: sizing.recommendedQuantity,
        recommendedValue: sizing.recommendedValue,
        recommendedNavPct: sizing.recommendedNavPct,
        target: signal?.target ?? null,
        stoploss: signal?.stoploss ?? null,
        source: body.source ?? "direct",
        warnings: Array.from(new Set(warnings)),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể tính khối lượng đặt lệnh.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
