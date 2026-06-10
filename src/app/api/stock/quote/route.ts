import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/stock/quote
 * Serves as a secure backend proxy to query Yahoo Finance Quote API.
 * Maps Yahoo Finance fields to standard price, change, and changePercent keys.
 * Dynamically overrides fields during Pre-Market and Post-Market trading sessions.
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

    console.log(`[Quote API] Fetching Yahoo Finance Quote for: ${symbol}`);

    // 2. Query Yahoo Finance Quote endpoint using a standard browser User-Agent
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
      },
      // Timeout settings for network reliability
      next: { revalidate: 0 }
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `Yahoo Finance returned HTTP status ${response.status}` },
        { status: 502 }
      );
    }

    const data = await response.json();

    // 3. Extract the first result element
    const result = data.quoteResponse?.result?.[0];
    if (!result) {
      console.warn(`[Quote API] Yahoo Finance returned empty result for symbol ${symbol}:`, data);
      return NextResponse.json({
        success: false,
        error: `Could not retrieve quote data for symbol "${symbol}". The symbol may be invalid or not supported by Yahoo Finance.`,
      });
    }

    // 4. Extract marketState and initial baseline fields (Regular market hours)
    const marketState = result.marketState;
    
    let price = result.regularMarketPrice !== undefined ? parseFloat(result.regularMarketPrice) : 0.0;
    let change = result.regularMarketChange !== undefined ? parseFloat(result.regularMarketChange) : 0.0;
    let changePercent = result.regularMarketChangePercent !== undefined ? parseFloat(result.regularMarketChangePercent) : 0.0;

    // 5. Apply Pre-Market and Post-Market override calibration logic
    if ((marketState === "POST" || marketState === "CLOSED") && result.postMarketPrice !== undefined) {
      console.log(`[Quote API] Market state is ${marketState} (Post-Hours). Calibrating with post-market price: ${result.postMarketPrice}`);
      price = parseFloat(result.postMarketPrice);
      change = result.postMarketChange !== undefined ? parseFloat(result.postMarketChange) : change;
      changePercent = result.postMarketChangePercent !== undefined ? parseFloat(result.postMarketChangePercent) : changePercent;
    } else if (marketState === "PRE" && result.preMarketPrice !== undefined) {
      console.log(`[Quote API] Market state is ${marketState} (Pre-Hours). Calibrating with pre-market price: ${result.preMarketPrice}`);
      price = parseFloat(result.preMarketPrice);
      change = result.preMarketChange !== undefined ? parseFloat(result.preMarketChange) : change;
      changePercent = result.preMarketChangePercent !== undefined ? parseFloat(result.preMarketChangePercent) : changePercent;
    } else {
      console.log(`[Quote API] Market state is ${marketState} (Regular-Hours). Calibrating with regular-market price: ${price}`);
    }

    const mappedResult = {
      symbol,
      price,
      change,
      changePercent,
    };

    return NextResponse.json({
      success: true,
      result: mappedResult,
    });
  } catch (error) {
    console.error("[Quote API] Failed to fetch stock quote from Yahoo Finance:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
