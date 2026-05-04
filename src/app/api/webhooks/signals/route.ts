/**
 * POST /api/webhooks/signals
 *
 * Scanner bridge chi gui raw payload vao web. Web la noi normalize, upsert,
 * dedupe, ghi scan artifact va invalidate DataHub truoc khi cac kenh publish doc.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSignalWindowInfo, getVNDateISO, logCron, pushNotification } from "@/lib/cronHelpers";
import { invalidateTopics } from "@/lib/datahub/core";
import { ingestSignalScanBatch } from "@/lib/signals/ingest";
import { sendClaimedSignalsToTelegram } from "@/lib/signals/telegram-notify";
import { emitWorkflowTrigger } from "@/lib/workflows";

const WEBHOOK_SECRET = process.env.SCANNER_SECRET ?? "adn-scanner-secret-key";

interface IncomingSignal {
  ticker: string;
  type: "SIEU_CO_PHIEU" | "TRUNG_HAN" | "DAU_CO" | "TAM_NGAM";
  entryPrice: number;
  reason?: string;
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  try {
    const body = (await req.json()) as {
      signals?: IncomingSignal[];
      detected?: number;
      secret?: string;
      slot?: string;
      slotLabel?: string;
    };

    if (body.secret !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawSignals = Array.isArray(body.signals) ? body.signals : [];
    if (rawSignals.length === 0) {
      return NextResponse.json({ saved: 0, updated: 0, message: "Khong co tin hieu" });
    }

    const now = new Date();
    const windowInfo = getSignalWindowInfo(now, "type1");
    const slot = body.slot ?? windowInfo.label;
    const slotLabel = body.slotLabel ?? slot;
    const tradingDate = getVNDateISO();

    const ingest = await ingestSignalScanBatch({
      signals: rawSignals,
      detected: body.detected ?? rawSignals.length,
      tradingDate,
      slot,
      slotLabel,
      source: "webhook",
      scannedAt: now,
    });

    const notifiedSignals = ingest.artifact.notifiedSignals;
    if (notifiedSignals.length > 0) {
      const signalText = notifiedSignals
        .map((signal) => {
          const reason = signal.reason ? ` - ${signal.reason}` : "";
          return `- ${signal.ticker}: ${signal.entryPrice.toLocaleString("vi-VN")} VND${reason}`;
        })
        .join("\n");

      await pushNotification(
        windowInfo.type,
        `Tin hieu moi ${slotLabel} - ${notifiedSignals.length} ma`,
        `## Tin hieu moi (${slotLabel})\n\n${signalText}`
      );
      await sendClaimedSignalsToTelegram({
        signals: notifiedSignals,
        tradingDate,
        slotLabel,
        batchId: ingest.artifact.batchId,
      });
    }

    if (ingest.activatedSignals.length > 0) {
      await Promise.all(
        ingest.activatedSignals.map((signal) =>
          emitWorkflowTrigger({
            type: "signal_status_changed",
            source: "webhook:signals",
            payload: signal,
          }),
        ),
      );
    }

    invalidateTopics({ tags: ["signal", "signal-scan", "broker", "portfolio"] });

    await logCron(
      "signal_scan_type1",
      "success",
      `Webhook scan ${slotLabel}: ${ingest.processed.length} processed, ${ingest.created} created, ${ingest.updated} updated, ${ingest.notified.length} notified`,
      Date.now() - startedAt,
      {
        scanned: rawSignals.length,
        accepted: ingest.accepted,
        processed: ingest.processed.length,
        created: ingest.created,
        updated: ingest.updated,
        notified: ingest.notified.length,
        batchId: ingest.artifact.batchId,
        scanArtifact: ingest.artifact,
      },
    );

    return NextResponse.json({
      saved: ingest.created,
      updated: ingest.updated,
      notified: ingest.notified.length,
      batchId: ingest.artifact.batchId,
      tickers: ingest.artifact.signals.map((signal) => signal.ticker),
      message: `${ingest.created} moi, ${ingest.updated} cap nhat, ${ingest.notified.length} thong bao`,
    });
  } catch (error) {
    console.error("[Webhook /api/webhooks/signals] Error:", error);
    await logCron("signal_scan_type1", "error", String(error), Date.now() - startedAt);
    return NextResponse.json({ error: "Loi xu ly webhook tin hieu" }, { status: 500 });
  }
}
