import { NextRequest, NextResponse } from "next/server";
import { getDatabaseApiKey } from "@/utils/apiConfig";

export const dynamic = "force-dynamic";

/**
 * GET /api/stock/history
 * Serves as a secure backend proxy to query Finnhub K-line history (candles).
 * Maps timeframe resolutions, extracts active unmasked tokens, and proxies the query.
 * Query parameters: symbol (string), timeframe (string)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get("symbol");
    const timeframe = searchParams.get("timeframe");

    if (!symbol || !timeframe) {
      return NextResponse.json(
        { success: false, error: "Missing symbol or timeframe query parameters" },
        { status: 400 }
      );
    }

    // 1. Retrieve raw unmasked API token from database
    const apiConfig = await getDatabaseApiKey();
    const token = apiConfig ? apiConfig.active_key : null;

    if (!token || token.trim() === "" || token.includes("*")) {
      return NextResponse.json({
        success: false,
        error: "Database Finnhub Token is unconfigured or masked.",
      });
    }

    // 2. Map standard timeframe resolution keys to Finnhub specifications
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
      `[History API] Fetching Finnhub Candles: symbol=${symbol}, resolution=${resolution}, from=${from}, to=${to}`
    );

    // 3. Query Finnhub candle endpoint
    const response = await fetch(
      `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(
        symbol
      )}&resolution=${resolution}&from=${from}&to=${to}&token=${token}`
    );

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `Finnhub returned HTTP status ${response.status}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[History API] Internal routing failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
