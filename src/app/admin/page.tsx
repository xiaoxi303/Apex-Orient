"use client";

import React, { useState, useEffect } from "react";
import { GlassCard } from "@/components/GlassCard";
import { Navbar } from "@/components/Navbar";
import { cn } from "@/utils/cn";
import {
  Lock,
  Radio,
  ListPlus,
  Trash2,
  Plus,
  Send,
  Save,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AdminPage() {
  const [passcode, setPasscode] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Guard configuration
  const CORRECT_PASSCODE = "apex-orient-2026";

  // News Briefing state
  const [newsBrief, setNewsBrief] = useState("");
  const [newsStatus, setNewsStatus] = useState<"idle" | "saving" | "success" | "error">("idle");

  // Ticker pool state
  const [tickerPool, setTickerPool] = useState<string[]>([]);
  const [newTicker, setNewTicker] = useState("");
  const [tickerStatus, setTickerStatus] = useState<"idle" | "saving" | "success" | "error">("idle");

  // Dynamic API configuration state (Stage 3 Extension)
  const [provider, setProvider] = useState("finnhub");
  const [apiKey, setApiKey] = useState("");
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);
  const [apiConfigStatus, setApiConfigStatus] = useState<"idle" | "saving" | "success" | "error">("idle");

  // Load configuration on authorization success
  useEffect(() => {
    if (!isAuthorized) return;

    // Fetch current settings
    const fetchSettings = async () => {
      try {
        // Fetch news brief
        const resNews = await fetch("/api/admin/config?key=news_brief");
        const dataNews = await resNews.json();
        if (dataNews.success && dataNews.value) {
          setNewsBrief(dataNews.value);
        }

        // Fetch ticker pool
        const resTickers = await fetch("/api/admin/config?key=ticker_pool");
        const dataTickers = await resTickers.json();
        if (dataTickers.success && dataTickers.value) {
          try {
            setTickerPool(JSON.parse(dataTickers.value));
          } catch (e) {
            console.error("Failed to parse ticker pool JSON", e);
          }
        } else {
          // Defaults if not set
          setTickerPool([
            "AAPL",
            "MSFT",
            "NVDA",
            "TSLA",
            "GOOGL",
            "META",
            "BTC/USD",
            "ETH/USD",
            "SOL/USD",
            "DOGE/USD",
            "SPY",
            "QQQ",
            "DIA",
            "IWM",
          ]);
        }

        // Fetch active API configuration
        const resApi = await fetch("/api/admin/config?key=api_config");
        const dataApi = await resApi.json();
        if (dataApi.success && dataApi.value) {
          try {
            const parsed = JSON.parse(dataApi.value);
            setProvider(parsed.provider || "finnhub");
            setApiKey(parsed.active_key || "");
          } catch (e) {
            console.error("Failed to parse api config JSON", e);
          }
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    };

    fetchSettings();
  }, [isAuthorized]);

  // Handle passcode authorization
  const handleAuthorize = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === CORRECT_PASSCODE) {
      setIsAuthorized(true);
      setErrorMsg("");
    } else {
      setErrorMsg("Invalid Admin Passcode. Please try again.");
    }
  };

  // Save News Briefing
  const handleSaveNews = async () => {
    if (!newsBrief.trim()) return;
    setNewsStatus("saving");
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "news_brief", value: newsBrief }),
      });
      const data = await res.json();
      if (data.success) {
        setNewsStatus("success");
        setTimeout(() => setNewsStatus("idle"), 3000);
      } else {
        setNewsStatus("error");
      }
    } catch (err) {
      console.error(err);
      setNewsStatus("error");
    }
  };

  // Save Ticker Pool
  const handleSaveTickers = async () => {
    setTickerStatus("saving");
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "ticker_pool", value: JSON.stringify(tickerPool) }),
      });
      const data = await res.json();
      if (data.success) {
        setTickerStatus("success");
        setTimeout(() => setTickerStatus("idle"), 3000);
      } else {
        setTickerStatus("error");
      }
    } catch (err) {
      console.error(err);
      setTickerStatus("error");
    }
  };

  // Save API Key Configuration (Stage 3 Extension)
  const handleSaveApiConfig = async () => {
    setApiConfigStatus("saving");
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "api_config",
          value: JSON.stringify({
            provider,
            active_key: apiKey,
            backup_keys: [],
          }),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setApiConfigStatus("success");
        setTimeout(() => setApiConfigStatus("idle"), 3000);
        
        // Refresh with masked key returned from the GET logic to maintain security state
        const resReload = await fetch("/api/admin/config?key=api_config");
        const dataReload = await resReload.json();
        if (dataReload.success && dataReload.value) {
          const parsed = JSON.parse(dataReload.value);
          setApiKey(parsed.active_key || "");
        }
      } else {
        setApiConfigStatus("error");
      }
    } catch (err) {
      console.error(err);
      setApiConfigStatus("error");
    }
  };

  // Add a stock ticker to the local pool state
  const handleAddTicker = (e: React.FormEvent) => {
    e.preventDefault();
    const formatted = newTicker.trim().toUpperCase();
    if (!formatted) return;

    if (tickerPool.includes(formatted)) {
      setNewTicker("");
      return;
    }

    setTickerPool([...tickerPool, formatted]);
    setNewTicker("");
  };

  // Remove a ticker from local pool state
  const handleRemoveTicker = (tickerToRemove: string) => {
    setTickerPool(tickerPool.filter((t) => t !== tickerToRemove));
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#07090e] text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-300">
      <Navbar />

      <div className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Abstract Liquid Neon Blurs */}
        <div className="absolute top-[10%] left-[20%] w-[35%] h-[35%] rounded-full bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[10%] right-[20%] w-[35%] h-[35%] rounded-full bg-gradient-to-tr from-pink-500/10 to-indigo-500/20 blur-[100px] pointer-events-none" />

        <AnimatePresence mode="wait">
          {!isAuthorized ? (
            /* Passcode Guard screen */
            <motion.div
              key="guard"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-md relative z-10"
            >
              <GlassCard className="p-8 flex flex-col items-center justify-center border border-white/40 dark:border-white/10 shadow-2xl relative">
                {/* Glowing fluid border effects */}
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-pink-500/10 rounded-3xl -z-10 blur-xl" />

                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 dark:bg-indigo-400/10 flex items-center justify-center text-indigo-500 dark:text-indigo-400 mb-6 border border-indigo-500/20">
                  <Lock size={32} className="animate-pulse" />
                </div>

                <h2 className="text-xl font-bold tracking-wider mb-2 bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                  APEX ADMIN RADAR
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-6 max-w-xs font-medium">
                  Access key required to publish live briefings and update central system stock pools.
                </p>

                <form onSubmit={handleAuthorize} className="w-full space-y-4">
                  <div>
                    <input
                      type="password"
                      placeholder="Enter Access Key..."
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                      className={cn(
                        "w-full px-4 py-3 rounded-xl text-center text-sm font-mono tracking-widest",
                        "bg-white/50 dark:bg-black/40 border border-black/10 dark:border-white/10",
                        "focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50",
                        "text-slate-800 dark:text-white transition-all duration-300"
                      )}
                    />
                  </div>

                  {errorMsg && (
                    <div className="flex items-center gap-2 text-xs font-semibold text-rose-500 justify-center">
                      <AlertTriangle size={14} />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className={cn(
                      "w-full py-3 rounded-xl text-xs font-bold tracking-widest uppercase transition-all duration-300",
                      "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/20",
                      "hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98]"
                    )}
                  >
                    Authorize Access
                  </button>
                </form>
              </GlassCard>
            </motion.div>
          ) : (
            /* Admin Control Panel: 3 Columns Grid for dynamic scaling */
            <motion.div
              key="panel"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10"
            >
              {/* Card A: Breaking News Broadcasting */}
              <GlassCard className="p-6 border border-white/40 dark:border-white/10 shadow-xl flex flex-col h-[460px]">
                <div className="flex items-center justify-between mb-4 border-b border-black/5 dark:border-white/5 pb-3 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20">
                      <Radio size={18} className="animate-pulse" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm tracking-wider">News Marquee</h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Navbar global rolling announcement banner
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 flex flex-col space-y-4 min-h-0">
                  <textarea
                    value={newsBrief}
                    onChange={(e) => setNewsBrief(e.target.value)}
                    placeholder="Enter breaking update text... Add emojis or bullet symbols (e.g. ⚡, 🔥, 💎)"
                    className={cn(
                      "flex-1 w-full p-4 rounded-xl text-xs font-medium resize-none leading-relaxed",
                      "bg-white/50 dark:bg-black/30 border border-black/10 dark:border-white/10",
                      "focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50",
                      "text-slate-800 dark:text-slate-100 transition-all duration-300"
                    )}
                  />

                  <div className="flex items-center justify-between pt-2 shrink-0">
                    <span className="text-[10px] text-slate-400 font-semibold font-mono">
                      Characters: {newsBrief.length}
                    </span>

                    <button
                      onClick={handleSaveNews}
                      disabled={newsStatus === "saving"}
                      className={cn(
                        "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300",
                        newsStatus === "success"
                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                          : newsStatus === "error"
                          ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                          : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/30"
                      )}
                    >
                      {newsStatus === "saving" ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-white rounded-full animate-spin" />
                          <span>Publishing...</span>
                        </>
                      ) : newsStatus === "success" ? (
                        <>
                          <CheckCircle2 size={14} />
                          <span>Broadcast Live</span>
                        </>
                      ) : newsStatus === "error" ? (
                        <>
                          <AlertTriangle size={14} />
                          <span>Broadcast Failed</span>
                        </>
                      ) : (
                        <>
                          <Send size={14} />
                          <span>Publish Broadcast</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </GlassCard>

              {/* Card B: Watchlist Pool Management */}
              <GlassCard className="p-6 border border-white/40 dark:border-white/10 shadow-xl flex flex-col h-[460px]">
                <div className="flex items-center justify-between mb-4 border-b border-black/5 dark:border-white/5 pb-3 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                      <ListPlus size={18} />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm tracking-wider">Stock Ticker Manager</h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Manages the central pool of tradable US assets
                      </p>
                    </div>
                  </div>
                </div>

                {/* Add new ticker form */}
                <form onSubmit={handleAddTicker} className="flex gap-2 mb-4 shrink-0">
                  <input
                    type="text"
                    placeholder="Enter ticker (e.g. MSFT, ETH/USD)..."
                    value={newTicker}
                    onChange={(e) => setNewTicker(e.target.value)}
                    className={cn(
                      "flex-1 px-4 py-2.5 rounded-xl text-xs font-bold tracking-wider",
                      "bg-white/50 dark:bg-black/30 border border-black/10 dark:border-white/10",
                      "focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50",
                      "text-slate-800 dark:text-slate-100 transition-all duration-300"
                    )}
                  />
                  <button
                    type="submit"
                    className="p-2.5 bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 border border-black/10 dark:border-white/10 text-indigo-500 dark:text-indigo-400 rounded-xl transition-all duration-300 hover:scale-105"
                  >
                    <Plus size={18} />
                  </button>
                </form>

                {/* Tickers Tag list */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 -mr-2 mb-4 custom-scrollbar">
                  <div className="flex flex-wrap gap-2">
                    {tickerPool.map((ticker) => (
                      <div
                        key={ticker}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold tracking-wider border transition-all duration-300 shadow-sm hover:scale-[1.02]",
                          "bg-white/40 dark:bg-white/[0.04]",
                          "border-black/5 dark:border-white/5 text-slate-700 dark:text-slate-300"
                        )}
                      >
                        <span>{ticker}</span>
                        <button
                          onClick={() => handleRemoveTicker(ticker)}
                          className="hover:text-red-500 transition-colors p-0.5 rounded-md hover:bg-red-500/10"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    {tickerPool.length === 0 && (
                      <div className="w-full flex flex-col items-center justify-center py-12 text-slate-400 text-xs">
                        <AlertTriangle size={24} className="opacity-50 mb-2" />
                        <span>No tickers in pool.</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Save Ticker Pool Action */}
                <div className="flex items-center justify-between border-t border-black/5 dark:border-white/5 pt-3 shrink-0">
                  <span className="text-[10px] text-slate-400 font-semibold font-mono">
                    Total Tickers: {tickerPool.length}
                  </span>

                  <button
                    onClick={handleSaveTickers}
                    disabled={tickerStatus === "saving"}
                    className={cn(
                      "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300",
                      tickerStatus === "success"
                        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                        : tickerStatus === "error"
                        ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                        : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/30"
                    )}
                  >
                    {tickerStatus === "saving" ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-white rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : tickerStatus === "success" ? (
                      <>
                        <CheckCircle2 size={14} />
                        <span>Watchlist Saved</span>
                      </>
                    ) : tickerStatus === "error" ? (
                      <>
                        <AlertTriangle size={14} />
                        <span>Saving Failed</span>
                      </>
                    ) : (
                      <>
                        <Save size={14} />
                        <span>Save Watchlist Pool</span>
                      </>
                    )}
                  </button>
                </div>
              </GlassCard>

              {/* Card C: Data Source & API Key Config (Stage 3 Extension) */}
              <GlassCard className="p-6 border border-white/40 dark:border-white/10 shadow-xl flex flex-col h-[460px]">
                <div className="flex items-center justify-between mb-4 border-b border-black/5 dark:border-white/5 pb-3 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      <KeyRound size={18} />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm tracking-wider">API Credentials</h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Manages dynamic market data connections
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 flex flex-col justify-between min-h-0 space-y-6">
                  <div className="space-y-4">
                    {/* Provider Select Dropdown */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Data Provider
                      </label>
                      <select
                        value={provider}
                        onChange={(e) => setProvider(e.target.value)}
                        className={cn(
                          "w-full px-3 py-2.5 rounded-xl text-xs font-bold bg-white/50 dark:bg-black/30 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 text-slate-800 dark:text-slate-100"
                        )}
                      >
                        <option value="finnhub" className="dark:bg-[#0c0f17]">Finnhub WebSocket</option>
                        <option value="polygon" className="dark:bg-[#0c0f17]">Polygon.io Stream</option>
                        <option value="alphavantage" className="dark:bg-[#0c0f17]">AlphaVantage Feed</option>
                        <option value="simulation" className="dark:bg-[#0c0f17]">Mock Market Simulator</option>
                      </select>
                    </div>

                    {/* API Key Input with Show/Hide toggle */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        API Token / Key
                      </label>
                      <div className="relative">
                        <input
                          type={isApiKeyVisible ? "text" : "password"}
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder="Enter token string..."
                          className={cn(
                            "w-full pl-3 pr-10 py-2.5 rounded-xl text-xs font-mono tracking-wider",
                            "bg-white/50 dark:bg-black/30 border border-black/10 dark:border-white/10",
                            "focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50",
                            "text-slate-800 dark:text-slate-100"
                          )}
                        />
                        {/* Eye Show/Hide toggler */}
                        <button
                          type="button"
                          onClick={() => setIsApiKeyVisible(!isApiKeyVisible)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        >
                          {isApiKeyVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      <p className="text-[9px] text-slate-400 italic">
                        * Token is masked securely on retrieval. Unaltered masking asterisks will not override raw configurations upon saving.
                      </p>
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="flex items-center justify-end border-t border-black/5 dark:border-white/5 pt-3 shrink-0">
                    <button
                      onClick={handleSaveApiConfig}
                      disabled={apiConfigStatus === "saving"}
                      className={cn(
                        "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300",
                        apiConfigStatus === "success"
                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                          : apiConfigStatus === "error"
                          ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                          : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/30"
                      )}
                    >
                      {apiConfigStatus === "saving" ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>Connecting...</span>
                        </>
                      ) : apiConfigStatus === "success" ? (
                        <>
                          <CheckCircle2 size={14} />
                          <span>Saved & Restarted</span>
                        </>
                      ) : apiConfigStatus === "error" ? (
                        <>
                          <AlertTriangle size={14} />
                          <span>Restart Failed</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw size={14} />
                          <span>Save & Restart Stream</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
