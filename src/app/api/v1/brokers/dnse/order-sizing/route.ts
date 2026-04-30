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

    const [balanceResult, positionsResult, loanPackagesResult, ppseResult] = await Promise.all([
      firstSuccess(candidates, (accountNo) => client.getBalance(accountNo)),
      firstSuccess(candidates, (accountNo) => client.getPositions(accountNo)),
      firstSuccess(candidates, (accountNo) => client.getLoanPackages(accountNo, "STOCK", ticker)),
      firstSuccess(candidates, (accountNo) =>
        client.getPPSE(accountNo, ticker, {
          marketType: "STOCK",
          price: price ?? undefined,
          loanPackageId: body.loanPackageId && body.loanPackageId !== "CASH" ? body.loanPackageId : undefined,
        }),
      ),
    ]);

    if (balanceResult.error) warnings.push("Chưa đọc được tổng tài sản ròng mới nhất.");
    if (positionsResult.error) warnings.push("Chưa đọc được danh mục nắm giữ mới nhất.");
    if (loanPackagesResult.error) warnings.push("Chưa đọc được danh sách gói giao dịch mới nhất.");
    if (ppseResult.error) warnings.push("Chưa đọc được sức mua/sức bán theo mã ở thời điểm hiện tại.");

    const balance = balanceResult.value;
    const positions = Array.isArray(positionsResult.value) ? positionsResult.value : [];
    const ppse = ppseResult.value;

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
      dnseMaxBuyQty,
      dnseMaxSellQty,
      recommendedNavPct: navPct,
      fallbackNavPct: 5,
    });

    const packageRows = extractArrayPayload(loanPackagesResult.value);
    const loanPackages = normalizeLoanPackageRows(packageRows);
    const selectedLoanPackageId =
      body.loanPackageId && loanPackages.some((item) => item.loanPackageId === body.loanPackageId)
        ? body.loanPackageId
        : loanPackages[0]?.loanPackageId ?? "CASH";

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
