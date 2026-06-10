"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { useStockStore, DrawingItem, DrawingPoint } from "@/store/useStockStore";
import type { Timeframe } from "@/data/mockOHLCV";
import type { IChartApi, ISeriesApi, SeriesType, Time } from "lightweight-charts";
import { cn } from "@/utils/cn";

interface DrawingOverlayProps {
  symbol: string;
  timeframe: Timeframe;
  chart: IChartApi | null;
  series: ISeriesApi<SeriesType, Time> | null;
}

// Fibonacci levels
const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const FIB_COLORS = [
  "rgba(239, 68, 68, 0.7)",    // 0
  "rgba(249, 115, 22, 0.7)",   // 0.236
  "rgba(234, 179, 8, 0.7)",    // 0.382
  "rgba(34, 197, 94, 0.6)",    // 0.5
  "rgba(59, 130, 246, 0.7)",   // 0.618
  "rgba(139, 92, 246, 0.7)",   // 0.786
  "rgba(239, 68, 68, 0.7)",    // 1
];

function generateId(): string {
  return `drw_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export const DrawingOverlay: React.FC<DrawingOverlayProps> = ({
  symbol,
  timeframe,
  chart,
  series,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const drawingKey = `${symbol}_${timeframe}`;

  const {
    activeDrawingTool,
    setActiveDrawingTool,
    chartDrawings,
    addDrawing,
    removeDrawing,
    theme,
    loadDrawings,
  } = useStockStore();

  const drawings = chartDrawings[drawingKey] || [];

  // Load saved drawings from database whenever symbol or timeframe changes
  useEffect(() => {
    loadDrawings(symbol, timeframe);
  }, [symbol, timeframe, loadDrawings]);

  // Pending drawing state (first click placed, waiting for second)
  const [pendingPoint, setPendingPoint] = useState<DrawingPoint | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Dimensions tracking
  const [dims, setDims] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDims({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    ro.observe(svg);
    return () => ro.disconnect();
  }, []);

  // Convert price/time to pixel coordinates using the chart's coordinate system
  const toPixel = useCallback(
    (point: DrawingPoint): { x: number; y: number } | null => {
      if (!chart || !series) return null;

      let timeVal: Time = point.time as Time;
      if (timeframe === "1d") {
        timeVal = new Date(point.time * 1000).toISOString().split("T")[0];
      }

      const timeCoord = chart.timeScale().timeToCoordinate(timeVal);
      const priceCoord = series.priceToCoordinate(point.price);

      if (timeCoord === null || priceCoord === null) return null;
      return { x: timeCoord, y: priceCoord };
    },
    [chart, series, timeframe]
  );

  // Convert pixel to price/time
  const fromPixel = useCallback(
    (x: number, y: number): DrawingPoint | null => {
      if (!chart || !series) return null;

      const time = chart.timeScale().coordinateToTime(x);
      const price = series.coordinateToPrice(y);

      if (time === null || price === null) return null;

      let timeNum = 0;
      if (typeof time === "string") {
        timeNum = Math.floor(new Date(time).getTime() / 1000);
      } else if (typeof time === "number") {
        timeNum = time;
      } else if (time && typeof time === "object") {
        // BusinessDay object
        const bd = time as { year: number; month: number; day: number };
        timeNum = Math.floor(new Date(Date.UTC(bd.year, bd.month - 1, bd.day)).getTime() / 1000);
      }

      return { time: timeNum, price };
    },
    [chart, series]
  );

  // Handle mouse events
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (activeDrawingTool === "pointer" || activeDrawingTool === "none") return;
    if (!svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const point = fromPixel(x, y);
    if (!point) return;

    if (activeDrawingTool === "horizontal") {
      // Single-click placement
      addDrawing(drawingKey, {
        id: generateId(),
        type: "horizontal",
        points: [point],
        color: theme === "dark" ? "rgba(250, 204, 21, 0.7)" : "rgba(202, 138, 4, 0.8)",
        lineWidth: 1,
      });
      setActiveDrawingTool("pointer");
      return;
    }

    // Two-click drawing: trendline, fibonacci
    if (!pendingPoint) {
      setPendingPoint(point);
    } else {
      addDrawing(drawingKey, {
        id: generateId(),
        type: activeDrawingTool,
        points: [pendingPoint, point],
        color:
          activeDrawingTool === "fibonacci"
            ? "rgba(139, 92, 246, 0.6)"
            : theme === "dark"
            ? "rgba(99, 102, 241, 0.7)"
            : "rgba(79, 70, 229, 0.8)",
        lineWidth: 1.5,
        ...(activeDrawingTool === "fibonacci" && { fibLevels: FIB_LEVELS }),
      });
      setPendingPoint(null);
      setActiveDrawingTool("pointer");
    }
  };

  // Cancel pending on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPendingPoint(null);
        setActiveDrawingTool("pointer");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setActiveDrawingTool]);

  // Recompute pixel coords whenever chart viewport changes
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (!chart) return;
    const handler = () => forceUpdate((v) => v + 1);
    chart.timeScale().subscribeVisibleLogicalRangeChange(handler);
    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handler);
    };
  }, [chart]);

  const isDrawing = activeDrawingTool !== "pointer" && activeDrawingTool !== "none";

  // Helper: render a single drawing
  const renderDrawing = (drawing: DrawingItem) => {
    if (drawing.type === "horizontal") {
      const p = drawing.points[0];
      if (!series) return null;
      const yCoord = series.priceToCoordinate(p.price);
      if (yCoord === null) return null;

      return (
        <g key={drawing.id}>
          <line
            x1={0}
            y1={yCoord}
            x2={dims.width}
            y2={yCoord}
            stroke={drawing.color}
            strokeWidth={drawing.lineWidth}
            strokeDasharray="6 3"
          />
          <text
            x={dims.width - 4}
            y={yCoord - 4}
            textAnchor="end"
            className="fill-yellow-500 dark:fill-yellow-400 text-[9px] font-mono font-bold"
          >
            {p.price.toFixed(2)}
          </text>
          {/* Delete handle */}
          <circle
            cx={12}
            cy={yCoord}
            r={5}
            className="fill-rose-500/20 stroke-rose-500/40 cursor-pointer hover:fill-rose-500/50 transition-colors"
            strokeWidth={1}
            onClick={(e) => {
              e.stopPropagation();
              removeDrawing(drawingKey, drawing.id);
            }}
          />
          <text
            x={12}
            y={yCoord + 3}
            textAnchor="middle"
            className="fill-rose-400 text-[7px] font-bold pointer-events-none"
          >
            ×
          </text>
        </g>
      );
    }

    if (drawing.type === "trendline" && drawing.points.length === 2) {
      const p1 = toPixel(drawing.points[0]);
      const p2 = toPixel(drawing.points[1]);
      if (!p1 || !p2) return null;

      return (
        <g key={drawing.id}>
          <line
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke={drawing.color}
            strokeWidth={drawing.lineWidth}
            strokeLinecap="round"
          />
          {/* Start/end dots */}
          <circle cx={p1.x} cy={p1.y} r={3} className="fill-indigo-500/50" />
          <circle cx={p2.x} cy={p2.y} r={3} className="fill-indigo-500/50" />
          {/* Delete handle at midpoint */}
          <circle
            cx={(p1.x + p2.x) / 2}
            cy={(p1.y + p2.y) / 2}
            r={5}
            className="fill-rose-500/20 stroke-rose-500/40 cursor-pointer hover:fill-rose-500/50 opacity-0 hover:opacity-100 transition-opacity"
            strokeWidth={1}
            onClick={(e) => {
              e.stopPropagation();
              removeDrawing(drawingKey, drawing.id);
            }}
          />
        </g>
      );
    }

    if (drawing.type === "fibonacci" && drawing.points.length === 2) {
      const p1 = toPixel(drawing.points[0]);
      const p2 = toPixel(drawing.points[1]);
      if (!p1 || !p2) return null;

      const price1 = drawing.points[0].price;
      const price2 = drawing.points[1].price;
      const priceDiff = price2 - price1;

      return (
        <g key={drawing.id}>
          {FIB_LEVELS.map((level, idx) => {
            const fibPrice = price1 + priceDiff * level;
            if (!series) return null;
            const yCoord = series.priceToCoordinate(fibPrice);
            if (yCoord === null) return null;

            return (
              <g key={level}>
                {/* Background fill zone */}
                {idx < FIB_LEVELS.length - 1 && (() => {
                  const nextPrice = price1 + priceDiff * FIB_LEVELS[idx + 1];
                  const nextY = series.priceToCoordinate(nextPrice);
                  if (nextY === null) return null;
                  return (
                    <rect
                      x={Math.min(p1.x, p2.x)}
                      y={Math.min(yCoord, nextY)}
                      width={Math.abs(p2.x - p1.x)}
                      height={Math.abs(nextY - yCoord)}
                      fill={FIB_COLORS[idx]}
                      opacity={0.04}
                    />
                  );
                })()}
                <line
                  x1={Math.min(p1.x, p2.x) - 20}
                  y1={yCoord}
                  x2={Math.max(p1.x, p2.x) + 20}
                  y2={yCoord}
                  stroke={FIB_COLORS[idx]}
                  strokeWidth={0.8}
                  strokeDasharray="4 2"
                />
                <text
                  x={Math.max(p1.x, p2.x) + 24}
                  y={yCoord + 3}
                  className="text-[8px] font-mono font-bold"
                  fill={FIB_COLORS[idx]}
                >
                  {(level * 100).toFixed(1)}% — {fibPrice.toFixed(2)}
                </text>
              </g>
            );
          })}
          {/* Delete handle */}
          <circle
            cx={Math.min(p1.x, p2.x) - 28}
            cy={(p1.y + p2.y) / 2}
            r={5}
            className="fill-rose-500/20 stroke-rose-500/40 cursor-pointer hover:fill-rose-500/50 transition-colors"
            strokeWidth={1}
            onClick={(e) => {
              e.stopPropagation();
              removeDrawing(drawingKey, drawing.id);
            }}
          />
          <text
            x={Math.min(p1.x, p2.x) - 28}
            y={(p1.y + p2.y) / 2 + 3}
            textAnchor="middle"
            className="fill-rose-400 text-[7px] font-bold pointer-events-none"
          >
            ×
          </text>
        </g>
      );
    }

    return null;
  };

  // Render pending preview
  const renderPendingPreview = () => {
    if (!pendingPoint || !mousePos) return null;
    const p1 = toPixel(pendingPoint);
    if (!p1) return null;

    if (activeDrawingTool === "trendline") {
      return (
        <line
          x1={p1.x}
          y1={p1.y}
          x2={mousePos.x}
          y2={mousePos.y}
          stroke="rgba(99, 102, 241, 0.5)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          strokeLinecap="round"
        />
      );
    }

    if (activeDrawingTool === "fibonacci") {
      // Show just a vertical range preview
      return (
        <>
          <line
            x1={p1.x}
            y1={p1.y}
            x2={mousePos.x}
            y2={mousePos.y}
            stroke="rgba(139, 92, 246, 0.4)"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          <circle cx={p1.x} cy={p1.y} r={3} className="fill-purple-500/50" />
          <circle cx={mousePos.x} cy={mousePos.y} r={3} className="fill-purple-500/50" />
        </>
      );
    }

    return null;
  };

  return (
    <svg
      ref={svgRef}
      className={cn(
        "absolute inset-0 w-full h-full z-30",
        isDrawing ? "cursor-crosshair" : "pointer-events-none"
      )}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
    >
      {/* Existing drawings */}
      {drawings.map(renderDrawing)}

      {/* Pending preview */}
      {renderPendingPreview()}

      {/* Crosshair guides when in drawing mode */}
      {isDrawing && mousePos && (
        <g className="pointer-events-none">
          <line
            x1={mousePos.x}
            y1={0}
            x2={mousePos.x}
            y2={dims.height}
            stroke={theme === "dark" ? "rgba(99, 102, 241, 0.15)" : "rgba(99, 102, 241, 0.1)"}
            strokeWidth={1}
            strokeDasharray="2 2"
          />
          <line
            x1={0}
            y1={mousePos.y}
            x2={dims.width}
            y2={mousePos.y}
            stroke={theme === "dark" ? "rgba(99, 102, 241, 0.15)" : "rgba(99, 102, 241, 0.1)"}
            strokeWidth={1}
            strokeDasharray="2 2"
          />
        </g>
      )}
    </svg>
  );
};
