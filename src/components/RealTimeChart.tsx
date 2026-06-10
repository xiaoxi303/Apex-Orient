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
  SeriesType,
} from "lightweight-charts";
import { useStockStore } from "@/store/useStockStore";
import { generateMockOHLCV, Timeframe } from "@/data/mockOHLCV";

interface RealTimeChartProps {
  symbol: string;
  timeframe: Timeframe;
  onCrosshairMove?: (time: Time | null, price: number | null) => void;
  onChartReady?: (chart: IChartApi, series: ISeriesApi<SeriesType, Time>) => void;
}

export const RealTimeChart: React.FC<RealTimeChartProps> = ({
  symbol,
  timeframe,
  onCrosshairMove,
  onChartReady,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<SeriesType, Time> | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const theme = useStockStore((s) => s.theme);

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

  // Initialize chart
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

    // Candlestick series (v5 API)
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: colors.upColor,
      downColor: colors.downColor,
      borderDownColor: colors.downColor,
      borderUpColor: colors.upColor,
      wickDownColor: colors.downColor,
      wickUpColor: colors.upColor,
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

    // Dynamic K-line history loading logic
    const loadHistoryData = async () => {
      try {
        console.log(`[Finnhub Raw Data] Fetching history candles for: ${symbol} (${timeframe})`);
        const res = await fetch(
          `/api/stock/history?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`
        );
        const json = await res.json();

        if (json.success && json.data && json.data.s === "ok") {
          const rawCandles = json.data;
          console.log("[Finnhub Raw Data] WebSocket/REST raw candle arrays:", rawCandles);

          // Restructure array-grouped Finnhub candles into standard TradingView OHLC items
          const formattedBars = rawCandles.t.map((timestamp: number, idx: number) => ({
            time: timestamp as Time, // Unix timestamp in seconds
            open: rawCandles.o[idx],
            high: rawCandles.h[idx],
            low: rawCandles.l[idx],
            close: rawCandles.c[idx],
          }));

          console.log("[Mapped State Data] Mapped K-line history for TradingView:", formattedBars);

          // Set candlestick series data
          candleSeries.setData(formattedBars);

          // Set volume series data
          const volumeData = formattedBars.map((bar: { time: Time; open: number; close: number }, idx: number) => ({
            time: bar.time,
            value: rawCandles.v[idx],
            color: bar.close >= bar.open ? colors.volumeUp : colors.volumeDown,
          }));
          volumeSeries.setData(volumeData);
          chart.timeScale().fitContent();
        } else {
          console.warn("[Finnhub Raw Data] History API empty or missing credentials, employing mock data generator.");
          loadFallbackMockData();
        }
      } catch (err) {
        console.error("[Finnhub Raw Data] Failed to load history candles from backend:", err);
        loadFallbackMockData();
      }
    };

    // Helper fallback to fill chart canvas dynamically in offline/sandbox states
    const loadFallbackMockData = () => {
      const bars = generateMockOHLCV(symbol, timeframe, 200);
      candleSeries.setData(bars as CandlestickData<Time>[]);

      const volumeData = bars.map((bar) => ({
        time: bar.time,
        value: bar.volume,
        color: bar.close >= bar.open ? colors.volumeUp : colors.volumeDown,
      }));
      volumeSeries.setData(volumeData);
      chart.timeScale().fitContent();
    };

    // Trigger loader
    loadHistoryData();

    chartRef.current = chart;
    seriesRef.current = candleSeries;

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

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full"
    />
  );
};
