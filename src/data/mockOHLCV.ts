import { Time } from "lightweight-charts";

/**
 * Generates realistic OHLCV candlestick mock data for a given symbol.
 * Uses deterministic seeding based on symbol string so each ticker
 * produces a consistent, unique-looking chart.
 */
function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Simple seeded pseudo-random number generator (Mulberry32)
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface OHLCVBar {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const BASE_PRICES: Record<string, number> = {
  AAPL: 178,
  MSFT: 415,
  NVDA: 875,
  TSLA: 173,
  GOOGL: 152,
  META: 495,
  "BTC/USD": 67250,
  "ETH/USD": 3540,
  "SOL/USD": 148,
  "DOGE/USD": 0.14,
  SPY: 513,
  QQQ: 439,
  DIA: 390,
  IWM: 202,
};

export type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
};

export function generateMockOHLCV(
  symbol: string,
  timeframe: Timeframe = "1d",
  barCount: number = 200
): OHLCVBar[] {
  const seed = hashCode(symbol + timeframe);
  const rand = mulberry32(seed);

  const basePrice = BASE_PRICES[symbol] || 100;
  const intervalSec = TIMEFRAME_SECONDS[timeframe];

  // Start from some historical date
  const now = Math.floor(Date.now() / 1000);
  const startTime = now - barCount * intervalSec;

  const bars: OHLCVBar[] = [];
  let price = basePrice * (0.88 + rand() * 0.12);

  for (let i = 0; i < barCount; i++) {
    const volatility = basePrice * (0.005 + rand() * 0.015);
    const drift = (rand() - 0.48) * volatility;
    const open = price;
    const close = open + drift;
    const highExtra = Math.abs(rand() * volatility * 0.8);
    const lowExtra = Math.abs(rand() * volatility * 0.8);
    const high = Math.max(open, close) + highExtra;
    const low = Math.min(open, close) - lowExtra;
    const volume = Math.floor(1000000 + rand() * 15000000);

    const barTime = (startTime + i * intervalSec) as Time;

    bars.push({
      time: barTime,
      open: parseFloat(open.toFixed(symbol.includes("/") && basePrice < 1 ? 6 : 2)),
      high: parseFloat(high.toFixed(symbol.includes("/") && basePrice < 1 ? 6 : 2)),
      low: parseFloat(low.toFixed(symbol.includes("/") && basePrice < 1 ? 6 : 2)),
      close: parseFloat(close.toFixed(symbol.includes("/") && basePrice < 1 ? 6 : 2)),
      volume,
    });

    price = close;
  }

  return bars;
}
