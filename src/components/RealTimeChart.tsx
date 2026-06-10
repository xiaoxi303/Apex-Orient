"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
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

// Maps timeframes to Twelve Data intervals
const mapTwelveDataInterval = (tf: string): string => {
  switch (tf) {
    case "1m": return "1min";
    case "5m": return "5min";
    case "15m": return "15min";
    case "1h": return "1h";
    case "4h": return "4h";
    case "1d":
    default:
      return "1day";
  }
};

function formatTwelveDataSymbol(symbol: string, enabled: boolean): string {
  if (!enabled) return symbol;
  const nasdaqTickers = ["AAPL", "MSFT", "NVDA", "TSLA", "GOOGL", "META", "AMZN", "NFLX", "QQQ"];
  const nyseTickers = ["DIA", "IWM"];
  const upper = symbol.toUpperCase();
  if (nasdaqTickers.includes(upper)) {
    return `${upper}:NASDAQ`;
  }
  if (nyseTickers.includes(upper)) {
    return `${upper}:NYSE`;
  }
  return symbol;
}

export const RealTimeChart: React.FC<RealTimeChartProps> = ({
  symbol,
  timeframe,
  onCrosshairMove,
  onChartReady,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  
  const seriesRef = useRef<ISeriesApi<"Candlestick", Time> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram", Time> | null>(null);
  
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  
  const customPriceLineRef = useRef<IPriceLine | null>(null);
  const lastBarRef = useRef<{ time: number; open: number; high: number; low: number; close: number } | null>(null);

  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);

  const theme = useStockStore((s) => s.theme);
  const isRefreshing = useStockStore((s) => s.isRefreshing);
  const smartSymbolSwitch = useStockStore((s) => s.smartSymbolSwitch);
  
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

  // Fallback to mock data in case Twelve Data rate-limits or fails
  const loadFallbackMockData = useCallback(
    (
      candleSeries: ISeriesApi<"Candlestick", Time>,
      volumeSeries: ISeriesApi<"Histogram", Time>,
      colors: ReturnType<typeof getChartColors>
    ) => {
      const bars = generateMockOHLCV(symbol, timeframe, 200);

      const formattedBars = bars.map((bar) => ({
        time: (timeframe === "1d"
          ? new Date((bar.time as number) * 1000).toISOString().split("T")[0]
          : bar.time) as Time,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      }));

      candleSeries.setData(formattedBars);

      const volumeData = bars.map((bar) => ({
        time: (timeframe === "1d"
          ? new Date((bar.time as number) * 1000).toISOString().split("T")[0]
          : bar.time) as Time,
        value: bar.volume,
        color: bar.close >= bar.open ? colors.volumeUp : colors.volumeDown,
      }));
      volumeSeries.setData(volumeData);

      const lastBar = bars[bars.length - 1];
      const lastBarTime = typeof lastBar.time === "number"
        ? lastBar.time
        : Math.floor(new Date(lastBar.time as unknown as string).getTime() / 1000);

      const lastBarNormalizedTime = timeframe === "1d"
        ? Math.floor(new Date(new Date(lastBarTime * 1000).toISOString().split("T")[0] + "T00:00:00Z").getTime() / 1000)
        : lastBarTime;

      lastBarRef.current = {
        time: lastBarNormalizedTime,
        open: lastBar.open,
        high: lastBar.high,
        low: lastBar.low,
        close: lastBar.close,
      };
    },
    [symbol, timeframe]
  );

  // Direct Twelve Data Time Series loader
  const loadHistoryData = useCallback(
    async (
      chart: IChartApi,
      candleSeries: ISeriesApi<"Candlestick", Time>,
      volumeSeries: ISeriesApi<"Histogram", Time>
    ) => {
      setIsHistoryLoaded(false);
      const isDark = theme === "dark";
      const colors = getChartColors(isDark);

      const twelveApiKey = useStockStore.getState().twelveDataApiKey || "demo";
      const mappedInterval = mapTwelveDataInterval(timeframe);
      const formattedSymbol = formatTwelveDataSymbol(symbol, smartSymbolSwitch);

      try {
        console.log(`[Twelve Data Chart API] Fetching direct time series: symbol=${formattedSymbol}, interval=${mappedInterval}`);
        
        // Fetch from Twelve Data with UTC timezone parameter to prevent local timezone shifts
        const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(
          formattedSymbol
        )}&interval=${mappedInterval}&outputsize=500&timezone=UTC&apikey=${twelveApiKey}`;

        const res = await fetch(url);
        const json = await res.json();

        if (json.status === "ok" && Array.isArray(json.values) && json.values.length > 0) {
          console.log(`[Twelve Data Chart API] Received ${json.values.length} bars successfully.`);

          interface TwelveDataBar {
            datetime: string;
            open: string;
            high: string;
            low: string;
            close: string;
            volume: string;
          }

          // Format to TradingView requirements
          const formattedBars = json.values.map((item: TwelveDataBar) => {
            let timeVal: Time;
            if (timeframe === "1d") {
              timeVal = item.datetime.split(" ")[0]; // YYYY-MM-DD
            } else {
              timeVal = Math.floor(new Date(item.datetime + "Z").getTime() / 1000) as Time;
            }

            return {
              time: timeVal,
              open: parseFloat(item.open),
              high: parseFloat(item.high),
              low: parseFloat(item.low),
              close: parseFloat(item.close),
            };
          }).reverse(); // ⚡ Twelve Data returns newest-first, MUST reverse to oldest-first

          candleSeries.setData(formattedBars);

          const volumeData = json.values.map((item: TwelveDataBar) => {
            let timeVal: Time;
            if (timeframe === "1d") {
              timeVal = item.datetime.split(" ")[0]; // YYYY-MM-DD
            } else {
              timeVal = Math.floor(new Date(item.datetime + "Z").getTime() / 1000) as Time;
            }

            return {
              time: timeVal,
              value: parseFloat(item.volume || "0"),
              color: parseFloat(item.close) >= parseFloat(item.open) ? colors.volumeUp : colors.volumeDown,
            };
          }).reverse();

          volumeSeries.setData(volumeData);
          chart.timeScale().fitContent();

          // Cache last historical bar
          const lastBar = formattedBars[formattedBars.length - 1];
          let lastBarTime = 0;
          if (typeof lastBar.time === "string") {
            lastBarTime = Math.floor(new Date(lastBar.time + "T00:00:00Z").getTime() / 1000);
          } else {
            lastBarTime = lastBar.time;
          }

          lastBarRef.current = {
            time: lastBarTime,
            open: lastBar.open,
            high: lastBar.high,
            low: lastBar.low,
            close: lastBar.close,
          };
          setIsHistoryLoaded(true);
        } else {
          console.warn(
            `[Twelve Data Chart API] API status non-ok: ${json.message || "No data"}. Employing mock fallback.`
          );
          loadFallbackMockData(candleSeries, volumeSeries, colors);
          setIsHistoryLoaded(true);
        }
      } catch (err) {
        console.error("[Twelve Data Chart API] Failed to fetch time series:", err);
        loadFallbackMockData(candleSeries, volumeSeries, colors);
        setIsHistoryLoaded(true);
      }
    },
    [symbol, timeframe, theme, getChartColors, loadFallbackMockData, smartSymbolSwitch]
  );

  // Initialize chart canvas
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isDark = theme === "dark";
    const colors = getChartColors(isDark);

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

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: colors.upColor,
      downColor: colors.downColor,
      borderDownColor: colors.downColor,
      borderUpColor: colors.upColor,
      wickDownColor: colors.downColor,
      wickUpColor: colors.upColor,
      priceLineVisible: false, 
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: colors.volumeUp,
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    chartRef.current = chart;
    seriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    loadHistoryData(chart, candleSeries, volumeSeries);

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
      customPriceLineRef.current = null; 
      lastBarRef.current = null; 
      setIsHistoryLoaded(false); 
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, timeframe, smartSymbolSwitch]);

  // Sync theme changes
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

  // Handle force refresh
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
    if (!series || !isHistoryLoaded || currentPrice === undefined || currentPrice === null) return;

    if (!customPriceLineRef.current) {
      customPriceLineRef.current = series.createPriceLine({
        price: currentPrice,
        color: "#ef4444", 
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
  }, [currentPrice, isHistoryLoaded]);

  // Manage real-time candlestick updates (ticks close price)
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !isHistoryLoaded || currentPrice === undefined || currentPrice === null) return;

    const nowSeconds = Math.floor(Date.now() / 1000);
    
    const getBarTime = (tf: string, timeSeconds: number) => {
      switch (tf) {
        case "1m": return Math.floor(timeSeconds / 60) * 60;
        case "5m": return Math.floor(timeSeconds / 300) * 300;
        case "15m": return Math.floor(timeSeconds / 900) * 900;
        case "1h": return Math.floor(timeSeconds / 3600) * 3600;
        case "4h": return Math.floor(timeSeconds / 14400) * 14400;
        case "1d":
        default:
          const nyDateStr = new Date(timeSeconds * 1000).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
          return Math.floor(new Date(nyDateStr + "T00:00:00Z").getTime() / 1000);
      }
    };

    const targetTime = getBarTime(timeframe, nowSeconds);
    const lastBar = lastBarRef.current;
    let updatedBar: {
      time: Time;
      open: number;
      high: number;
      low: number;
      close: number;
    };

    if (lastBar && lastBar.time === targetTime) {
      updatedBar = {
        time: (timeframe === "1d"
          ? new Date(targetTime * 1000).toISOString().split("T")[0]
          : targetTime) as Time,
        open: lastBar.open,
        high: Math.max(lastBar.high, currentPrice),
        low: Math.min(lastBar.low, currentPrice),
        close: currentPrice,
      };
    } else {
      const openPrice = lastBar ? lastBar.close : currentPrice;
      updatedBar = {
        time: (timeframe === "1d"
          ? new Date(targetTime * 1000).toISOString().split("T")[0]
          : targetTime) as Time,
        open: openPrice,
        high: Math.max(openPrice, currentPrice),
        low: Math.min(openPrice, currentPrice),
        close: currentPrice,
      };
    }

    series.update(updatedBar as CandlestickData<Time>);
    
    lastBarRef.current = {
      time: targetTime,
      open: updatedBar.open,
      high: updatedBar.high,
      low: updatedBar.low,
      close: updatedBar.close,
    };
  }, [currentPrice, timeframe, isHistoryLoaded]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full"
    />
  );
};
