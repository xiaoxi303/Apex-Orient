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
  // For fibonacci: additional levels
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

  // Global Search Modal State (Stage 3 Extension)
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;

  // Manual Force-Refresh Actions (Stage 3 Extension)
  isRefreshing: boolean;
  refreshCurrentStock: (symbol: string, timeframe: Timeframe) => Promise<void>;

  // Stage 3 Full-Stack & Live sync actions
  loadDrawings: (symbol: string, timeframe: Timeframe) => Promise<void>;
  saveDrawingsDebounced: (symbol: string, timeframe: Timeframe, drawings: DrawingItem[]) => void;
  loadSettingsAndWatchlist: () => Promise<void>;
  setStockPrice: (symbol: string, price: number, change: number, changePercent: number) => void;
}

// ─── Debounce Timer Map ────────────────────────────────────
const debounceTimeouts: Record<string, NodeJS.Timeout> = {};

// ─── Default Fallback Stocks ────────────────────────────────
const defaultStocks: Record<string, Stock[]> = {
  Tech: [
    { symbol: "AAPL", name: "Apple Inc.", price: 178.53, change: 1.42, changePercent: 0.8 },
    { symbol: "MSFT", name: "Microsoft Corp.", price: 415.50, change: -2.35, changePercent: -0.56 },
    { symbol: "NVDA", name: "NVIDIA Corp.", price: 875.12, change: 18.45, changePercent: 2.15 },
    { symbol: "TSLA", name: "Tesla Inc.", price: 172.98, change: -4.12, changePercent: -2.33 },
    { symbol: "GOOGL", name: "Alphabet Inc.", price: 151.60, change: 0.95, changePercent: 0.63 },
    { symbol: "META", name: "Meta Platforms", price: 495.22, change: 5.10, changePercent: 1.04 },
  ],
  Crypto: [
    { symbol: "BTC/USD", name: "Bitcoin / USD", price: 67250.00, change: 1250.00, changePercent: 1.89 },
    { symbol: "ETH/USD", name: "Ethereum / USD", price: 3540.50, change: -45.20, changePercent: -1.26 },
    { symbol: "SOL/USD", name: "Solana / USD", price: 148.25, change: 8.75, changePercent: 6.27 },
    { symbol: "DOGE/USD", name: "Dogecoin / USD", price: 0.142, change: 0.008, changePercent: 5.97 },
  ],
  Indices: [
    { symbol: "SPY", name: "SPDR S&P 500 ETF", price: 512.85, change: 2.10, changePercent: 0.41 },
    { symbol: "QQQ", name: "Invesco QQQ Trust", price: 438.60, change: 1.22, changePercent: 0.28 },
    { symbol: "DIA", name: "SPDR Dow Jones ETF", price: 389.90, change: -0.85, changePercent: -0.22 },
    { symbol: "IWM", name: "iShares Russell 2000 ETF", price: 202.15, change: 2.45, changePercent: 1.23 },
  ],
};

// ─── Helper mappings for dynamic watchlist seeding ────────
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
};

const BASE_PRICES: Record<string, number> = {
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
};

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

  // Selection
  selectedStock: defaultStocks["Tech"][0],
  setSelectedStock: (stock) => set({ selectedStock: stock }),

  // Layout
  layoutMode: "single",
  setLayoutMode: (mode) => set({ layoutMode: mode }),
  paneStocks: ["AAPL", "MSFT", "NVDA", "TSLA"],
  setPaneStock: (index, symbol) =>
    set((state) => {
      const updated = [...state.paneStocks];
      updated[index] = symbol;
      return { paneStocks: updated };
    }),

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

  // ─── Stage 3: Load Drawings from Backend API ────────────────
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

  // ─── Stage 3: Auto-Save Drawings to DB with Debounce ────────
  saveDrawingsDebounced: (symbol, timeframe, drawings) => {
    const key = `${symbol}_${timeframe}`;

    // Clear any pending timeout for this symbol_timeframe pair
    if (debounceTimeouts[key]) {
      clearTimeout(debounceTimeouts[key]);
    }

    // Schedule database write 1 second after user actions stop
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

  // ─── Stage 3: Fetch Ticker Pool & Categorize Watchlist ──────
  loadSettingsAndWatchlist: async () => {
    try {
      const res = await fetch("/api/admin/config?key=ticker_pool");
      const data = await res.json();
      let tickers = Object.keys(BASE_PRICES); // Fallback defaults

      if (data.success && data.value) {
        try {
          tickers = JSON.parse(data.value);
        } catch (e) {
          console.error("Failed to parse ticker pool config", e);
        }
      }

      // Re-initialize watchlist groups based on dynamic tickers
      const newWatchlists: Record<string, Stock[]> = {
        Tech: [],
        Crypto: [],
        Indices: [],
      };

      tickers.forEach((symbol) => {
        const name = STOCK_NAMES[symbol] || `${symbol} Asset`;
        const basePrice = BASE_PRICES[symbol] || 100.0;

        const stockItem: Stock = {
          symbol,
          name,
          price: basePrice,
          change: 0.0,
          changePercent: 0.0,
        };

        // Classify asset types dynamically
        const lowerSym = symbol.toLowerCase();
        if (lowerSym.includes("/usd") || lowerSym.includes("btc") || lowerSym.includes("eth") || lowerSym.includes("sol")) {
          newWatchlists.Crypto.push(stockItem);
        } else if (["spy", "qqq", "dia", "iwm"].includes(lowerSym)) {
          newWatchlists.Indices.push(stockItem);
        } else {
          newWatchlists.Tech.push(stockItem);
        }
      });

      set({ watchlists: newWatchlists });

      // Sync selection safely with new lists
      const currentActiveGroup = get().activeGroup;
      const activeGroupStocks = newWatchlists[currentActiveGroup] || [];
      if (activeGroupStocks.length > 0) {
        const currentSelected = get().selectedStock;
        const exists = activeGroupStocks.some((s) => s.symbol === currentSelected.symbol);
        if (!exists) {
          set({ selectedStock: activeGroupStocks[0] });
        }
      } else {
        // Fallback to first non-empty watchlist group
        for (const group of ["Tech", "Crypto", "Indices"]) {
          if (newWatchlists[group].length > 0) {
            set({ activeGroup: group, selectedStock: newWatchlists[group][0] });
            break;
          }
        }
      }
    } catch (err) {
      console.error("Failed to initialize dynamic watchlist from API:", err);
    }
  },

  // ─── Stage 3: Live WebSocket price update dispatcher ───────
  setStockPrice: (symbol, price, change, changePercent) => {
    set((state) => {
      const updatedWatchlists = { ...state.watchlists };
      let stockUpdated = false;
      let updatedSelectedStock = state.selectedStock;

      for (const group of Object.keys(updatedWatchlists)) {
        updatedWatchlists[group] = updatedWatchlists[group].map((stock) => {
          if (stock.symbol === symbol) {
            stockUpdated = true;
            const updatedStock = { ...stock, price, change, changePercent };
            if (state.selectedStock.symbol === symbol) {
              updatedSelectedStock = updatedStock;
            }
            return updatedStock;
          }
          return stock;
        });
      }

      if (stockUpdated) {
        return {
          watchlists: updatedWatchlists,
          selectedStock: updatedSelectedStock,
        };
      }
      return {};
    });
  },

  // Global search modal controls
  searchOpen: false,
  setSearchOpen: (open) => set({ searchOpen: open }),

  // Manual Force-Refresh Actions (Stage 3 Extension)
  isRefreshing: false,
  refreshCurrentStock: async (symbol, timeframe) => {
    set({ isRefreshing: true });
    try {
      console.log(`[Store Action] Initiated force-refresh for: ${symbol} (${timeframe})`);
      
      // 1. Re-fetch K-line drawings from database
      await get().loadDrawings(symbol, timeframe);

      // 2. Reload ticker pool lists and dynamic settings
      await get().loadSettingsAndWatchlist();
      
    } catch (err) {
      console.error("[Store Action] Force-refresh execution failed:", err);
    } finally {
      // Visual feedback buffer so user notices the spinning icon
      await new Promise((resolve) => setTimeout(resolve, 600));
      set({ isRefreshing: false });
    }
  },
}));
