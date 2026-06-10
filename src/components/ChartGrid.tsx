"use client";

import React, { useState, useCallback } from "react";
import { useStockStore, Stock } from "@/store/useStockStore";
import { GlassCard } from "./GlassCard";
import { RealTimeChart } from "./RealTimeChart";
import { ChartHUD } from "./ChartHUD";
import { DrawingOverlay } from "./DrawingOverlay";
import { RefreshButton } from "./RefreshButton";
import { ChevronDown, Activity, Maximize2 } from "lucide-react";
import { cn } from "@/utils/cn";
import type { Timeframe } from "@/data/mockOHLCV";
import type { IChartApi, ISeriesApi, Time, SeriesType } from "lightweight-charts";

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "1m", label: "1m" },
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "1h", label: "1H" },
  { value: "4h", label: "4H" },
  { value: "1d", label: "1D" },
];

export const ChartGrid: React.FC = () => {
  const { layoutMode, selectedStock, paneStocks, setPaneStock, watchlists, activeGroup } =
    useStockStore();
  const allStocks = watchlists[activeGroup] || [];
  const paneCount = layoutMode === "single" ? 1 : layoutMode === "split" ? 2 : 4;

  return (
    <div
      className={cn(
        "grid gap-4 w-full h-full min-h-[400px]",
        layoutMode === "single" && "grid-cols-1 grid-rows-1",
        layoutMode === "split" && "grid-cols-2 grid-rows-1",
        layoutMode === "quad" && "grid-cols-2 grid-rows-2"
      )}
    >
      {Array.from({ length: paneCount }).map((_, index) => {
        const resolvedSymbol =
          index === 0 && layoutMode !== "quad"
            ? selectedStock.symbol
            : paneStocks[index] || "AAPL";
        const stock =
          allStocks.find((s) => s.symbol === resolvedSymbol) || selectedStock;

        return (
          <ChartPane
            key={`${index}-${stock.symbol}`}
            index={index}
            stock={stock}
            allStocks={allStocks}
            setPaneStock={(symbol) => setPaneStock(index, symbol)}
          />
        );
      })}
    </div>
  );
};

// ─── ChartPane ─────────────────────────────────────────────

interface ChartPaneProps {
  index: number;
  stock: Stock;
  allStocks: Stock[];
  setPaneStock: (symbol: string) => void;
}

const ChartPane: React.FC<ChartPaneProps> = ({
  index,
  stock,
  allStocks,
  setPaneStock,
}) => {
  const { paneTimeframes, setPaneTimeframe } = useStockStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [crosshairPrice, setCrosshairPrice] = useState<number | null>(null);
  const [chartApi, setChartApi] = useState<IChartApi | null>(null);
  const [seriesApi, setSeriesApi] = useState<ISeriesApi<SeriesType, Time> | null>(null);

  const timeframe = paneTimeframes[index] || "1d";
  const drawingKey = `${stock.symbol}_${timeframe}`;

  // Reactive subscription to this specific symbol's real-time state
  const storeStock = useStockStore((state) => state.stocks[stock.symbol]);
  const resolvedPrice = storeStock ? storeStock.price : stock.price;
  const resolvedChange = storeStock ? storeStock.change : stock.change;
  const resolvedChangePercent = storeStock ? storeStock.changePercent : stock.changePercent;
  const isPositive = resolvedChange >= 0;

  const handleCrosshairMove = useCallback(
    (_time: Time | null, price: number | null) => {
      setCrosshairPrice(price);
    },
    []
  );

  const handleChartReady = useCallback(
    (chart: IChartApi, series: ISeriesApi<SeriesType, Time>) => {
      setChartApi(chart);
      setSeriesApi(series);
    },
    []
  );

  const displayPrice = crosshairPrice ?? resolvedPrice;

  return (
    <GlassCard interactive={false} className="flex flex-col w-full h-full relative overflow-hidden">
      {/* ─── Pane Header ────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 px-4 py-2.5 shrink-0">
        {/* Left: Ticker + Timeframe */}
        <div className="flex items-center gap-2 relative">
          {/* Ticker Selector */}
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-xs font-bold text-slate-800 dark:text-slate-200 transition-colors border border-black/5 dark:border-white/5"
          >
            <span>{stock.symbol}</span>
            <ChevronDown size={12} className="opacity-60" />
          </button>

          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute top-8 left-0 w-48 bg-white dark:bg-[#0e121e] border border-black/10 dark:border-white/10 rounded-xl shadow-xl py-1 z-50 backdrop-blur-md">
                {allStocks.map((s) => (
                  <button
                    key={s.symbol}
                    onClick={() => {
                      setPaneStock(s.symbol);
                      setDropdownOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium flex items-center justify-between",
                      s.symbol === stock.symbol
                        ? "text-indigo-500 font-bold"
                        : "text-slate-600 dark:text-slate-300"
                    )}
                  >
                    <span>{s.symbol}</span>
                    <span className="text-[10px] opacity-65 font-normal">
                      {s.name}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Timeframe selector */}
          <div className="flex gap-0.5 p-0.5 bg-black/5 dark:bg-white/5 rounded-lg border border-black/5 dark:border-white/5">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setPaneTimeframe(index, tf.value)}
                className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-bold transition-all duration-200",
                  timeframe === tf.value
                    ? "bg-white dark:bg-white/10 text-slate-800 dark:text-white shadow-sm"
                    : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-400 font-medium truncate max-w-[100px] hidden lg:inline">
            {stock.name}
          </span>
        </div>

        {/* Right: Price info */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="font-mono text-sm font-bold text-slate-800 dark:text-slate-100">
              {displayPrice.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span
              className={cn(
                "font-mono text-[10px] font-bold ml-2",
                isPositive
                  ? "text-emerald-500 dark:text-emerald-400"
                  : "text-rose-500 dark:text-rose-400"
              )}
            >
              {isPositive ? "+" : ""}
              {resolvedChange.toFixed(2)} ({isPositive ? "+" : ""}
              {resolvedChangePercent.toFixed(2)}%)
            </span>
          </div>
          <div className="flex items-center gap-1.5 border-l border-black/5 dark:border-white/5 pl-3">
            <RefreshButton symbol={stock.symbol} timeframe={timeframe} />
            <button className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
              <Activity size={12} />
            </button>
            <button className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
              <Maximize2 size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Chart Area ─────────────────────────────────── */}
      <div className="flex-1 min-h-0 relative">
        {/* Ambient trend glow */}
        <div
          className={cn(
            "absolute inset-[15%] rounded-full opacity-[0.06] dark:opacity-[0.12] filter blur-3xl pointer-events-none transition-all duration-700 z-0",
            isPositive ? "bg-emerald-500" : "bg-rose-500"
          )}
        />

        {/* Lightweight Charts Canvas */}
        <RealTimeChart
          symbol={stock.symbol}
          timeframe={timeframe}
          onCrosshairMove={handleCrosshairMove}
          onChartReady={handleChartReady}
        />

        {/* SVG Drawing Overlay (stacked on top of canvas) */}
        <DrawingOverlay
          symbol={stock.symbol}
          timeframe={timeframe}
          chart={chartApi}
          series={seriesApi}
        />

        {/* Floating HUD Toolbar */}
        <ChartHUD drawingKey={drawingKey} />
      </div>

      {/* ─── Footer ─────────────────────────────────────── */}
      <div className="flex justify-between items-center text-[10px] text-slate-400 dark:text-slate-500 px-4 py-1.5 shrink-0 border-t border-black/5 dark:border-white/5">
        <div className="flex gap-3">
          <span>
            O{" "}
            <span className="font-mono font-bold text-slate-600 dark:text-slate-400">
              {resolvedPrice.toFixed(2)}
            </span>
          </span>
          <span>
            H{" "}
            <span className="font-mono font-bold text-emerald-500">
              {(resolvedPrice * 1.012).toFixed(2)}
            </span>
          </span>
          <span>
            L{" "}
            <span className="font-mono font-bold text-rose-500">
              {(resolvedPrice * 0.988).toFixed(2)}
            </span>
          </span>
          <span>
            C{" "}
            <span className="font-mono font-bold text-slate-600 dark:text-slate-400">
              {displayPrice.toFixed(2)}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
          <span>
            {stock.symbol} · {timeframe.toUpperCase()}
          </span>
        </div>
      </div>
    </GlassCard>
  );
};
