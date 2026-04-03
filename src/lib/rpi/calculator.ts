/**
 * RPI (Reverse Point Index) Calculator
 * Computes RPI from OHLCV data using 5 technical indicators
 * Weights: RSI(25%) + Stochastic(25%) + BB(20%) + MACD(15%) + Volume(15%)
 */

import {
  calcRSI,
  calcStochastic,
  calcMACD,
  calcBollingerPosition,
  calcVolumeRatio,
  calcROC,
} from "./indicators";

export interface OHLCVData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface RPIResult {
  date: string;
  rpi: number | null;
  ma7: number | null;
  classification: string | null;
  classColor: string | null;
  details?: {
    rsiScore: number;
    stochScore: number;
    bbScore: number;
    macdScore: number;
    volumeScore: number;
  };
}

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 2.5;
  return Math.max(0, Math.min(5, ((value - min) / (max - min)) * 5));
}

function normalize100to5(value: number | null): number | null {
  if (value === null) return null;
  return Math.max(0, Math.min(5, (value / 100) * 5));
}

export function calculateRPI(ohlcvData: OHLCVData[]): RPIResult[] {
  if (ohlcvData.length < 30) {
    return [];
  }

  const closes = ohlcvData.map((d) => d.close);
  const highs = ohlcvData.map((d) => d.high);
  const lows = ohlcvData.map((d) => d.low);
  const volumes = ohlcvData.map((d) => d.volume);

  const rsi14 = calcRSI(closes, 14);
  const rsi7 = calcRSI(closes, 7);
  const stoch14 = calcStochastic(closes, highs, lows, 14);
  const stoch5 = calcStochastic(closes, highs, lows, 5);
  const { histogram: macdHist } = calcMACD(closes);
  const bbPos = calcBollingerPosition(closes, 20);
  const volRatio = calcVolumeRatio(volumes, 10);
  const roc5 = calcROC(closes, 5);

  const lookbackWindow = 30;

  const results: RPIResult[] = ohlcvData.map((item, i) => {
    if (rsi14[i] === null || stoch14[i] === null || bbPos[i] === null) {
      return { date: item.date, rpi: null, ma7: null, classification: null, classColor: null };
    }

    // 1. RSI Score: combine RSI(14) and RSI(7)
    const rsiScore = normalize100to5(
      rsi7[i] !== null ? rsi7[i]! * 0.6 + rsi14[i]! * 0.4 : rsi14[i]!,
    )!;

    // 2. Stochastic Score: combine Stoch(14) and Stoch(5)
    const stochScore = normalize100to5(
      stoch5[i] !== null ? stoch5[i]! * 0.5 + stoch14[i]! * 0.5 : stoch14[i]!,
    )!;

    // 3. Bollinger Band Position Score
    const bbScore = normalize100to5(bbPos[i]!)!;

    // 4. MACD Histogram Score (normalized in window)
    let macdScore = 2.5;
    if (macdHist[i] !== null) {
      const start = Math.max(0, i - lookbackWindow);
      const histWindow = macdHist.slice(start, i + 1).filter((v): v is number => v !== null);
      if (histWindow.length > 0) {
        const histMin = Math.min(...histWindow);
        const histMax = Math.max(...histWindow);
        macdScore = normalize(macdHist[i]!, histMin, histMax);
      }
    }

    // 5. Volume Pressure Score
    let volumeScore = 2.5;
    if (volRatio[i] !== null && roc5[i] !== null) {
      const direction = roc5[i]! > 0 ? 1 : -1;
      const volPressure = direction * Math.min(volRatio[i]!, 3);
      volumeScore = Math.max(0, Math.min(5, ((volPressure + 3) / 6) * 5));
    }

    // RPI = weighted sum
    const rpi =
      0.25 * rsiScore +
      0.25 * stochScore +
      0.2 * bbScore +
      0.15 * macdScore +
      0.15 * volumeScore;

    return {
      date: item.date,
      rpi: Math.round(rpi * 100) / 100,
      ma7: null,
      classification: null,
      classColor: null,
      details: {
        rsiScore: Math.round(rsiScore * 100) / 100,
        stochScore: Math.round(stochScore * 100) / 100,
        bbScore: Math.round(bbScore * 100) / 100,
        macdScore: Math.round(macdScore * 100) / 100,
        volumeScore: Math.round(volumeScore * 100) / 100,
      },
    };
  });

  // MA7
  results.forEach((item, i) => {
    if (item.rpi === null) return;
    if (i >= 6) {
      const window = results.slice(i - 6, i + 1).filter((d) => d.rpi !== null);
      if (window.length === 7) {
        item.ma7 = Math.round((window.reduce((s, d) => s + d.rpi!, 0) / 7) * 100) / 100;
      }
    }
  });

  // Classification
  results.forEach((item) => {
    if (item.rpi === null) return;
    if (item.rpi >= 4.0) {
      item.classification = "RỦI RO ĐẢO CHIỀU GIẢM";
      item.classColor = "red";
    } else if (item.rpi <= 1.0) {
      item.classification = "CƠ HỘI ĐẢO CHIỀU TĂNG";
      item.classColor = "green";
    } else {
      item.classification = "TRUNG TÍNH";
      item.classColor = "yellow";
    }
  });

  return results;
}

export function getLatestRPI(results: RPIResult[]): RPIResult | null {
  return [...results].reverse().find((r) => r.rpi !== null) ?? null;
}
