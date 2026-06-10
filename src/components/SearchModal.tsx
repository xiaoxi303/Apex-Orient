"use client";

import React, { useState, useEffect, useRef } from "react";
import { useStockStore, Stock } from "@/store/useStockStore";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, Globe, Command, ArrowRight, CornerDownLeft } from "lucide-react";
import { cn } from "@/utils/cn";

interface SearchResult {
  symbol: string;
  name: string;
  type: string;
}

export const SearchModal: React.FC = () => {
  const { searchOpen, setSearchOpen, setSelectedStock } = useStockStore();
  
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // 1. Listen for global keyboard shortcut: Cmd+K (Mac) / Ctrl+K (Windows)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(!searchOpen);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchOpen, setSearchOpen]);

  // 2. Focus input automatically when search modal opens
  useEffect(() => {
    if (searchOpen) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [searchOpen]);

  // 3. Debounced Search API call (300ms delay)
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const debounceTimeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stock/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.success && data.result) {
          setResults(data.result);
          setSelectedIndex(0);
        }
      } catch (err) {
        console.error("Search API lookup failed:", err);
      } finally {
        setIsLoading(false);
      }
    }, 300); // 300ms debounce protection

    return () => clearTimeout(debounceTimeout);
  }, [query]);

  // 4. Handle arrow keys & enter keys inside the search modal
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) {
      if (e.key === "Escape") {
        setSearchOpen(false);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % results.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
        break;
      case "Enter":
        e.preventDefault();
        handleSelectStock(results[selectedIndex]);
        break;
      case "Escape":
        e.preventDefault();
        setSearchOpen(false);
        break;
    }
  };

  // Scroll active item into view dynamically
  useEffect(() => {
    if (resultsContainerRef.current) {
      const activeEl = resultsContainerRef.current.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  // 5. Select Stock action
  const handleSelectStock = (item: SearchResult) => {
    // Generate a temporary Stock structure to load K-lines
    const stock: Stock = {
      symbol: item.symbol,
      name: item.name,
      price: 100.0, // Default baseline price; WebSocket ticks will override in real-time
      change: 0.0,
      changePercent: 0.0,
    };

    setSelectedStock(stock);
    setSearchOpen(false);
  };

  return (
    <AnimatePresence>
      {searchOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
          {/* Deep blur visual overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSearchOpen(false)}
            className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-md"
          />

          {/* Liquid Glass Search Panel */}
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.97 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={cn(
              "w-full max-w-lg rounded-2xl overflow-hidden relative border z-10 shadow-2xl",
              "bg-white/80 dark:bg-[#0c101a]/70",
              "border-white/50 dark:border-white/10"
            )}
          >
            {/* Glowing neon background blobs */}
            <div className="absolute top-0 left-1/4 w-1/2 h-1/2 bg-indigo-500/10 dark:bg-indigo-500/15 rounded-full filter blur-3xl pointer-events-none -z-10" />

            {/* Input Wrapper */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-black/5 dark:border-white/5">
              <Search size={18} className="text-slate-400 dark:text-slate-500 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search symbol, company name (e.g. AAPL, Tesla)..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className={cn(
                  "flex-1 bg-transparent text-sm focus:outline-none placeholder-slate-400 dark:placeholder-slate-500",
                  "text-slate-800 dark:text-white font-medium"
                )}
              />
              {isLoading ? (
                <Loader2 size={16} className="animate-spin text-indigo-500 shrink-0" />
              ) : (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase border border-black/5 dark:border-white/5 shrink-0 select-none">
                  <Command size={10} />
                  <span>K</span>
                </div>
              )}
            </div>

            {/* Results Section */}
            <div className="max-h-[300px] overflow-y-auto custom-scrollbar relative">
              {results.length > 0 ? (
                <div ref={resultsContainerRef} className="p-2 space-y-1">
                  {results.map((item, idx) => {
                    const isSelected = idx === selectedIndex;
                    return (
                      <div
                        key={`${item.symbol}-${idx}`}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        onClick={() => handleSelectStock(item)}
                        className={cn(
                          "flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 select-none",
                          isSelected
                            ? "bg-indigo-500/10 dark:bg-white/[0.04] text-slate-900 dark:text-white"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center border text-[10px] font-bold tracking-wider shrink-0 transition-colors",
                              isSelected
                                ? "bg-indigo-500/25 border-indigo-500/35 text-indigo-500"
                                : "bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5"
                            )}
                          >
                            {item.symbol.slice(0, 3)}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-xs truncate">
                              {item.symbol}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate max-w-[280px]">
                              {item.name}
                            </span>
                          </div>
                        </div>

                        {/* Item Type & selection indicator */}
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-slate-400 dark:text-slate-500">
                            {item.type}
                          </span>
                          <div className={cn("transition-opacity duration-200 flex items-center gap-1", isSelected ? "opacity-100" : "opacity-0")}>
                            <ArrowRight size={12} className="text-indigo-500 dark:text-indigo-400" />
                            <CornerDownLeft size={10} className="text-slate-400 dark:text-slate-500" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : query.trim() ? (
                /* No Results Fallback */
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500 select-none">
                  <Globe size={24} className="opacity-40 animate-pulse mb-3" />
                  <span className="text-xs font-semibold">No assets found for &quot;{query}&quot;</span>
                  <span className="text-[10px] opacity-75 mt-1">Try another stock ticker or name</span>
                </div>
              ) : (
                /* Empty query instructions */
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500 select-none">
                  <Globe size={24} className="opacity-40 mb-3" />
                  <span className="text-xs font-semibold">Search global US equities and indices</span>
                  <span className="text-[10px] opacity-75 mt-1">
                    Press <span className="font-mono bg-black/5 dark:bg-white/5 px-1 py-0.5 rounded border border-black/5 dark:border-white/5 text-[9px]">↑↓</span> to navigate, <span className="font-mono bg-black/5 dark:bg-white/5 px-1 py-0.5 rounded border border-black/5 dark:border-white/5 text-[9px]">Enter</span> to select
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
