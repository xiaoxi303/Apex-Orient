import { NextRequest, NextResponse } from "next/server";
import { getDatabaseApiKey } from "@/utils/apiConfig";

export const dynamic = "force-dynamic";

// Local high-fidelity stock database to fallback on when Finnhub API Key is missing or invalid.
// Provides search coverage for standard watchlists (Tech, Crypto, Indices) and common tickers.
const FALLBACK_STOCKS = [
  { symbol: "AAPL", name: "Apple Inc.", type: "Common Stock" },
  { symbol: "MSFT", name: "Microsoft Corp.", type: "Common Stock" },
  { symbol: "NVDA", name: "NVIDIA Corp.", type: "Common Stock" },
  { symbol: "TSLA", name: "Tesla Inc.", type: "Common Stock" },
  { symbol: "GOOGL", name: "Alphabet Inc.", type: "Common Stock" },
  { symbol: "META", name: "Meta Platforms Inc.", type: "Common Stock" },
  { symbol: "AMZN", name: "Amazon.com Inc.", type: "Common Stock" },
  { symbol: "NFLX", name: "Netflix Inc.", type: "Common Stock" },
  { symbol: "AMD", name: "Advanced Micro Devices", type: "Common Stock" },
  { symbol: "INTC", name: "Intel Corp.", type: "Common Stock" },
  { symbol: "COIN", name: "Coinbase Global Inc.", type: "Common Stock" },
  { symbol: "BTC/USD", name: "Bitcoin / USD", type: "Cryptocurrency" },
  { symbol: "ETH/USD", name: "Ethereum / USD", type: "Cryptocurrency" },
  { symbol: "SOL/USD", name: "Solana / USD", type: "Cryptocurrency" },
  { symbol: "DOGE/USD", name: "Dogecoin / USD", type: "Cryptocurrency" },
  { symbol: "SPY", name: "SPDR S&P 500 ETF", type: "ETF" },
  { symbol: "QQQ", name: "Invesco QQQ Trust", type: "ETF" },
  { symbol: "DIA", name: "SPDR Dow Jones ETF", type: "ETF" },
  { symbol: "IWM", name: "iShares Russell 2000 ETF", type: "ETF" },
];

/**
 * GET /api/stock/search
 * Proxies queries to Finnhub's autocomplete search API using active DB credentials.
 * Falls back to high-fidelity local database matching in sandbox or offline mode.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");

    if (!q || !q.trim()) {
      return NextResponse.json({ success: true, result: [] });
    }

    const searchQuery = q.trim();

    // 1. Fetch unmasked API key from the database
    const apiConfig = await getDatabaseApiKey();
    const token = apiConfig ? apiConfig.active_key : null;

    // 2. Query Finnhub if unmasked token is configured
    if (token && token.trim() !== "" && !token.includes("*")) {
      try {
        const response = await fetch(
          `https://finnhub.io/api/v1/search?q=${encodeURIComponent(searchQuery)}&token=${token}`,
          { next: { revalidate: 60 } } // Cache search results for 1 minute
        );

        if (response.ok) {
          const data = await response.json();
          if (data && Array.isArray(data.result)) {
            // Map Finnhub output structures to clean, standardized fields
            const cleaned = data.result.map((item: { symbol?: string; description?: string; type?: string }) => ({
              symbol: item.symbol || "",
              name: item.description || "",
              type: item.type || "Common Stock",
            }));
            return NextResponse.json({ success: true, result: cleaned });
          }
        }
        console.warn(`[Search API] Finnhub search responded with error status: ${response.status}`);
      } catch (err) {
        console.error("[Search API] Finnhub proxy fetch failed:", err);
        // Fall through to local simulation
      }
    }

    // 3. Fallback Local Search Logic
    // Runs when token is unconfigured (sandbox mode) or when the third-party API is offline
    const queryLower = searchQuery.toLowerCase();
    const filteredMock = FALLBACK_STOCKS.filter(
      (stock) =>
        stock.symbol.toLowerCase().includes(queryLower) ||
        stock.name.toLowerCase().includes(queryLower)
    );

    return NextResponse.json({
      success: true,
      result: filteredMock,
      fallback: true,
    });
  } catch (error) {
    console.error("[Search API] Internal routing failure:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
