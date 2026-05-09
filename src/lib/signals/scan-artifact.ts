export type SignalScanSource = "cron" | "webhook" | "bridge" | "manual";

export interface SignalScanArtifactItem {
  id?: string;
  ticker: string;
  type: string;
  status?: string;
  entryPrice: number;
  target?: number;
  stoploss?: number;
  navAllocation?: number;
  winRate?: number;
  rrRatio?: string;
  reason?: string | null;
  action: "created" | "updated" | "claimed" | "skipped";
}

export interface SignalScanArtifact {
  kind: "signal_scan";
  version: "v1";
  batchId: string;
  tradingDate: string;
  slot: string;
  slotLabel: string;
  source: SignalScanSource;
  timestamp: string;
  publish: boolean;
  summary: {
    detected: number;
    accepted: number;
    processed: number;
    created: number;
    updated: number;
    notified: number;
    activated: number;
  };
  signals: SignalScanArtifactItem[];
  notifiedSignals: SignalScanArtifactItem[];
  activatedSignals: Array<{
    ticker: string;
    signalType: string;
    fromStatus: string;
    toStatus: string;
    entryPrice: number;
    reason: string | null;
  }>;
}
