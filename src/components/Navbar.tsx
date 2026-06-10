"use client";

import React, { useEffect, useState } from "react";
import { useStockStore, LayoutMode } from "@/store/useStockStore";
import { Sun, Moon, Search, Square, Columns2, LayoutGrid, Radio } from "lucide-react";
import { GlassCard } from "./GlassCard";
import { cn } from "@/utils/cn";

export const Navbar: React.FC = () => {
  const { theme, toggleTheme, initializeTheme, layoutMode, setLayoutMode, setSearchOpen } = useStockStore();
  const [newsBrief, setNewsBrief] = useState("🔥 Loading latest briefings... Streaming real-time US asset feeds.");

  // Initialize theme class on render
  useEffect(() => {
    initializeTheme();
  }, [initializeTheme]);

  // Load dynamic bulletin brief from database on initialization
  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch("/api/admin/config?key=news_brief");
        const data = await res.json();
        if (data.success && data.value) {
          setNewsBrief(data.value);
        } else {
          setNewsBrief(
            "🔥 FED interest rate decisions expected tomorrow at 2:00 PM EST. Markets brace for volatility. ⚡ APEX ORIENT v1.0.0 is live! Enjoy high-fidelity liquid glass UI components. 📈 Nvidia (NVDA) surges to record highs, testing historic resistance levels. 💎 Bitcoin consolidation continues above $67k as ETF net inflows surge."
          );
        }
      } catch (e) {
        console.error("Failed to load marquee news brief", e);
      }
    };

    fetchNews();
  }, []);

  const layouts: { mode: LayoutMode; icon: React.ReactNode; label: string }[] = [
    { mode: "single", icon: <Square size={14} />, label: "Single View" },
    { mode: "split", icon: <Columns2 size={14} />, label: "Split View" },
    { mode: "quad", icon: <LayoutGrid size={14} />, label: "Quad Grid" },
  ];

  return (
    <GlassCard
      interactive={false}
      className="w-full h-16 flex items-center justify-between px-6 select-none"
    >
      {/* Left Section: Scrolling Bulletin Ticker */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] tracking-wider uppercase border border-indigo-500/10 shadow-sm shrink-0">
          <Radio size={12} className="animate-pulse" />
          <span>News Brief</span>
        </div>
        
        {/* Scrolling news marquee ticker */}
        <div className="relative flex-1 overflow-hidden h-7 bg-black/5 dark:bg-white/5 rounded-lg border border-black/5 dark:border-white/5 flex items-center">
          <div className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-white/80 dark:from-[#0c0f17]/80 to-transparent w-4 z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 bg-gradient-to-l from-white/80 dark:from-[#0c0f17]/80 to-transparent w-4 z-10 pointer-events-none" />
          <div className="animate-marquee whitespace-nowrap text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center">
            <span className="pr-12">{newsBrief}</span>
          </div>
        </div>
      </div>

      {/* Right Section: Controls & Search */}
      <div className="flex items-center gap-4">
        {/* Command Search Box button */}
        <button
          onClick={() => setSearchOpen(true)}
          className={cn(
            "flex items-center gap-3 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all duration-300",
            "bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10",
            "border border-black/5 dark:border-white/5"
          )}
        >
          <Search size={14} />
          <span>Search symbol...</span>
          <kbd className="hidden sm:inline-flex h-4 items-center gap-0.5 rounded bg-slate-200 dark:bg-slate-800 px-1.5 font-mono text-[9px] font-medium text-slate-500 dark:text-slate-400 shadow-sm border border-black/5 dark:border-white/5">
            ⌘K
          </kbd>
        </button>

        {/* Layout Window Split Selection */}
        <div className="flex p-0.5 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5">
          {layouts.map(({ mode, icon, label }) => {
            const isActive = layoutMode === mode;
            return (
              <button
                key={mode}
                title={label}
                onClick={() => setLayoutMode(mode)}
                className={cn(
                  "p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-all duration-300 relative",
                  isActive && "text-slate-900 dark:text-white"
                )}
              >
                {icon}
                {isActive && (
                  <span className="absolute bottom-[-2px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-500 dark:bg-indigo-400 shadow-md" />
                )}
              </button>
            );
          })}
        </div>

        {/* Theme mode switch */}
        <button
          onClick={toggleTheme}
          className={cn(
            "p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-all duration-300",
            "bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10",
            "border border-black/5 dark:border-white/5"
          )}
          title="Toggle Light/Dark Theme"
        >
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
    </GlassCard>
  );
};
