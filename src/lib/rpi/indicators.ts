/**
 * Technical indicator functions for RPI calculation
 * All functions work with number arrays (price series)
 */

/** RSI (Relative Strength Index) */
export function calcRSI(closes: number[], period = 14): (number | null)[] {
  const rsi: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return rsi;

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
}

/** Stochastic %K */
export function calcStochastic(
  closes: number[],
  highs: number[],
  lows: number[],
  period = 14,
): (number | null)[] {
  const stoch: (number | null)[] = new Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i++) {
    const highSlice = highs.slice(i - period + 1, i + 1);
    const lowSlice = lows.slice(i - period + 1, i + 1);
    const highestHigh = Math.max(...highSlice);
    const lowestLow = Math.min(...lowSlice);
    if (highestHigh === lowestLow) {
      stoch[i] = 50;
    } else {
      stoch[i] = ((closes[i] - lowestLow) / (highestHigh - lowestLow)) * 100;
    }
  }
  return stoch;
}

/** EMA (Exponential Moving Average) */
export function calcEMA(data: (number | null)[], period: number): (number | null)[] {
  const ema: (number | null)[] = new Array(data.length).fill(null);
  const multiplier = 2 / (period + 1);

  const startIdx = data.findIndex((v) => v !== null);
  if (startIdx === -1) return ema;

  let sum = 0;
  let count = 0;
  for (let i = startIdx; i < startIdx + period && i < data.length; i++) {
    if (data[i] !== null) {
      sum += data[i]!;
      count++;
    }
  }
  if (count === 0) return ema;
  ema[startIdx + period - 1] = sum / count;

  for (let i = startIdx + period; i < data.length; i++) {
    if (data[i] !== null && ema[i - 1] !== null) {
      ema[i] = (data[i]! - ema[i - 1]!) * multiplier + ema[i - 1]!;
    }
  }
  return ema;
}

/** MACD */
export function calcMACD(closes: number[]) {
  const closesNullable: (number | null)[] = closes;
  const ema12 = calcEMA(closesNullable, 12);
  const ema26 = calcEMA(closesNullable, 26);
  const macd: (number | null)[] = closes.map((_, i) => {
    if (ema12[i] !== null && ema26[i] !== null) return ema12[i]! - ema26[i]!;
    return null;
  });
  const signal = calcEMA(macd, 9);
  const histogram: (number | null)[] = macd.map((m, i) => {
    if (m !== null && signal[i] !== null) return m - signal[i]!;
    return null;
  });
  return { macd, signal, histogram };
}

/** Bollinger Band Position (0-100) */
export function calcBollingerPosition(closes: number[], period = 20): (number | null)[] {
  const result: (number | null)[] = new Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const ma = slice.reduce((a, b) => a + b, 0) / period;
    const std = Math.sqrt(slice.reduce((a, b) => a + (b - ma) ** 2, 0) / period);
    const upper = ma + 2 * std;
    const lower = ma - 2 * std;
    if (upper === lower) {
      result[i] = 50;
    } else {
      result[i] = ((closes[i] - lower) / (upper - lower)) * 100;
    }
  }
  return result;
}

/** Volume Ratio (current vs average) */
export function calcVolumeRatio(volumes: number[], period = 10): (number | null)[] {
  const result: (number | null)[] = new Array(volumes.length).fill(null);
  for (let i = period - 1; i < volumes.length; i++) {
    const avgVol =
      volumes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
    result[i] = avgVol === 0 ? 1 : volumes[i] / avgVol;
  }
  return result;
}

/** Rate of Change */
export function calcROC(closes: number[], period = 5): (number | null)[] {
  const result: (number | null)[] = new Array(closes.length).fill(null);
  for (let i = period; i < closes.length; i++) {
    if (closes[i - period] !== 0) {
      result[i] = ((closes[i] - closes[i - period]) / closes[i - period]) * 100;
    }
  }
  return result;
}
