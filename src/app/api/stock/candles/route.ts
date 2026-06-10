import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/stock/candles
 * Proxies and structures stock candle historical data from Alpha Vantage API.
 * Maps timeframes to Alpha Vantage parameters, decodes nested objects,
 * sorts results ascending, and handles rate limit errors (429).
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

    // 1. Load Alpha Vantage API key from config in DB or fallback to env variables
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
      apiKey = process.env.ALPHA_VANTAGE_KEY || "";
    }

    if (!apiKey || apiKey.trim() === "") {
      return NextResponse.json({
        success: false,
        error: "Alpha Vantage API Key is unconfigured. Please configure it in the admin settings dashboard.",
      });
    }

    // 2. Configure Alpha Vantage query parameters based on timeframe
    let functionName = "TIME_SERIES_DAILY";
    let intervalParam = "";
    let timeSeriesKey = "Time Series (Daily)";

    switch (timeframe) {
      case "1m":
        functionName = "TIME_SERIES_INTRADAY";
        intervalParam = "1min";
        timeSeriesKey = "Time Series (1min)";
        break;
      case "5m":
        functionName = "TIME_SERIES_INTRADAY";
        intervalParam = "5min";
        timeSeriesKey = "Time Series (5min)";
        break;
      case "15m":
        functionName = "TIME_SERIES_INTRADAY";
        intervalParam = "15min";
        timeSeriesKey = "Time Series (15min)";
        break;
      case "1h":
        functionName = "TIME_SERIES_INTRADAY";
        intervalParam = "60min";
        timeSeriesKey = "Time Series (60min)";
        break;
      case "4h":
      case "1d":
      default:
        functionName = "TIME_SERIES_DAILY";
        timeSeriesKey = "Time Series (Daily)";
        break;
    }

    // 3. Construct URL
    let url = `https://www.alphavantage.co/query?function=${functionName}&symbol=${encodeURIComponent(
      symbol
    )}&apikey=${apiKey}`;
    
    if (intervalParam) {
      url += `&interval=${intervalParam}`;
    }

    console.log(`[Candle API] Fetching Alpha Vantage: symbol=${symbol}, function=${functionName}, interval=${intervalParam}`);

    const response = await fetch(url);
    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `Alpha Vantage returned HTTP status ${response.status}` },
        { status: 502 }
      );
    }

    const responseData = await response.json();

    // 4. Rate-limiting check (Alpha Vantage responds with "Note" when rate limits are exceeded)
    if (responseData["Note"]) {
      console.warn("[Candle API] Alpha Vantage rate limit warning:", responseData["Note"]);
      return NextResponse.json(
        {
          success: false,
          error: "Alpha Vantage rate limit reached (max 5 requests per minute). Please wait a few seconds and try again.",
        },
        { status: 429 } // Return HTTP 429 Too Many Requests
      );
    }

    if (responseData["Error Message"]) {
      console.error("[Candle API] Alpha Vantage API error message:", responseData["Error Message"]);
      return NextResponse.json(
        { success: false, error: `Alpha Vantage API Error: ${responseData["Error Message"]}` },
        { status: 400 }
      );
    }

    // 5. Retrieve timeframe series data
    const timeSeries = responseData[timeSeriesKey];
    if (!timeSeries) {
      console.error("[Candle API] Time Series key not found in response:", Object.keys(responseData));
      return NextResponse.json({
        success: false,
        error: `Could not retrieve chart series matching timeframe resolution "${timeframe}". The symbol may be invalid or not supported by Alpha Vantage.`,
        rawKeys: Object.keys(responseData),
      });
    }

    // 6. Data Cleaning & Ascending chronological sorting
    const formattedCandles = Object.keys(timeSeries)
      .map((dateStr) => {
        const item = timeSeries[dateStr];
        const timestamp = Math.floor(new Date(dateStr).getTime() / 1000);

        return {
          time: timestamp,
          open: parseFloat(item["1. open"]),
          high: parseFloat(item["2. high"]),
          low: parseFloat(item["3. low"]),
          close: parseFloat(item["4. close"]),
          volume: parseFloat(item["5. volume"]) || 0.0,
        };
      })
      .filter((item) => !isNaN(item.time) && !isNaN(item.close)) // Filter out invalid rows
      .sort((a, b) => a.time - b.time); // ASC order for TradingView compatibility

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
