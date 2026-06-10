"use client";

import React, { useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";
import { ChartGrid } from "@/components/ChartGrid";
import { useStockStore } from "@/store/useStockStore";
import { useStockWS } from "@/hooks/useStockWS";

export default function Home() {
  const loadSettingsAndWatchlist = useStockStore((s) => s.loadSettingsAndWatchlist);

  // Initialize stock tickers dynamic watchlists from db configurations
  useEffect(() => {
    loadSettingsAndWatchlist();
  }, [loadSettingsAndWatchlist]);

  // Activate WebSocket live-ticker push simulation client
  useStockWS();

  return (
    <main className="relative flex h-screen w-screen p-4 overflow-hidden gap-4 bg-[#f1f5f9] dark:bg-[#030712] transition-colors duration-500 select-none">
      {/* Ambient background glass light blobs */}
      <div className="absolute top-[-10vw] right-[-10vw] w-[50vw] h-[50vw] rounded-full bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent blur-[140px] pointer-events-none z-0 dark:from-indigo-500/18 dark:via-purple-500/15" />
      <div className="absolute bottom-[-10vw] left-[-10vw] w-[50vw] h-[50vw] rounded-full bg-gradient-to-tr from-pink-500/8 via-blue-500/8 to-transparent blur-[140px] pointer-events-none z-0 dark:from-pink-500/15 dark:via-blue-500/12" />

      {/* Sidebar Panel */}
      <div className="relative z-10 flex shrink-0 h-full">
        <Sidebar />
      </div>

      {/* Workspace Area */}
      <div className="relative z-10 flex-1 flex flex-col gap-4 min-w-0 h-full">
        <Navbar />
        <div className="flex-1 min-h-0">
          <ChartGrid />
        </div>
      </div>
    </main>
  );
}
