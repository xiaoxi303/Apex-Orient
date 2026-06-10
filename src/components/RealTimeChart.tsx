"use client";

import React, { useEffect, useRef, useCallback } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
} from "lightweight-charts";
import type {
  IChartApi,
  ISeriesApi,
  CandlestickData,
  Time,
  IPriceLine,
} from "lightweight-charts";
import { useStockStore } from "@/store/useStockStore";
import { generateMockOHLCV, Timeframe } from "@/data/mockOHLCV";

interface RealTimeChartProps {
  symbol: string;
  timeframe: Timeframe;
  onCrosshairMove?: (time: Time | null, price: number | null) => void;
  onChartReady?: (chart: IChartApi, series: ISeriesApi<"Candlestick", Time>) => void;
}

interface AlphaVantageCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const RealTimeChart: React.FC<RealTimeChartProps> = ({
  symbol,
  timeframe,
  onCrosshairMove,
  onChartReady,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  
  // Use typed references for Candlestick and Histogram Series
  const seriesRef = useRef<ISeriesApi<"Candlestick", Time> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram", Time> | null>(null);
  
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  
  // Custom price line and caching refs
  const customPriceLineRef = useRef<IPriceLine | null>(null);
  const lastBarRef = useRef<{ time: number; open: number; high: number; low: number; close: number } | null>(null);

  const theme = useStockStore((s) => s.theme);
  const isRefreshing = useStockStore((s) => s.isRefreshing);
  
  // Read calibrated real-time price from the Zustand store
  const currentPrice = useStockStore((s) => s.stocks[symbol]?.price);

  const getChartColors = useCallback(
    (isDark: boolean) => ({
      text: isDark ? "#64748b" : "#94a3b8",
      grid: isDark ? "rgba(148, 163, 184, 0.04)" : "rgba(148, 163, 184, 0.08)",
      border: isDark ? "rgba(148, 163, 184, 0.06)" : "rgba(148, 163, 184, 0.12)",
      crosshair: isDark ? "rgba(148, 163, 184, 0.25)" : "rgba(100, 116, 139, 0.3)",
      crosshairLabel: isDark ? "#1e293b" : "#e2e8f0",
      upColor: isDark ? "#22c55e" : "#16a34a",
      downColor: isDark ? "#ef4444" : "#dc2626",
      volumeUp: isDark ? "rgba(34, 197, 94, 0.15)" : "rgba(22, 163, 74, 0.12)",
      volumeDown: isDark ? "rgba(239, 68, 68, 0.15)" : "rgba(220, 38, 38, 0.12)",
    }),
    []
  );

  // Helper fallback to fill chart canvas dynamically in offline/sandbox/error states
  const loadFallbackMockData = useCallback(
    (
      candleSeries: ISeriesApi<"Candlestick", Time>,
      volumeSeries: ISeriesApi<"Histogram", Time>,
      colors: ReturnType<typeof getChartColors>
    ) => {
      const bars = generateMockOHLCV(symbol, timeframe, 200);
      candleSeries.setData(bars as CandlestickData<Time>[]);

      const volumeData = bars.map((bar) => ({
        time: bar.time,
        value: bar.volume,
        color: bar.close >= bar.open ? colors.volumeUp : colors.volumeDown,
      }));
      volumeSeries.setData(volumeData);

      // Cache the last mock bar for real-time updates
      const lastBar = bars[bars.length - 1];
      const lastBarTime = typeof lastBar.time === "number"
        ? lastBar.time
        : Math.floor(new Date(lastBar.time as unknown as string).getTime() / 1000);

      lastBarRef.current = {
        time: lastBarTime,
        open: lastBar.open,
        high: lastBar.high,
        low: lastBar.low,
        close: lastBar.close,
      };
    },
    [symbol, timeframe]
  );

  // Dynamic K-line history loading logic querying Alpha Vantage API proxy
  const loadHistoryData = useCallback(
    async (
      chart: IChartApi,
      candleSeries: ISeriesApi<"Candlestick", Time>,
      volumeSeries: ISeriesApi<"Histogram", Time>
    ) => {
      const isDark = theme === "dark";
      const colors = getChartColors(isDark);

      try {
        console.log(`[Candle API] Fetching history candles for: ${symbol} (${timeframe})`);
        
        const res = await fetch(
          `/api/stock/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`
        );
        const json = await res.json();

        if (json.success && Array.isArray(json.result) && json.result.length > 0) {
          const rawCandles = json.result as AlphaVantageCandle[];
          console.log("[Candle API] Received raw candle list:", rawCandles);

          // Standardize dates to Unix seconds (TradingView expected format)
          const formattedBars = rawCandles.map((bar: AlphaVantageCandle) => ({
            time: bar.time as Time,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
          }));

          console.log("[Mapped State Data] Mapped K-line history for TradingView:", formattedBars);

          // Set candlestick series data
          candleSeries.setData(formattedBars);

          // Set volume series data
          const volumeData = rawCandles.map((bar: AlphaVantageCandle) => ({
            time: bar.time as Time,
            value: bar.volume,
            color: bar.close >= bar.open ? colors.volumeUp : colors.volumeDown,
          }));
          volumeSeries.setData(volumeData);
          chart.timeScale().fitContent();

          // Cache the last historical bar for real-time updates reference
          const lastBar = formattedBars[formattedBars.length - 1];
          const lastBarTime = typeof lastBar.time === "number"
            ? lastBar.time
            : Math.floor(new Date(lastBar.time as unknown as string).getTime() / 1000);

          lastBarRef.current = {
            time: lastBarTime,
            open: lastBar.open,
            high: lastBar.high,
            low: lastBar.low,
            close: lastBar.close,
          };
        } else {
          console.warn(
            `[Candle API] History API failed or returned empty: ${json.error || "No data"}. Employing mock fallback.`
          );
          loadFallbackMockData(candleSeries, volumeSeries, colors);
        }
      } catch (err) {
        console.error("[Candle API] Failed to load history candles from backend:", err);
        loadFallbackMockData(candleSeries, volumeSeries, colors);
      }
    },
    [symbol, timeframe, theme, getChartColors, loadFallbackMockData]
  );

  // Initialize chart canvas
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isDark = theme === "dark";
    const colors = getChartColors(isDark);

    // Read actual pixel dimensions from the DOM before creating the chart
    const initWidth = container.clientWidth || container.offsetWidth || 600;
    const initHeight = container.clientHeight || container.offsetHeight || 400;

    const chart = createChart(container, {
      width: initWidth,
      height: initHeight,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: colors.text,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: colors.crosshair,
          width: 1,
          style: 3,
          labelBackgroundColor: colors.crosshairLabel,
        },
        horzLine: {
          color: colors.crosshair,
          width: 1,
          style: 3,
          labelBackgroundColor: colors.crosshairLabel,
        },
      },
      rightPriceScale: {
        borderColor: colors.border,
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: colors.border,
        timeVisible: timeframe !== "1d",
        secondsVisible: false,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true },
    });

    // Candlestick series (v5 API) - Hide default price line to prevent history sticking
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: colors.upColor,
      downColor: colors.downColor,
      borderDownColor: colors.downColor,
      borderUpColor: colors.upColor,
      wickDownColor: colors.downColor,
      wickUpColor: colors.upColor,
      priceLineVisible: false, 
    });

    // Volume histogram series (v5 API)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: colors.volumeUp,
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    // Assign refs immediately
    chartRef.current = chart;
    seriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Load initial historical data
    loadHistoryData(chart, candleSeries, volumeSeries);

    // Crosshair callback
    if (onCrosshairMove) {
      chart.subscribeCrosshairMove((param) => {
        if (param.time) {
          const data = param.seriesData.get(candleSeries) as
            | CandlestickData<Time>
            | undefined;
          onCrosshairMove(param.time, data?.close ?? null);
        } else {
          onCrosshairMove(null, null);
        }
      });
    }

    if (onChartReady) {
      onChartReady(chart, candleSeries);
    }

    // ResizeObserver — always feed real pixel values to the chart
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width || container.clientWidth;
        const h = entry.contentRect.height || container.clientHeight;
        if (w > 0 && h > 0) {
          chart.applyOptions({ width: w, height: h });
        }
      }
    });

    ro.observe(container);
    resizeObserverRef.current = ro;

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeSeriesRef.current = null;
      customPriceLineRef.current = null; // Clean up the custom price line reference
      lastBarRef.current = null; // Clean up last bar cache
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, timeframe]);

  // Sync theme changes without re-creating chart
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart) return;

    const isDark = theme === "dark";
    const colors = getChartColors(isDark);

    chart.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: colors.text,
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      crosshair: {
        vertLine: {
          color: colors.crosshair,
          labelBackgroundColor: colors.crosshairLabel,
        },
        horzLine: {
          color: colors.crosshair,
          labelBackgroundColor: colors.crosshairLabel,
        },
      },
      rightPriceScale: { borderColor: colors.border },
      timeScale: { borderColor: colors.border },
    });

    if (series) {
      series.applyOptions({
        upColor: colors.upColor,
        downColor: colors.downColor,
        borderDownColor: colors.downColor,
        borderUpColor: colors.upColor,
        wickDownColor: colors.downColor,
        wickUpColor: colors.upColor,
      });
    }
  }, [theme, getChartColors]);

  // Trigger K-line re-fetch when manual force refresh is activated in the header toolbar
  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = seriesRef.current;
    const volumeSeries = volumeSeriesRef.current;

    if (isRefreshing && chart && candleSeries && volumeSeries) {
      loadHistoryData(chart, candleSeries, volumeSeries);
    }
  }, [isRefreshing, loadHistoryData]);

  // Manage custom horizontal price line tracking the real-time calibrated price
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || currentPrice === undefined || currentPrice === null) return;

    if (!customPriceLineRef.current) {
      customPriceLineRef.current = series.createPriceLine({
        price: currentPrice,
        color: "#ef4444", // Red horizontal line matching the Liquid Glass theme
        lineWidth: 1,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        title: "Live",
      });
    } else {
      customPriceLineRef.current.applyOptions({
        price: currentPrice,
      });
    }
  }, [currentPrice]);

  // Manage real-time candlestick updates (Today's floating bar ticking close price)
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || currentPrice === undefined || currentPrice === null) return;

    const nowSeconds = Math.floor(Date.now() / 1000);
    
    // Calculate starting Unix bound for the current timeframe bar
    const getBarTime = (tf: string, timeSeconds: number) => {
      switch (tf) {
        case "1m": return Math.floor(timeSeconds / 60) * 60;
        case "5m": return Math.floor(timeSeconds / 300) * 300;
        case "15m": return Math.floor(timeSeconds / 900) * 900;
        case "1h": return Math.floor(timeSeconds / 3600) * 3600;
        case "4h": return Math.floor(timeSeconds / 14400) * 14400;
        case "1d":
        default:
          return Math.floor(timeSeconds / 86400) * 86400;
      }
    };

    const targetTime = getBarTime(timeframe, nowSeconds);
    const lastBar = lastBarRef.current;
    let updatedBar: CandlestickData<Time>;

    if (lastBar && lastBar.time === targetTime) {
      // Update the existing real-time bar with the new high/low and close ticks
      updatedBar = {
        time: targetTime as Time,
        open: lastBar.open,
        high: Math.max(lastBar.high, currentPrice),
        low: Math.min(lastBar.low, currentPrice),
        close: currentPrice,
      };
    } else {
      // Append a brand new real-time bar for the new interval session
      const openPrice = lastBar ? lastBar.close : currentPrice;
      updatedBar = {
        time: targetTime as Time,
        open: openPrice,
        high: Math.max(openPrice, currentPrice),
        low: Math.min(openPrice, currentPrice),
        close: currentPrice,
      };
    }

    series.update(updatedBar);
    
    // Cache the updated bar state for subsequent ticks comparison
    lastBarRef.current = {
      time: targetTime,
      open: updatedBar.open,
      high: updatedBar.high,
      low: updatedBar.low,
      close: updatedBar.close,
    };
  }, [currentPrice, timeframe]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full"
    />
  );
};
