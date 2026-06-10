import { NextRequest, NextResponse } from "next/server";
import { getDatabaseApiKey } from "@/utils/apiConfig";

export const dynamic = "force-dynamic";

/**
 * GET /api/stock/quote
 * Serves as a secure backend proxy to query Finnhub Quote API.
 * Maps abbreviated keys (c, d, dp) to standard readable keys.
 * Standardizes incoming tickers (APPLE -> AAPL).
 * Query parameters: symbol (string)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let symbol = searchParams.get("symbol");

    if (!symbol) {
      return NextResponse.json(
        { success: false, error: "Missing symbol query parameter" },
        { status: 400 }
      );
    }

    // 1. Standardize and correct ticker symbol (APPLE -> AAPL)
    if (symbol.toUpperCase() === "APPLE") {
      symbol = "AAPL";
    }

    // 2. Retrieve unmasked Finnhub API token from database or fall back to env
    const apiConfig = await getDatabaseApiKey();
    let token = apiConfig ? apiConfig.active_key : null;

    if (!token || token.trim() === "" || token.includes("*")) {
      token = process.env.FINNHUB_API_KEY || "";
    }

    if (!token || token.trim() === "") {
      return NextResponse.json({
        success: false,
        error: "Finnhub API Token is unconfigured. Please configure it in the admin settings dashboard.",
      });
    }

    console.log(`[Quote API] Fetching Finnhub Quote for: ${symbol}`);

    // 3. Query Finnhub Quote endpoint
    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`
    );

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

    // 4. Validate quote data (c is Current Price; if symbol is invalid, it is typically null or 0)
    if (data.c === null || data.c === undefined || data.c === 0) {
      console.warn(`[Quote API] Finnhub returned empty/zero values for symbol ${symbol}:`, data);
      return NextResponse.json({
        success: false,
        error: `Could not retrieve quote data for symbol "${symbol}". The symbol may be invalid or not supported by Finnhub.`,
      });
    }

    // 5. Clean, map, and parse raw Finnhub keys to system format
    const result = {
      symbol,
      price: parseFloat(data.c),
      change: data.d !== null ? parseFloat(data.d) : 0.0,
      changePercent: data.dp !== null ? parseFloat(data.dp) : 0.0,
    };

    console.log(`[Quote API] Successfully fetched quote for ${symbol}: price=${result.price}, change=${result.change} (${result.changePercent}%)`);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("[Quote API] Failed to fetch stock quote:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
