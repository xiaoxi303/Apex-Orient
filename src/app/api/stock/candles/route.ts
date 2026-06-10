import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/stock/candles
 * Proxies and structures stock candle historical data from Finnhub API.
 * Maps timeframes to Finnhub resolutions, translates flat arrays to object arrays,
 * and handles symbol normalization (APPLE -> AAPL).
 * Query parameters: symbol (string), timeframe (string)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let symbol = searchParams.get("symbol");
    const timeframe = searchParams.get("timeframe");

    if (!symbol || !timeframe) {
      return NextResponse.json(
        { success: false, error: "Missing symbol or timeframe query parameters" },
        { status: 400 }
      );
    }

    // 1. Ticker Correction: Map "APPLE" to "AAPL"
    if (symbol.toUpperCase() === "APPLE") {
      symbol = "AAPL";
    }

    // 2. Load Finnhub API key from config in DB or fallback to environment variables
    let apiKey = "";
    try {
      const apiConfig = await prisma.adminSetting.findUnique({
        where: { key: "api_config" },
      });
      if (apiConfig) {
        const parsed = JSON.parse(apiConfig.value);
        if (parsed.active_key && parsed.active_key.trim() !== "" && !parsed.active_key.includes("*")) {
          apiKey = parsed.active_key;
        }
      }
    } catch (dbErr) {
      console.warn("[Candle API] Failed to read API key from DB, attempting fallback:", dbErr);
    }

    if (!apiKey) {
      apiKey = process.env.FINNHUB_API_KEY || "";
    }

    if (!apiKey || apiKey.trim() === "") {
      return NextResponse.json({
        success: false,
        error: "Finnhub API Token is unconfigured. Please configure it in the admin settings dashboard.",
      });
    }

    // 3. Configure Finnhub query parameters based on timeframe
    let resolution = "D";
    let lookbackSeconds = 200 * 24 * 60 * 60; // 200 days default

    switch (timeframe) {
      case "1m":
        resolution = "1";
        lookbackSeconds = 2 * 24 * 60 * 60; // 2 days of 1-minute bars
        break;
      case "5m":
        resolution = "5";
        lookbackSeconds = 5 * 24 * 60 * 60; // 5 days
        break;
      case "15m":
        resolution = "15";
        lookbackSeconds = 15 * 24 * 60 * 60; // 15 days
        break;
      case "1h":
        resolution = "60";
        lookbackSeconds = 45 * 24 * 60 * 60; // 45 days
        break;
      case "4h":
        resolution = "240";
        lookbackSeconds = 90 * 24 * 60 * 60; // 90 days
        break;
      case "1d":
      default:
        resolution = "D";
        lookbackSeconds = 365 * 24 * 60 * 60; // 1 year
        break;
    }

    const to = Math.floor(Date.now() / 1000);
    const from = to - lookbackSeconds;

    console.log(
      `[Candle API] Fetching Finnhub Candles: symbol=${symbol}, resolution=${resolution}, from=${from}, to=${to}`
    );

    // 4. Query Finnhub candle endpoint
    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(
      symbol
    )}&resolution=${resolution}&from=${from}&to=${to}&token=${apiKey}`;

    const response = await fetch(url);
    
    if (response.status === 429) {
      return NextResponse.json(
        {
          success: false,
          error: "Finnhub rate limit reached. Please wait a few seconds and try again.",
        },
        { status: 429 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `Finnhub returned HTTP status ${response.status}` },
        { status: 502 }
      );
    }

    const data = await response.json();

    // 5. Handle empty or error states from Finnhub response
    if (data.s !== "ok" || !Array.isArray(data.t)) {
      console.warn(`[Candle API] Finnhub returned non-ok status or empty array for ${symbol}:`, data);
      return NextResponse.json({
        success: false,
        error: `Could not retrieve candle data matching timeframe resolution "${timeframe}". Finnhub status: "${data.s || "no_data"}"`,
      });
    }

    interface CandleBar {
      time: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }

    // 6. Data Cleaning & Translation from flat arrays (t, o, h, l, c, v) to object arrays
    const formattedCandles: CandleBar[] = data.t.map((timestamp: number, idx: number) => ({
      time: timestamp,
      open: parseFloat(data.o[idx]),
      high: parseFloat(data.h[idx]),
      low: parseFloat(data.l[idx]),
      close: parseFloat(data.c[idx]),
      volume: parseFloat(data.v[idx]) || 0.0,
    }))
    .filter((item: CandleBar) => !isNaN(item.time) && !isNaN(item.close))
    .sort((a: CandleBar, b: CandleBar) => a.time - b.time); // Ascending order sorting for TradingView

    console.log(`[Candle API] Successfully formatted ${formattedCandles.length} candles for: ${symbol}`);

    return NextResponse.json({
      success: true,
      result: formattedCandles,
    });
  } catch (error) {
    console.error("[Candle API] Failed to fetch stock history:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
