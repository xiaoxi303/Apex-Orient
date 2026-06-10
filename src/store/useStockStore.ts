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
  Tech: [],
  Crypto: [],
  Indices: [],
};

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

const FALLBACK_PRICES: Record<string, number> = {};

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
  selectedStock: { symbol: "", name: "", price: 0, change: 0, changePercent: 0 },
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
  paneStocks: ["", "", "", ""],
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

  // ─── Twelve Data single price fetch (with hot-patch key) ───
  fetchSelectedStockPrice: async (symbol: string) => {
    if (!symbol) return;
    const cleanSymbol = symbol.toUpperCase();
    const formattedSymbol = get().smartSymbolSwitch ? `${cleanSymbol}:NASDAQ` : cleanSymbol;

    // ⚡ Hot-patch: if key is missing in memory, fetch it on the spot
    let apiKey = get().twelveDataApiKey;
    if (!apiKey) {
      try {
        const keyRes = await fetch("/api/stock/twelve-key");
        const keyData = await keyRes.json();
        if (keyData.success && keyData.apiKey) {
          apiKey = keyData.apiKey;
          set({ twelveDataApiKey: apiKey });
          console.log("[Twelve Data] Hot-patched API key into store.");
        }
      } catch (e) {
        console.error("[Store] Failed to hot-fetch Twelve Data key:", e);
      }
    }

    if (!apiKey) {
      console.error("[Twelve Data API] Cannot fetch price — API Key is missing entirely!");
      return;
    }

    try {
      console.log(`[Twelve Data API] Fetching single real price for: ${formattedSymbol}`);
      const res = await fetch(
        `https://api.twelvedata.com/price?symbol=${encodeURIComponent(formattedSymbol)}&apikey=${apiKey}`
      );
      const data = await res.json();

      if (data && data.price) {
        const price = parseFloat(data.price);

        const basePrice = 178.53;
        const change = parseFloat((price - basePrice).toFixed(2));
        const changePercent = parseFloat(((change / basePrice) * 100).toFixed(2));

        console.log(`[Twelve Data API] Injection success: ${price} for ${cleanSymbol}`);
        get().setStockPrice(cleanSymbol, price, change, changePercent);
      } else {
        console.error("[Twelve Data API] Response payload error or rate limited:", data);
      }
    } catch (err) {
      console.error(`[Twelve Data API] Single price fetch failed for ${cleanSymbol}:`, err);
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

      if (state.selectedStock.symbol === symbol) {
        updatedSelectedStock = {
          ...state.selectedStock,
          price,
          change,
          changePercent,
        };
      }

      for (const group of Object.keys(updatedWatchlists)) {
        updatedWatchlists[group] = updatedWatchlists[group].map((stock) => {
          if (stock.symbol === symbol) {
            return { ...stock, price, change, changePercent };
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
