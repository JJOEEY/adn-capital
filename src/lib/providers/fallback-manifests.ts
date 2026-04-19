import type { BacktestProviderManifest, ScannerProviderManifest } from "@/types/provider-manifest";

export const fallbackBacktestProviders: BacktestProviderManifest[] = [
  {
    provider: "vn_breakout_suite",
    version: "1.0.0",
    label: "VN Breakout Suite",
    description: "Backtest breakout strategy with trend and liquidity filters.",
    parameters: [
      {
        key: "ticker",
        label: "Ticker",
        type: "string",
        required: true,
        default: "HPG",
        helpText: "Vietnam stock ticker, example: HPG, FPT, VCB.",
      },
      {
        key: "lookback",
        label: "Lookback",
        type: "number",
        min: 10,
        max: 120,
        step: 1,
        default: 20,
      },
      {
        key: "minVolumeRatio",
        label: "Min Volume Ratio",
        type: "number",
        min: 0.5,
        max: 5,
        step: 0.1,
        default: 1.5,
      },
      {
        key: "universe",
        label: "Universe",
        type: "select",
        default: "VN30",
        options: [
          { label: "VN30", value: "VN30" },
          { label: "HOSE", value: "HOSE" },
          { label: "ALL", value: "ALL" },
        ],
      },
    ],
  },
];

export const fallbackScannerProviders: ScannerProviderManifest[] = [
  {
    provider: "adn_signal_scanner",
    version: "1.0.0",
    label: "ADN Signal Scanner",
    description: "Rule-based scanner for RADAR and ACTIVE candidates.",
    parameters: [
      {
        key: "universe",
        label: "Universe",
        type: "select",
        default: "VN30",
        options: [
          { label: "VN30", value: "VN30" },
          { label: "HOSE", value: "HOSE" },
          { label: "ALL", value: "ALL" },
        ],
      },
      {
        key: "minPrice",
        label: "Min Price",
        type: "number",
        min: 1,
        max: 200,
        step: 0.5,
        default: 10,
      },
    ],
  },
];
