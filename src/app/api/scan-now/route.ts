import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getVNDateISO, logCron } from "@/lib/cronHelpers";
import { invalidateTopics } from "@/lib/datahub/core";
import { getPythonBridgeUrl } from "@/lib/runtime-config";
import { runDnseMarketDataCoverageCheck } from "@/lib/providers/dnse/market-data";
import { ingestSignalScanBatch } from "@/lib/signals/ingest";
import { sendClaimedSignalsToTelegram } from "@/lib/signals/telegram-notify";

export const dynamic = "force-dynamic";

const BACKEND = getPythonBridgeUrl();

interface ScannerSignal {
  ticker: string;
  type: "SIEU_CO_PHIEU" | "TRUNG_HAN" | "DAU_CO" | "TAM_NGAM";
  entryPrice: number;
  reason?: string;
}

/**
 * POST /api/scan-now
 *
 * Manual scanner entrypoint. It must use the same deterministic ingest path as
 * cron/webhook so ADN Radar, DataHub and notifications read one artifact.
 */
export async function POST() {
  const startedAt = Date.now();
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch(`${BACKEND}/api/v1/scan-now`, {
      method: "POST",
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[/api/scan-now] Backend error:", res.status, text);
      await logCron("signal_scan_type1", "error", `Manual scanner HTTP ${res.status}`, Date.now() - startedAt, {
        responseText: text.slice(0, 500),
      });
      return NextResponse.json({ error: "Lỗi quét tín hiệu" }, { status: 502 });
    }

    const data = (await res.json()) as { detected?: number; signals?: ScannerSignal[] };
    const signals = Array.isArray(data.signals) ? data.signals : [];
    const dnseShadow =
      process.env.DNSE_SHADOW_VALIDATE_ON_SCAN === "true"
        ? await runDnseMarketDataCoverageCheck({
            tickers: Array.from(
              new Set(
                signals
                  .map((signal) => signal.ticker.toUpperCase().trim())
                  .filter((ticker): ticker is string => Boolean(ticker)),
              ),
            ),
            thresholdPct: 95,
            concurrency: 6,
            limit: 80,
          }).catch((error) => ({
            provider: "dnse" as const,
            checkedAt: new Date().toISOString(),
            requested: signals.length,
            covered: 0,
            coveragePct: 0,
            thresholdPct: 95,
            passed: false,
            missing: signals.map((signal) => signal.ticker).slice(0, 80),
            durationMs: 0,
            error: error instanceof Error ? error.message : String(error),
          }))
        : null;
    const tradingDate = getVNDateISO();
    const ingest = await ingestSignalScanBatch({
      signals,
      detected: Number.isFinite(data.detected) ? Number(data.detected) : signals.length,
      tradingDate,
      slot: "manual",
      slotLabel: "manual",
      source: "manual",
      scannedAt: new Date(),
    });

    invalidateTopics({ tags: ["signal", "signal-scan", "broker", "portfolio"] });

    await sendClaimedSignalsToTelegram({
      signals: ingest.artifact.notifiedSignals,
      tradingDate,
      slotLabel: "manual",
      batchId: ingest.artifact.batchId,
    });

    await logCron(
      "signal_scan_type1",
      "success",
      `Manual scan: ${ingest.created} created, ${ingest.updated} updated, ${ingest.notified.length} notified`,
      Date.now() - startedAt,
      {
        scanned: signals.length,
        accepted: ingest.accepted,
        processed: ingest.processed.length,
        created: ingest.created,
        updated: ingest.updated,
        notified: ingest.notified.length,
        batchId: ingest.artifact.batchId,
        dnseShadow,
        scanArtifact: ingest.artifact,
      },
    );

    return NextResponse.json({
      detected: ingest.detected,
      accepted: ingest.accepted,
      synced: ingest.created + ingest.updated,
      created: ingest.created,
      updated: ingest.updated,
      notified: ingest.notified.length,
      batchId: ingest.artifact.batchId,
      dnseShadowPassed: dnseShadow?.passed ?? null,
      signals: ingest.artifact.signals,
      notifiedSignals: ingest.artifact.notifiedSignals,
      message: `${ingest.created} mới, ${ingest.updated} cập nhật`,
    });
  } catch (err) {
    console.error("[/api/scan-now] Error:", err);
    await logCron("signal_scan_type1", "error", String(err), Date.now() - startedAt);
    return NextResponse.json({ error: "Không kết nối được scanner" }, { status: 502 });
  }
}
