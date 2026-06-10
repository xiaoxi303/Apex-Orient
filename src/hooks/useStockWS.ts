import { useEffect, useRef } from "react";
import { useStockStore } from "@/store/useStockStore";

/**
 * Custom React Hook that acts as a WebSocket client to stream real-time price updates.
 * Demonstrates client subscription logic and dispatches ticks into the Zustand store.
 * Operates in simulated push mode for high-fidelity interactive dashboard ticking.
 */
export function useStockWS() {
  const { setStockPrice, watchlists } = useStockStore();
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Gather all active symbols from watchlists
    const symbols = Object.values(watchlists).flatMap((group) =>
      group.map((stock) => stock.symbol)
    );
    
    if (symbols.length === 0) return;

    console.log("⚡ Apex Orient WebSocket: Active subscription initiated for tickers:", symbols);

    // Demonstration of connecting to a standard US market data WS provider (e.g. Finnhub):
    // const apiKey = process.env.NEXT_PUBLIC_FINNHUB_WS_TOKEN || "sandbox_token";
    // const wsUrl = `wss://ws.finnhub.io?token=${apiKey}`;
    // const ws = new WebSocket(wsUrl);
    // socketRef.current = ws;
    //
    // ws.onopen = () => {
    //   // Subscribe to all active symbols
    //   symbols.forEach(symbol => {
    //     ws.send(JSON.stringify({ type: "subscribe", symbol }));
    //   });
    // };
    //
    // ws.onmessage = (event) => {
    //   const data = JSON.parse(event.data);
    //   if (data.type === "trade") {
    //     const trade = data.data[0]; // Fetch first trade
    //     const symbol = trade.s;
    //     const price = trade.p;
    //     // calculate change and changePercent relative to market close...
    //     // setStockPrice(symbol, price, change, changePercent);
    //   }
    // };

    // --- High Fidelity Client Ticking Simulation ---
    // Simulates continuous WebSocket message pushes to keep the UI visually animated
    const tickInterval = setInterval(() => {
      // Pick a random stock from the current active pool
      const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
      
      // Locate the stock metadata in watchlists
      let targetStock = null;
      for (const group of Object.values(watchlists)) {
        const found = group.find((s) => s.symbol === randomSymbol);
        if (found) {
          targetStock = found;
          break;
        }
      }

      if (!targetStock) return;

      // Simulate a realistic volatility tick (-0.18% to +0.22%)
      const tickVol = (Math.random() * 0.4 - 0.18) / 100;
      const priceMovement = targetStock.price * tickVol;
      const updatedPrice = Number((targetStock.price + priceMovement).toFixed(2));
      
      // Recalculate dynamic day change details relative to static close
      // Using an estimated previous close based on initial price and percentage
      const estimatedPrevClose = targetStock.price / (1 + targetStock.changePercent / 100);
      const computedChange = Number((updatedPrice - estimatedPrevClose).toFixed(2));
      const computedChangePercent = Number(
        (((updatedPrice - estimatedPrevClose) / estimatedPrevClose) * 100).toFixed(2)
      );

      // Dispatch WebSockets update to global store
      setStockPrice(randomSymbol, updatedPrice, computedChange, computedChangePercent);
    }, 1500);

    const activeSocket = socketRef.current;
    return () => {
      clearInterval(tickInterval);
      if (activeSocket) {
        activeSocket.close();
      }
    };
  }, [watchlists, setStockPrice]);
}
