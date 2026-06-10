"use client";

import React from "react";
import { useStockStore } from "@/store/useStockStore";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Plus, LayoutGrid } from "lucide-react";
import { GlassCard } from "./GlassCard";
import { cn } from "@/utils/cn";

export const Sidebar: React.FC = () => {
  const {
    watchlists,
    activeGroup,
    setActiveGroup,
    selectedStock,
    setSelectedStock,
  } = useStockStore();

  const groups = Object.keys(watchlists);
  const stocks = watchlists[activeGroup] || [];

  return (
    <GlassCard
      interactive={false}
      className="w-80 h-full flex flex-col p-4 select-none"
    >
      {/* Sidebar Header */}
      <div className="flex items-center justify-between mb-6 border-b border-black/5 dark:border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-md">
            <div className="absolute inset-[1.5px] rounded-[6px] bg-white dark:bg-[#0c0f17] flex items-center justify-center">
              <span className="font-black text-xs bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                AO
              </span>
            </div>
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-widest bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
              APEX ORIENT
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wide">
              LIQUID GLASS RADAR
            </p>
          </div>
        </div>
        <button className="flex items-center justify-center w-7 h-7 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors">
          <Plus size={16} />
        </button>
      </div>

      {/* Watchlist Group Tabs */}
      <div className="flex gap-1 p-1 bg-black/5 dark:bg-white/5 rounded-xl mb-4 relative z-0">
        {groups.map((group) => {
          const isActive = activeGroup === group;
          return (
            <button
              key={group}
              onClick={() => setActiveGroup(group)}
              className={cn(
                "relative flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors focus:outline-none z-10",
                isActive
                  ? "text-slate-900 dark:text-white"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
              )}
            >
              {group}
              {isActive && (
                <motion.div
                  layoutId="active-tab"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  className="absolute inset-0 bg-white dark:bg-[#131926]/80 rounded-lg shadow-sm -z-10 border border-white/50 dark:border-white/5"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Search Result / Stock List Section */}
      <div className="flex-1 overflow-y-auto pr-1 -mr-2 space-y-2.5 custom-scrollbar">
        <div className="flex items-center justify-between px-1 text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
          <span>Watchlist</span>
          <span>Price / Chg</span>
        </div>

        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {stocks.map((stock, idx) => {
              const isSelected = selectedStock.symbol === stock.symbol;
              const isPositive = stock.change >= 0;

              return (
                <motion.div
                  key={stock.symbol}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, delay: idx * 0.03 }}
                >
                  <div
                    onClick={() => setSelectedStock(stock)}
                    className={cn(
                      "group relative flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-300",
                      "border border-transparent",
                      isSelected
                        ? "bg-white/70 dark:bg-white/[0.06] border-white/80 dark:border-white/10 shadow-md shadow-slate-200/50 dark:shadow-none"
                        : "hover:bg-white/30 dark:hover:bg-white/[0.02]"
                    )}
                  >
                    {/* Selected Left-Border Indicator */}
                    {isSelected && (
                      <motion.div
                        layoutId="active-stock-indicator"
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                        className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-gradient-to-b from-indigo-500 to-purple-500"
                      />
                    )}

                    {/* Stock Metadata */}
                    <div className="flex flex-col">
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-200 tracking-wide">
                        {stock.symbol}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-400 truncate max-w-[120px]">
                        {stock.name}
                      </span>
                    </div>

                    {/* Stock Performance */}
                    <div className="flex flex-col items-end">
                      <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-100">
                        {stock.price.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <div
                        className={cn(
                          "flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold mt-1 shadow-sm transition-all duration-300",
                          isPositive
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:shadow-glow-green"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:shadow-glow-red"
                        )}
                      >
                        {isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        <span>{isPositive ? "+" : ""}{stock.changePercent}%</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Sidebar Footer Info */}
      <div className="mt-4 border-t border-black/5 dark:border-white/5 pt-4 text-[10px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Real-time Stream Connected</span>
        </div>
        <LayoutGrid size={12} className="opacity-60" />
      </div>
    </GlassCard>
  );
};
