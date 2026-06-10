import { create } from "zustand";
import type { Timeframe } from "@/data/mockOHLCV";

// ─── Stock Types ───────────────────────────────────────────
export interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

export type LayoutMode = "single" | "split" | "quad";

// ─── Drawing Types ─────────────────────────────────────────
export type DrawingTool = "pointer" | "trendline" | "horizontal" | "fibonacci" | "none";

export interface DrawingPoint {
  time: number;  // unix timestamp
  price: number;
}

export interface DrawingItem {
  id: string;
  type: DrawingTool;
  points: DrawingPoint[];    // 1 point for horizontal, 2 for trendline/fib
  color: string;
  lineWidth: number;
  fibLevels?: number[];
}

// ─── Store Interface ───────────────────────────────────────
interface StockState {
  // Theme
  theme: "dark" | "light";
  toggleTheme: () => void;
  initializeTheme: () => void;

  // Watchlists
  activeGroup: string;
  setActiveGroup: (group: string) => void;
  watchlists: Record<string, Stock[]>;

  // Selection
  selectedStock: Stock;
  setSelectedStock: (stock: Stock) => void;

  // Layout
  layoutMode: LayoutMode;
  setLayoutMode: (mode: LayoutMode) => void;
  paneStocks: string[];
  setPaneStock: (index: number, symbol: string) => void;

  // Timeframes per pane
  paneTimeframes: Timeframe[];
  setPaneTimeframe: (index: number, tf: Timeframe) => void;

  // Drawing Tool State
  activeDrawingTool: DrawingTool;
  setActiveDrawingTool: (tool: DrawingTool) => void;

  // Chart Drawings - keyed by "SYMBOL_TIMEFRAME"
  chartDrawings: Record<string, DrawingItem[]>;
  addDrawing: (key: string, drawing: DrawingItem) => void;
  updateDrawing: (key: string, drawingId: string, updates: Partial<DrawingItem>) => void;
  removeDrawing: (key: string, drawingId: string) => void;
  clearDrawings: (key: string) => void;
  getDrawingsForChart: (symbol: string, timeframe: Timeframe) => DrawingItem[];

  // Global Search Modal State
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;

  // Manual Force-Refresh Actions
  isRefreshing: boolean;
  refreshCurrentStock: (symbol: string, timeframe: Timeframe) => Promise<void>;

  // Twelve Data direct frontend fetch actions
  twelveDataApiKey: string;
  setTwelveDataApiKey: (key: string) => void;
  fetchSelectedStockPrice: (symbol: string) => Promise<void>;

  // Admin Config settings synced to client store
  refreshInterval: number;
  setRefreshInterval: (interval: number) => void;
  smartSleep: boolean;
  setSmartSleep: (enabled: boolean) => void;
  smartSymbolSwitch: boolean;
  setSmartSymbolSwitch: (enabled: boolean) => void;
  activeThemePack: string;
  setActiveThemePack: (pack: string) => void;

  // Stage 3 Full-Stack & Live sync actions
  loadDrawings: (symbol: string, timeframe: Timeframe) => Promise<void>;
  saveDrawingsDebounced: (symbol: string, timeframe: Timeframe, drawings: DrawingItem[]) => void;
  loadSettingsAndWatchlist: () => Promise<void>;
  setStockPrice: (symbol: string, price: number, change: number, changePercent: number) => void;
  stocks: Record<string, Stock>;
}

// ─── Debounce Timer Map ────────────────────────────────────
const debounceTimeouts: Record<string, NodeJS.Timeout> = {};

// ─── Default Fallback Stocks ────────────────────────────────
const defaultStocks: Record<string, Stock[]> = {
  Tech: [
    { symbol: "AAPL", name: "Apple Inc.", price: 0, change: 0, changePercent: 0 },
    { symbol: "MSFT", name: "Microsoft Corp.", price: 0, change: 0, changePercent: 0 },
    { symbol: "NVDA", name: "NVIDIA Corp.", price: 0, change: 0, changePercent: 0 },
    { symbol: "TSLA", name: "Tesla Inc.", price: 0, change: 0, changePercent: 0 },
    { symbol: "GOOGL", name: "Alphabet Inc.", price: 0, change: 0, changePercent: 0 },
    { symbol: "META", name: "Meta Platforms", price: 0, change: 0, changePercent: 0 },
  ],
  Crypto: [
    { symbol: "BTC/USD", name: "Bitcoin / USD", price: 0, change: 0, changePercent: 0 },
    { symbol: "ETH/USD", name: "Ethereum / USD", price: 0, change: 0, changePercent: 0 },
    { symbol: "SOL/USD", name: "Solana / USD", price: 0, change: 0, changePercent: 0 },
    { symbol: "DOGE/USD", name: "Dogecoin / USD", price: 0, change: 0, changePercent: 0 },
  ],
  Indices: [
    { symbol: "SPY", name: "SPDR S&P 500 ETF", price: 0, change: 0, changePercent: 0 },
    { symbol: "QQQ", name: "Invesco QQQ Trust", price: 0, change: 0, changePercent: 0 },
    { symbol: "DIA", name: "SPDR Dow Jones ETF", price: 0, change: 0, changePercent: 0 },
    { symbol: "IWM", name: "iShares Russell 2000 ETF", price: 0, change: 0, changePercent: 0 },
  ],
};

function formatTwelveDataSymbol(symbol: string, enabled: boolean): string {
  if (!enabled) return symbol;
  const nasdaqTickers = ["AAPL", "MSFT", "NVDA", "TSLA", "GOOGL", "META", "AMZN", "NFLX", "QQQ"];
  const nyseTickers = ["DIA", "IWM"];
  const upper = symbol.toUpperCase();
  if (nasdaqTickers.includes(upper)) {
    return `${upper}:NASDAQ`;
  }
  if (nyseTickers.includes(upper)) {
    return `${upper}:NYSE`;
  }
  return symbol;
}

const STOCK_NAMES: Record<string, string> = {
  AAPL: "Apple Inc.",
  MSFT: "Microsoft Corp.",
  NVDA: "NVIDIA Corp.",
  TSLA: "Tesla Inc.",
  GOOGL: "Alphabet Inc.",
  META: "Meta Platforms",
  AMZN: "Amazon.com Inc.",
  NFLX: "Netflix Inc.",
  "BTC/USD": "Bitcoin / USD",
  "ETH/USD": "Ethereum / USD",
  "SOL/USD": "Solana / USD",
  "DOGE/USD": "Dogecoin / USD",
  SPY: "SPDR S&P 500 ETF",
  QQQ: "Invesco QQQ Trust",
  DIA: "SPDR Dow Jones ETF",
  IWM: "iShares Russell 2000 ETF",
  // Forex support
  "EUR/USD": "Euro / US Dollar",
  "GBP/USD": "British Pound / US Dollar",
  "USD/JPY": "US Dollar / Japanese Yen",
  "AUD/USD": "Australian Dollar / US Dollar",
  "USD/CAD": "US Dollar / Canadian Dollar",
  "GBP/JPY": "British Pound / Japanese Yen",
  "EUR/GBP": "Euro / British Pound",
  "CHF/USD": "Swiss Franc / US Dollar",
};

const FALLBACK_PRICES: Record<string, number> = {
  AAPL: 178.53,
  MSFT: 415.50,
  NVDA: 875.12,
  TSLA: 172.98,
  GOOGL: 151.60,
  META: 495.22,
  AMZN: 175.35,
  NFLX: 610.50,
  "BTC/USD": 67250.00,
  "ETH/USD": 3540.50,
  "SOL/USD": 148.25,
  "DOGE/USD": 0.142,
  SPY: 512.85,
  QQQ: 438.60,
  DIA: 389.90,
  IWM: 202.15,
  // Forex defaults
  "EUR/USD": 1.0850,
  "GBP/USD": 1.2680,
  "USD/JPY": 151.20,
  "AUD/USD": 0.6540,
  "USD/CAD": 1.3520,
  "GBP/JPY": 191.80,
  "EUR/GBP": 0.8550,
  "CHF/USD": 1.1120,
};

const initialStocks: Record<string, Stock> = {};
Object.values(defaultStocks).forEach((group) => {
  group.forEach((stock) => {
    initialStocks[stock.symbol] = stock;
  });
});

// ─── Store Implementation ──────────────────────────────────
export const useStockStore = create<StockState>((set, get) => ({
  // Theme
  theme: "dark",
  toggleTheme: () => {
    const nextTheme = get().theme === "dark" ? "light" : "dark";
    set({ theme: nextTheme });
    if (typeof window !== "undefined") {
      const root = window.document.documentElement;
      if (nextTheme === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  },
  initializeTheme: () => {
    if (typeof window !== "undefined") {
      const root = window.document.documentElement;
      const currentTheme = get().theme;
      if (currentTheme === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  },

  // Watchlists
  activeGroup: "Tech",
  setActiveGroup: (group) => set({ activeGroup: group }),
  watchlists: defaultStocks,
  stocks: initialStocks,

  // Twelve Data Key Setup
  twelveDataApiKey: "",
  setTwelveDataApiKey: (key) => set({ twelveDataApiKey: key }),

  // Config variables
  refreshInterval: 30,
  setRefreshInterval: (interval) => set({ refreshInterval: interval }),
  smartSleep: false,
  setSmartSleep: (enabled) => set({ smartSleep: enabled }),
  smartSymbolSwitch: false,
  setSmartSymbolSwitch: (enabled) => set({ smartSymbolSwitch: enabled }),
  activeThemePack: "tech",
  setActiveThemePack: (pack) => set({ activeThemePack: pack }),

  // Selection
  selectedStock: defaultStocks["Tech"][0],
  setSelectedStock: (stock) => {
    const targetSymbol = stock.symbol.toUpperCase() === "APPLE" ? "AAPL" : stock.symbol;
    const targetName = stock.symbol.toUpperCase() === "APPLE" ? "Apple Inc." : stock.name;
    const targetStock = { ...stock, symbol: targetSymbol, name: targetName };
    
    set((state) => {
      const updatedStocks = { ...state.stocks };
      if (!updatedStocks[targetSymbol]) {
        updatedStocks[targetSymbol] = targetStock;
      }
      return { selectedStock: targetStock, stocks: updatedStocks };
    });
    
    get().fetchSelectedStockPrice(targetSymbol);
  },

  // Layout
  layoutMode: "single",
  setLayoutMode: (mode) => set({ layoutMode: mode }),
  paneStocks: ["AAPL", "MSFT", "NVDA", "TSLA"],
  setPaneStock: (index, symbol) => {
    const targetSymbol = symbol.toUpperCase() === "APPLE" ? "AAPL" : symbol;
    set((state) => {
      const updated = [...state.paneStocks];
      updated[index] = targetSymbol;
      return { paneStocks: updated };
    });

    get().fetchSelectedStockPrice(targetSymbol);
  },

  // Timeframes
  paneTimeframes: ["1d", "1d", "1d", "1d"],
  setPaneTimeframe: (index, tf) =>
    set((state) => {
      const updated = [...state.paneTimeframes];
      updated[index] = tf;
      return { paneTimeframes: updated };
    }),

  // Drawing Tool
  activeDrawingTool: "pointer",
  setActiveDrawingTool: (tool) => set({ activeDrawingTool: tool }),

  // Chart Drawings
  chartDrawings: {},

  addDrawing: (key, drawing) =>
    set((state) => {
      const drawings = [...(state.chartDrawings[key] || []), drawing];
      const [symbol, timeframe] = key.split("_") as [string, Timeframe];
      get().saveDrawingsDebounced(symbol, timeframe, drawings);
      return {
        chartDrawings: {
          ...state.chartDrawings,
          [key]: drawings,
        },
      };
    }),

  updateDrawing: (key, drawingId, updates) =>
    set((state) => {
      const drawings = state.chartDrawings[key] || [];
      const updatedDrawings = drawings.map((d) =>
        d.id === drawingId ? { ...d, ...updates } : d
      );
      const [symbol, timeframe] = key.split("_") as [string, Timeframe];
      get().saveDrawingsDebounced(symbol, timeframe, updatedDrawings);
      return {
        chartDrawings: {
          ...state.chartDrawings,
          [key]: updatedDrawings,
        },
      };
    }),

  removeDrawing: (key, drawingId) =>
    set((state) => {
      const drawings = state.chartDrawings[key] || [];
      const updatedDrawings = drawings.filter((d) => d.id !== drawingId);
      const [symbol, timeframe] = key.split("_") as [string, Timeframe];
      get().saveDrawingsDebounced(symbol, timeframe, updatedDrawings);
      return {
        chartDrawings: {
          ...state.chartDrawings,
          [key]: updatedDrawings,
        },
      };
    }),

  clearDrawings: (key) =>
    set((state) => {
      const [symbol, timeframe] = key.split("_") as [string, Timeframe];
      get().saveDrawingsDebounced(symbol, timeframe, []);
      return {
        chartDrawings: {
          ...state.chartDrawings,
          [key]: [],
        },
      };
    }),

  getDrawingsForChart: (symbol, timeframe) => {
    const key = `${symbol}_${timeframe}`;
    return get().chartDrawings[key] || [];
  },

  // ─── Load Drawings from Backend API ────────────────
  loadDrawings: async (symbol, timeframe) => {
    const key = `${symbol}_${timeframe}`;
    try {
      const res = await fetch(
        `/api/drawings?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`
      );
      const data = await res.json();
      if (data.success && data.drawingData) {
        set((state) => ({
          chartDrawings: {
            ...state.chartDrawings,
            [key]: data.drawingData,
          },
        }));
      }
    } catch (err) {
      console.error(`Failed to load drawings for ${key} from API:`, err);
    }
  },

  // ─── Auto-Save Drawings to DB with Debounce ────────
  saveDrawingsDebounced: (symbol, timeframe, drawings) => {
    const key = `${symbol}_${timeframe}`;

    if (debounceTimeouts[key]) {
      clearTimeout(debounceTimeouts[key]);
    }

    debounceTimeouts[key] = setTimeout(async () => {
      try {
        const response = await fetch("/api/drawings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            symbol,
            timeframe,
            drawingData: drawings,
          }),
        });
        const data = await response.json();
        if (!data.success) {
          console.warn(`Prisma auto-save returned failure status for ${key}`);
        }
      } catch (err) {
        console.error(`Prisma DB auto-save failed for ${key}:`, err);
      } finally {
        delete debounceTimeouts[key];
      }
    }, 1000);
  },

  // ─── Twelve Data single price fetch ───
  fetchSelectedStockPrice: async (symbol: string) => {
    const { twelveDataApiKey, smartSymbolSwitch } = get();
    const apiKey = twelveDataApiKey || "demo";
    const cleanSymbol = symbol.toUpperCase() === "APPLE" ? "AAPL" : symbol;
    const formatted = formatTwelveDataSymbol(cleanSymbol, smartSymbolSwitch);

    try {
      console.log(`[Twelve Data API] Fetching single price for: ${formatted}`);
      const res = await fetch(
        `https://api.twelvedata.com/price?symbol=${encodeURIComponent(formatted)}&apikey=${apiKey}`
      );
      const data = await res.json();

      if (data.status === "error" || !data.price) {
        console.error("[Twelve Data API] Price API error:", data.message);
        return;
      }

      const realPrice = parseFloat(data.price);
      // Force atomic overwrite into watchlists, selectedStock, and stocks
      get().setStockPrice(cleanSymbol, realPrice, 0, 0);
    } catch (err) {
      console.error(`[Twelve Data API] Failed to fetch price for ${cleanSymbol}:`, err);
    }
  },

  // ─── Fetch Ticker Pool & Categorize Watchlist ──────
  loadSettingsAndWatchlist: async () => {
    // 1. Fetch Twelve Data API Key
    try {
      const keyRes = await fetch("/api/stock/twelve-key");
      const keyData = await keyRes.json();
      if (keyData.success && keyData.apiKey) {
        set({ twelveDataApiKey: keyData.apiKey });
        console.log("[Store Action] Loaded Twelve Data API Key successfully.");
      }
    } catch (err) {
      console.warn("[Store Action] Failed to load Twelve Data key, using demo:", err);
    }

    // 2. Fetch admin config variables (refresh_interval, smart_sleep, active_theme_pack, smart_symbol_switch)
    let intervalSecs = 30;
    let smartSleepEnabled = false;
    let themePack = "tech";
    let switchEnabled = false;
    try {
      const intervalRes = await fetch("/api/admin/config?key=refresh_interval");
      const intervalData = await intervalRes.json();
      if (intervalData.success && intervalData.value) {
        intervalSecs = parseInt(intervalData.value) || 30;
      }

      const sleepRes = await fetch("/api/admin/config?key=smart_sleep");
      const sleepData = await sleepRes.json();
      if (sleepData.success && sleepData.value) {
        smartSleepEnabled = sleepData.value === "true";
      }

      const themeRes = await fetch("/api/admin/config?key=active_theme_pack");
      const themeData = await themeRes.json();
      if (themeData.success && themeData.value) {
        themePack = themeData.value;
      }

      const switchRes = await fetch("/api/admin/config?key=smart_symbol_switch");
      const switchData = await switchRes.json();
      if (switchData.success && switchData.value) {
        switchEnabled = switchData.value === "true";
      }
    } catch (err) {
      console.warn("[Store Action] Failed to load settings configs:", err);
    }

    set({
      refreshInterval: intervalSecs,
      smartSleep: smartSleepEnabled,
      activeThemePack: themePack,
      smartSymbolSwitch: switchEnabled,
    });

    // 3. Fetch watchlist tickers
    try {
      const res = await fetch("/api/admin/config?key=ticker_pool");
      const data = await res.json();
      let tickers = Object.keys(FALLBACK_PRICES); // Fallback defaults

      if (data.success && data.value) {
        try {
          tickers = JSON.parse(data.value);
        } catch (e) {
          console.error("Failed to parse ticker pool config", e);
        }
      }

      tickers = tickers.map((t) => (t.toUpperCase() === "APPLE" ? "AAPL" : t));

      const newWatchlists: Record<string, Stock[]> = {
        Tech: [],
        Crypto: [],
        Indices: [],
      };

      const newStocks: Record<string, Stock> = {};

      tickers.forEach((symbol) => {
        const name = STOCK_NAMES[symbol] || `${symbol} Asset`;

        const stockItem: Stock = {
          symbol,
          name,
          price: 0.0,
          change: 0.0,
          changePercent: 0.0,
        };

        newStocks[symbol] = stockItem;

        const lowerSym = symbol.toLowerCase();
        if (lowerSym.includes("/usd") || lowerSym.includes("btc") || lowerSym.includes("eth") || lowerSym.includes("sol")) {
          newWatchlists.Crypto.push(stockItem);
        } else if (["spy", "qqq", "dia", "iwm"].includes(lowerSym)) {
          newWatchlists.Indices.push(stockItem);
        } else {
          newWatchlists.Tech.push(stockItem);
        }
      });

      set({ watchlists: newWatchlists, stocks: newStocks });

      // Sync selection safely with new lists
      const currentActiveGroup = get().activeGroup;
      const activeGroupStocks = newWatchlists[currentActiveGroup] || [];
      let nextSelected = get().selectedStock;
      if (activeGroupStocks.length > 0) {
        const exists = activeGroupStocks.some((s) => s.symbol === nextSelected.symbol);
        if (!exists) {
          nextSelected = activeGroupStocks[0];
          set({ selectedStock: nextSelected });
        }
      } else {
        for (const group of ["Tech", "Crypto", "Indices"]) {
          if (newWatchlists[group].length > 0) {
            nextSelected = newWatchlists[group][0];
            set({ activeGroup: group, selectedStock: nextSelected });
            break;
          }
        }
      }

      // Trigger single price fetch for selected stock on load
      if (nextSelected) {
        await get().fetchSelectedStockPrice(nextSelected.symbol);
      }
    } catch (err) {
      console.error("Failed to initialize dynamic watchlist from API:", err);
    }
  },

  // ─── Live WebSocket price update dispatcher ───────
  setStockPrice: (symbol, price, change, changePercent) => {
    set((state) => {
      const updatedWatchlists = { ...state.watchlists };
      let updatedSelectedStock = state.selectedStock;

      for (const group of Object.keys(updatedWatchlists)) {
        updatedWatchlists[group] = updatedWatchlists[group].map((stock) => {
          if (stock.symbol === symbol) {
            const updatedStock = { ...stock, price, change, changePercent };
            if (state.selectedStock.symbol === symbol) {
              updatedSelectedStock = updatedStock;
            }
            return updatedStock;
          }
          return stock;
        });
      }

      const updatedStocks = { ...state.stocks };
      if (updatedStocks[symbol]) {
        updatedStocks[symbol] = {
          ...updatedStocks[symbol],
          price,
          change,
          changePercent,
        };
      } else {
        updatedStocks[symbol] = {
          symbol,
          name: STOCK_NAMES[symbol] || `${symbol} Asset`,
          price,
          change,
          changePercent,
        };
      }

      return {
        watchlists: updatedWatchlists,
        selectedStock: updatedSelectedStock,
        stocks: updatedStocks,
      };
    });
  },

  // Global search modal controls
  searchOpen: false,
  setSearchOpen: (open) => set({ searchOpen: open }),

  // Manual Force-Refresh Actions
  isRefreshing: false,
  refreshCurrentStock: async (symbol, timeframe) => {
    set({ isRefreshing: true });
    const targetSymbol = symbol.toUpperCase() === "APPLE" ? "AAPL" : symbol;
    try {
      console.log(`[Store Action] Initiated force-refresh for: ${targetSymbol} (${timeframe})`);
      
      // 1. Re-fetch K-line drawings from database
      await get().loadDrawings(targetSymbol, timeframe);

      // 2. Reload ticker pool lists and dynamic settings
      await get().loadSettingsAndWatchlist();
      
      // 3. Calibrate real-time price using Twelve Data single price endpoint
      await get().fetchSelectedStockPrice(targetSymbol);
    } catch (err) {
      console.error("[Store Action] Force-refresh execution failed:", err);
    } finally {
      // 2-second throttle delay
      await new Promise((resolve) => setTimeout(resolve, 2000));
      set({ isRefreshing: false });
    }
  },
}));
