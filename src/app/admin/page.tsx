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
  Sliders,
  Cpu,
  Coins,
  Globe,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Asset packs for injection
const ASSET_PACKS = {
  tech: {
    name: "科技美股包",
    icon: Cpu,
    color: "from-blue-500/20 to-indigo-500/20 border-blue-500/30 text-blue-400 shadow-blue-500/5",
    glow: "bg-blue-500/10",
    tickers: ["AAPL", "MSFT", "NVDA", "TSLA", "GOOGL", "META", "AMZN", "NFLX"],
    desc: "Apple, Microsoft, Nvidia, Tesla, Google, Meta, Amazon, Netflix"
  },
  crypto: {
    name: "全球加密货币包",
    icon: Coins,
    color: "from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-400 shadow-amber-500/5",
    glow: "bg-amber-500/10",
    tickers: ["BTC/USD", "ETH/USD", "SOL/USD", "DOGE/USD", "ADA/USD", "XRP/USD", "DOT/USD", "LINK/USD"],
    desc: "BTC, ETH, SOL, DOGE, ADA, XRP, DOT, LINK (Twelve Data Standard)"
  },
  forex: {
    name: "国际外汇血脉包",
    icon: Globe,
    color: "from-emerald-500/20 to-cyan-500/20 border-emerald-500/30 text-emerald-400 shadow-emerald-500/5",
    glow: "bg-emerald-500/10",
    tickers: ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD", "GBP/JPY", "EUR/GBP", "CHF/USD"],
    desc: "EUR, GBP, JPY, AUD, CAD exchange rates against major currencies"
  }
};

export default function AdminPage() {
  const [passcode, setPasscode] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const CORRECT_PASSCODE = "apex-orient-2026";

  // News Briefing state
  const [newsBrief, setNewsBrief] = useState("");
  const [newsStatus, setNewsStatus] = useState<"idle" | "saving" | "success" | "error">("idle");

  // Ticker pool state
  const [tickerPool, setTickerPool] = useState<string[]>([]);
  const [newTicker, setNewTicker] = useState("");
  const [tickerStatus, setTickerStatus] = useState<"idle" | "saving" | "success" | "error">("idle");

  // API Configuration state
  const [provider, setProvider] = useState("twelvedata");
  const [apiKey, setApiKey] = useState("");
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);
  const [apiConfigStatus, setApiConfigStatus] = useState<"idle" | "saving" | "success" | "error">("idle");

  // Rate limit and Smart sleep states
  const [refreshInterval, setRefreshInterval] = useState<number>(30); // 15s, 30s, 60s
  const [smartSleep, setSmartSleep] = useState<boolean>(true);
  const [rateLimitStatus, setRateLimitStatus] = useState<"idle" | "saving" | "success" | "error">("idle");

  // Smart Symbol Switch (Exchange Suffix Formatter)
  const [smartSymbolSwitch, setSmartSymbolSwitch] = useState<boolean>(false);
  const [switchStatus, setSwitchStatus] = useState<"idle" | "saving" | "success" | "error">("idle");

  // Asset injection states
  const [injectingPack, setInjectingPack] = useState<string | null>(null);
  const [injectStatus, setInjectStatus] = useState<Record<string, "idle" | "success" | "error">>({
    tech: "idle",
    crypto: "idle",
    forex: "idle"
  });

  // Load configuration on authorization success
  useEffect(() => {
    if (!isAuthorized) return;

    const fetchSettings = async () => {
      try {
        // News
        const resNews = await fetch("/api/admin/config?key=news_brief");
        const dataNews = await resNews.json();
        if (dataNews.success && dataNews.value) {
          setNewsBrief(dataNews.value);
        }

        // Tickers
        const resTickers = await fetch("/api/admin/config?key=ticker_pool");
        const dataTickers = await resTickers.json();
        if (dataTickers.success && dataTickers.value) {
          try {
            setTickerPool(JSON.parse(dataTickers.value));
          } catch (e) {
            console.error("Failed to parse ticker pool", e);
          }
        }

        // API Configuration
        const resApi = await fetch("/api/admin/config?key=api_config");
        const dataApi = await resApi.json();
        if (dataApi.success && dataApi.value) {
          try {
            const parsed = JSON.parse(dataApi.value);
            setProvider(parsed.provider || "twelvedata");
            setApiKey(parsed.active_key || "");
          } catch (e) {
            console.error("Failed to parse api config JSON", e);
          }
        }

        // Rate Limit & Heartbeat intervals
        const resInterval = await fetch("/api/admin/config?key=refresh_interval");
        const dataInterval = await resInterval.json();
        if (dataInterval.success && dataInterval.value) {
          setRefreshInterval(parseInt(dataInterval.value) || 30);
        }

        const resSleep = await fetch("/api/admin/config?key=smart_sleep");
        const dataSleep = await resSleep.json();
        if (dataSleep.success && dataSleep.value) {
          setSmartSleep(dataSleep.value === "true");
        }

        // Smart symbol switch
        const resSwitch = await fetch("/api/admin/config?key=smart_symbol_switch");
        const dataSwitch = await resSwitch.json();
        if (dataSwitch.success && dataSwitch.value) {
          setSmartSymbolSwitch(dataSwitch.value === "true");
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    };

    fetchSettings();
  }, [isAuthorized]);

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

  // Save API Credentials Vault
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
        
        // Reload settings to get masked key
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

  // Save Rate Limit & Smart Sleep
  const handleSaveRateLimit = async () => {
    setRateLimitStatus("saving");
    try {
      const resInterval = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "refresh_interval", value: refreshInterval.toString() }),
      });
      const resSleep = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "smart_sleep", value: smartSleep.toString() }),
      });
      const dataInterval = await resInterval.json();
      const dataSleep = await resSleep.json();

      if (dataInterval.success && dataSleep.success) {
        setRateLimitStatus("success");
        setTimeout(() => setRateLimitStatus("idle"), 3000);
      } else {
        setRateLimitStatus("error");
      }
    } catch (err) {
      console.error(err);
      setRateLimitStatus("error");
    }
  };

  // Save Smart Symbol Switch
  const handleSaveSwitch = async (val: boolean) => {
    setSmartSymbolSwitch(val);
    setSwitchStatus("saving");
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "smart_symbol_switch", value: val.toString() }),
      });
      const data = await res.json();
      if (data.success) {
        setSwitchStatus("success");
        setTimeout(() => setSwitchStatus("idle"), 2000);
      } else {
        setSwitchStatus("error");
      }
    } catch (err) {
      console.error(err);
      setSwitchStatus("error");
    }
  };

  // Asset Pack Injection
  const handleInjectPack = async (packKey: keyof typeof ASSET_PACKS) => {
    setInjectingPack(packKey);
    const pack = ASSET_PACKS[packKey];
    try {
      // 1. Post ticker pool override
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "ticker_pool", value: JSON.stringify(pack.tickers) }),
      });
      
      // 2. Post active theme pack override
      await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "active_theme_pack", value: packKey }),
      });

      const data = await res.json();
      if (data.success) {
        setTickerPool(pack.tickers);
        setInjectStatus((prev) => ({ ...prev, [packKey]: "success" }));
        setTimeout(() => {
          setInjectStatus((prev) => ({ ...prev, [packKey]: "idle" }));
          setInjectingPack(null);
        }, 2500);
      } else {
        setInjectStatus((prev) => ({ ...prev, [packKey]: "error" }));
        setTimeout(() => {
          setInjectStatus((prev) => ({ ...prev, [packKey]: "idle" }));
          setInjectingPack(null);
        }, 2500);
      }
    } catch (err) {
      console.error(err);
      setInjectStatus((prev) => ({ ...prev, [packKey]: "error" }));
      setTimeout(() => {
        setInjectStatus((prev) => ({ ...prev, [packKey]: "idle" }));
        setInjectingPack(null);
      }, 2500);
    }
  };

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

  const handleRemoveTicker = (tickerToRemove: string) => {
    setTickerPool(tickerPool.filter((t) => t !== tickerToRemove));
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#030712] text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-300">
      <Navbar />

      <div className="flex-1 flex items-start justify-center p-6 relative overflow-hidden">
        {/* Abstract Liquid Neon Blurs */}
        <div className="absolute top-[5%] left-[10%] w-[45%] h-[45%] rounded-full bg-gradient-to-tr from-indigo-500/10 via-purple-500/10 to-transparent blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[5%] right-[10%] w-[45%] h-[45%] rounded-full bg-gradient-to-tr from-pink-500/8 via-cyan-500/10 to-transparent blur-[120px] pointer-events-none" />

        <AnimatePresence mode="wait">
          {!isAuthorized ? (
            /* Passcode Guard screen */
            <motion.div
              key="guard"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-md mt-24 relative z-10"
            >
              <GlassCard className="p-8 flex flex-col items-center justify-center border border-white/40 dark:border-white/10 shadow-2xl relative bg-white/40 dark:bg-[#0b0f19]/40 backdrop-blur-xl">
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-pink-500/5 rounded-3xl -z-10 blur-xl" />

                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 dark:bg-indigo-400/10 flex items-center justify-center text-indigo-500 dark:text-indigo-400 mb-6 border border-indigo-500/20">
                  <Lock size={32} className="animate-pulse" />
                </div>

                <h2 className="text-xl font-bold tracking-wider mb-2 bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                  APEX ADMIN RADAR
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-6 max-w-xs font-medium">
                  Access key required to unlock data keys, limits, and multi-asset injector options.
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
                        "bg-white/40 dark:bg-black/40 border border-black/10 dark:border-white/10",
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
            /* Liquid Glass Admin Console Layout */
            <motion.div
              key="panel"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10"
            >
              
              {/* Left Column: Config Key Vault & Rate Limits */}
              <div className="flex flex-col gap-6">
                
                {/* Module A: Credentials Vault */}
                <GlassCard className="p-6 border border-white/40 dark:border-white/10 shadow-xl flex flex-col bg-white/40 dark:bg-[#0b0f19]/40 backdrop-blur-xl hover:shadow-2xl hover:border-white/50 dark:hover:border-white/20 transition-all duration-300">
                  <div className="flex items-center justify-between mb-5 border-b border-black/5 dark:border-white/5 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        <KeyRound size={18} />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm tracking-wider">数据源核心钥匙夹</h3>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Credentials Vault</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Provider Selection */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">数据源服务商</label>
                        {provider === "twelvedata" && (
                          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[8px] font-bold shadow-[0_0_12px_rgba(16,185,129,0.35)] animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            <span>NEON GREEN LINKED</span>
                          </div>
                        )}
                      </div>
                      <select
                        value={provider}
                        onChange={(e) => setProvider(e.target.value)}
                        className={cn(
                          "w-full px-3 py-2.5 rounded-xl text-xs font-bold bg-white/50 dark:bg-black/30 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 text-slate-800 dark:text-slate-100",
                          provider === "twelvedata" && "border-emerald-500/30 dark:border-emerald-500/40 text-emerald-500 dark:text-emerald-400 focus:border-emerald-500 focus:ring-emerald-500"
                        )}
                      >
                        <option value="twelvedata" className="dark:bg-[#0c0f17]">Twelve Data (前端直连)</option>
                        <option value="finnhub" className="dark:bg-[#0c0f17]">Finnhub WebSocket</option>
                        <option value="polygon" className="dark:bg-[#0c0f17]">Polygon.io Stream</option>
                        <option value="simulation" className="dark:bg-[#0c0f17]">Mock Market Simulator</option>
                      </select>
                    </div>

                    {/* API Key details */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">API 凭据密钥</label>
                        
                        {/* Twelve Data Warning LED Indicator */}
                        {provider === "twelvedata" && (
                          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 dark:text-amber-400 text-[8px] font-bold animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_#f59e0b]" />
                            <span>8 req/min 额度保护</span>
                          </div>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type={isApiKeyVisible ? "text" : "password"}
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder="Enter Provider API Key..."
                          className={cn(
                            "w-full pl-3 pr-10 py-2.5 rounded-xl text-xs font-mono tracking-wider",
                            "bg-white/50 dark:bg-black/30 border border-black/10 dark:border-white/10",
                            "focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50",
                            "text-slate-800 dark:text-slate-100"
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => setIsApiKeyVisible(!isApiKeyVisible)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        >
                          {isApiKeyVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      <p className="text-[8px] text-slate-400 leading-normal">
                        * 已接入无损脱敏逻辑。获取配置时自动部分脱敏，如保存时填写包含 &apos;*&apos; 的脱敏字样，系统将自动保持原密钥不变。
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end border-t border-black/5 dark:border-white/5 pt-4 mt-5">
                    <button
                      onClick={handleSaveApiConfig}
                      disabled={apiConfigStatus === "saving"}
                      className={cn(
                        "flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 w-full relative overflow-hidden",
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
                          <span>正在同步密钥...</span>
                        </>
                      ) : apiConfigStatus === "success" ? (
                        <>
                          <CheckCircle2 size={14} className="text-emerald-500" />
                          <span>凭据保存成功</span>
                        </>
                      ) : apiConfigStatus === "error" ? (
                        <>
                          <AlertTriangle size={14} className="text-rose-500" />
                          <span>保存失败</span>
                        </>
                      ) : (
                        <>
                          <Save size={14} />
                          <span>保存 API 凭据配置</span>
                        </>
                      )}
                    </button>
                  </div>
                </GlassCard>

                {/* Module B2: Smart Symbol Switch (Exchange Suffix Formatter) */}
                <GlassCard className="p-6 border border-white/40 dark:border-white/10 shadow-xl flex flex-col bg-white/40 dark:bg-[#0b0f19]/40 backdrop-blur-xl hover:shadow-2xl hover:border-white/50 dark:hover:border-white/20 transition-all duration-300">
                  <div className="flex items-center justify-between mb-4 border-b border-black/5 dark:border-white/5 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                        <Zap size={18} className="text-indigo-400 animate-pulse" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm tracking-wider">智能交易所后缀开关</h3>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Smart Symbol Switch</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-black/5 dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
                      <div className="space-y-0.5 max-w-[70%]">
                        <span className="text-xs font-bold block">自动追加交易所后缀</span>
                        <span className="text-[8px] text-slate-400 block leading-normal">
                          启用后自动追加交易所主板后缀（如将 AAPL 格式化为 AAPL:NASDAQ 提交给 Twelve Data），精准命中 NASDAQ/NYSE 主板，彻底防范过期/沙盒价格干扰。
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSaveSwitch(!smartSymbolSwitch)}
                        className={cn(
                          "w-10 h-6 rounded-full p-0.5 transition-colors duration-300 focus:outline-none flex items-center",
                          smartSymbolSwitch ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-slate-300 dark:bg-slate-700"
                        )}
                      >
                        <motion.div
                          layout
                          className="w-5 h-5 rounded-full bg-white shadow-sm"
                          animate={{ x: smartSymbolSwitch ? 14 : 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      </button>
                    </div>

                    <div className="flex justify-between items-center text-[8px] text-slate-400 font-mono">
                      <span>STATUS: {switchStatus === "saving" ? "SAVING..." : switchStatus === "success" ? "SYNCED" : "READY"}</span>
                      {smartSymbolSwitch && <span className="text-emerald-400 font-bold">NASDAQ / NYSE ENABLED</span>}
                    </div>
                  </div>
                </GlassCard>

                {/* Module B: Rate Limit Controller */}
                <GlassCard className="p-6 border border-white/40 dark:border-white/10 shadow-xl flex flex-col bg-white/40 dark:bg-[#0b0f19]/40 backdrop-blur-xl hover:shadow-2xl hover:border-white/50 dark:hover:border-white/20 transition-all duration-300">
                  <div className="flex items-center justify-between mb-5 border-b border-black/5 dark:border-white/5 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                        <Sliders size={18} />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm tracking-wider">频率熔断安全阀</h3>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Rate Limit Controller</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-5">
                    {/* Discrete Interval Slider */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">行情报送更新频率</label>
                        <span className="text-xs font-mono font-bold text-indigo-500 dark:text-indigo-400">{refreshInterval}秒</span>
                      </div>
                      
                      {/* Discrete Glass Segment Control */}
                      <div className="grid grid-cols-3 gap-2 p-1 bg-black/10 dark:bg-black/30 rounded-xl border border-black/5 dark:border-white/5">
                        {[15, 30, 60].map((sec) => (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => setRefreshInterval(sec)}
                            className={cn(
                              "py-1.5 rounded-lg text-xs font-bold transition-all duration-300",
                              refreshInterval === sec
                                ? "bg-indigo-600 text-white shadow-sm"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                            )}
                          >
                            {sec}s
                          </button>
                        ))}
                      </div>
                      <p className="text-[8px] text-slate-400">
                        * 选择 15 秒更新高灵敏度行情；选择 60 秒极度省电，保护 API 限制额度。
                      </p>
                    </div>

                    {/* Smart Sleep Toggle */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-black/5 dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
                      <div className="space-y-0.5 max-w-[70%]">
                        <span className="text-xs font-bold block">智能休眠模式</span>
                        <span className="text-[8px] text-slate-400 block leading-normal">
                          检测到页面最小化、切入后台或黑屏时，前端自动暂停行情 Fetch，节约请求额度。
                        </span>
                      </div>
                      
                      {/* Fluid Framer Motion Toggle Switch */}
                      <button
                        type="button"
                        onClick={() => setSmartSleep(!smartSleep)}
                        className={cn(
                          "w-10 h-6 rounded-full p-0.5 transition-colors duration-300 focus:outline-none flex items-center",
                          smartSleep ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                        )}
                      >
                        <motion.div
                          layout
                          className="w-5 h-5 rounded-full bg-white shadow-sm"
                          animate={{ x: smartSleep ? 14 : 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-end border-t border-black/5 dark:border-white/5 pt-4 mt-5">
                    <button
                      onClick={handleSaveRateLimit}
                      disabled={rateLimitStatus === "saving"}
                      className={cn(
                        "flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 w-full relative overflow-hidden",
                        rateLimitStatus === "success"
                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                          : rateLimitStatus === "error"
                          ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                          : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/30"
                      )}
                    >
                      {rateLimitStatus === "saving" ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>正在更新策略...</span>
                        </>
                      ) : rateLimitStatus === "success" ? (
                        <>
                          <CheckCircle2 size={14} className="text-emerald-500" />
                          <span>控制策略已生效</span>
                        </>
                      ) : rateLimitStatus === "error" ? (
                        <>
                          <AlertTriangle size={14} className="text-rose-500" />
                          <span>更新失败</span>
                        </>
                      ) : (
                        <>
                          <Sliders size={14} />
                          <span>保存限流安全阀</span>
                        </>
                      )}
                    </button>
                  </div>
                </GlassCard>
              </div>

              {/* Middle Column: Stock Ticker Manager */}
              <GlassCard className="p-6 border border-white/40 dark:border-white/10 shadow-xl flex flex-col bg-white/40 dark:bg-[#0b0f19]/40 backdrop-blur-xl h-[705px] hover:shadow-2xl hover:border-white/50 dark:hover:border-white/20 transition-all duration-300">
                <div className="flex items-center justify-between mb-4 border-b border-black/5 dark:border-white/5 pb-3 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                      <ListPlus size={18} />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm tracking-wider">自选股票池池控</h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Stock Ticker Manager</p>
                    </div>
                  </div>
                </div>

                {/* Add new ticker form */}
                <form onSubmit={handleAddTicker} className="flex gap-2 mb-4 shrink-0">
                  <input
                    type="text"
                    placeholder="Enter ticker (e.g. BTC/USD, AMZN)..."
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
                          "bg-white/50 dark:bg-white/[0.04] border-black/5 dark:border-white/5 text-slate-700 dark:text-slate-300"
                        )}
                      >
                        <span>{ticker}</span>
                        <button
                          onClick={() => handleRemoveTicker(ticker)}
                          type="button"
                          className="hover:text-red-500 transition-colors p-0.5 rounded-md hover:bg-red-500/10"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    {tickerPool.length === 0 && (
                      <div className="w-full flex flex-col items-center justify-center py-24 text-slate-400 text-xs">
                        <AlertTriangle size={24} className="opacity-50 mb-2 animate-bounce" />
                        <span>No tickers configured. Click packs to inject presets.</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Save Ticker Pool Action */}
                <div className="flex items-center justify-between border-t border-black/5 dark:border-white/5 pt-4 shrink-0">
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
                        <CheckCircle2 size={14} className="text-emerald-500" />
                        <span>自选池已保存</span>
                      </>
                    ) : tickerStatus === "error" ? (
                      <>
                        <AlertTriangle size={14} className="text-rose-500" />
                        <span>保存失败</span>
                      </>
                    ) : (
                      <>
                        <Save size={14} />
                        <span>保存当前自选股票池</span>
                      </>
                    )}
                  </button>
                </div>
              </GlassCard>

              {/* Right Column: Asset Pack Injector & Broadcast Marquee */}
              <div className="flex flex-col gap-6">
                
                {/* Module C: Asset Pack Injector */}
                <GlassCard className="p-6 border border-white/40 dark:border-white/10 shadow-xl flex flex-col bg-white/40 dark:bg-[#0b0f19]/40 backdrop-blur-xl hover:shadow-2xl hover:border-white/50 dark:hover:border-white/20 transition-all duration-300">
                  <div className="flex items-center justify-between mb-4 border-b border-black/5 dark:border-white/5 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        <Zap size={18} className="text-amber-500" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm tracking-wider">多品种沙盒资产注入</h3>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Asset Pack Injector</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {(Object.keys(ASSET_PACKS) as Array<keyof typeof ASSET_PACKS>).map((key) => {
                      const pack = ASSET_PACKS[key];
                      const IconComponent = pack.icon;
                      const isInjecting = injectingPack === key;
                      const status = injectStatus[key];

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => handleInjectPack(key)}
                          disabled={injectingPack !== null}
                          className={cn(
                            "w-full p-4 rounded-2xl border text-left transition-all duration-500 relative overflow-hidden flex items-start gap-4 hover:scale-[1.01] active:scale-[0.99]",
                            "bg-gradient-to-r",
                            pack.color,
                            injectingPack !== null && injectingPack !== key ? "opacity-40" : "opacity-100"
                          )}
                        >
                          <div className={cn("p-3 rounded-xl border border-white/10 shadow-inner flex items-center justify-center shrink-0", pack.glow)}>
                            {isInjecting && status === "idle" ? (
                              <RefreshCw size={20} className="animate-spin text-white" />
                            ) : status === "success" ? (
                              <CheckCircle2 size={20} className="text-emerald-400" />
                            ) : status === "error" ? (
                              <AlertTriangle size={20} className="text-rose-400" />
                            ) : (
                              <IconComponent size={20} />
                            )}
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-xs font-black tracking-wider text-slate-800 dark:text-slate-100 uppercase">
                              {pack.name}
                            </h4>
                            <p className="text-[8px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                              {pack.desc}
                            </p>
                            <span className="inline-block text-[7px] font-mono bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded-full mt-1 border border-white/5">
                              Preset Count: {pack.tickers.length} Symbols
                            </span>
                          </div>

                          {/* Success visual glow overlay */}
                          {status === "success" && (
                            <motion.div
                              layoutId="success-overlay"
                              className="absolute inset-0 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl pointer-events-none"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.3 }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </GlassCard>

                {/* News Marquee Broadcaster */}
                <GlassCard className="p-6 border border-white/40 dark:border-white/10 shadow-xl flex flex-col bg-white/40 dark:bg-[#0b0f19]/40 backdrop-blur-xl h-[335px] hover:shadow-2xl hover:border-white/50 dark:hover:border-white/20 transition-all duration-300">
                  <div className="flex items-center justify-between mb-4 border-b border-black/5 dark:border-white/5 pb-3 shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20">
                        <Radio size={18} className="animate-pulse" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm tracking-wider">广播头条播报栏</h3>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">News Broadcasting Marquee</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col space-y-4 min-h-0">
                    <textarea
                      value={newsBrief}
                      onChange={(e) => setNewsBrief(e.target.value)}
                      placeholder="Enter broadcast message here... Emojis and tags like ⚡, 🔔 are welcome."
                      className={cn(
                        "flex-1 w-full p-4 rounded-xl text-xs font-semibold resize-none leading-relaxed",
                        "bg-white/50 dark:bg-black/30 border border-black/10 dark:border-white/10",
                        "focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50",
                        "text-slate-800 dark:text-slate-100 transition-all duration-300"
                      )}
                    />

                    <div className="flex items-center justify-between pt-1 shrink-0">
                      <span className="text-[9px] text-slate-400 font-bold font-mono">
                        CHARS: {newsBrief.length}
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
                            <span>发布中...</span>
                          </>
                        ) : newsStatus === "success" ? (
                          <>
                            <CheckCircle2 size={14} className="text-emerald-500" />
                            <span>播报中</span>
                          </>
                        ) : newsStatus === "error" ? (
                          <>
                            <AlertTriangle size={14} className="text-rose-500" />
                            <span>播报失败</span>
                          </>
                        ) : (
                          <>
                            <Send size={14} />
                            <span>发布滚动广播</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </GlassCard>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
