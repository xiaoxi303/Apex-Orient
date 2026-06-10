"use client";

import React, { useState } from "react";
import { useStockStore } from "@/store/useStockStore";
import { RotateCw } from "lucide-react";
import { cn } from "@/utils/cn";
import type { Timeframe } from "@/data/mockOHLCV";

interface RefreshButtonProps {
  symbol: string;
  timeframe: Timeframe;
}

export const RefreshButton: React.FC<RefreshButtonProps> = ({ symbol, timeframe }) => {
  const { isRefreshing, refreshCurrentStock } = useStockStore();
  const [isThrottled, setIsThrottled] = useState(false);

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRefreshing || isThrottled) return;

    // Set 2-second throttle block
    setIsThrottled(true);
    
    // Trigger the Zustand async action to refresh stock drawings and watchlists
    await refreshCurrentStock(symbol, timeframe);

    setTimeout(() => {
      setIsThrottled(false);
    }, 2000);
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={isRefreshing || isThrottled}
      title={
        isThrottled
          ? "Refresh throttled (cooling down...)"
          : isRefreshing
          ? "Syncing data..."
          : "Force refresh stock data"
      }
      className={cn(
        "relative p-1.5 rounded-lg border transition-all duration-300 flex items-center justify-center overflow-hidden shrink-0",
        "bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10",
        "border-black/5 dark:border-white/5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200",
        "disabled:opacity-50 disabled:cursor-not-allowed group"
      )}
    >
      {/* Liquid micro-glow hover background effect */}
      <span className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Spinner icon */}
      <RotateCw
        size={13}
        className={cn(
          "relative z-10 transition-transform duration-300 shrink-0",
          isRefreshing && "animate-spin text-indigo-500 dark:text-indigo-400"
        )}
      />
    </button>
  );
};
