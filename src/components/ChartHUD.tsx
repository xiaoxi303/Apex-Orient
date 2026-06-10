"use client";

import React, { useRef, useState } from "react";
import { useStockStore, DrawingTool } from "@/store/useStockStore";
import {
  MousePointer2,
  TrendingUp,
  Minus,
  GitBranch,
  Trash2,
} from "lucide-react";
import { cn } from "@/utils/cn";

interface ChartHUDProps {
  drawingKey: string; // "SYMBOL_TIMEFRAME"
}

interface ToolDef {
  id: DrawingTool;
  icon: React.ReactNode;
  label: string;
}

const tools: ToolDef[] = [
  { id: "pointer", icon: <MousePointer2 size={14} />, label: "Pointer (Pan)" },
  { id: "trendline", icon: <TrendingUp size={14} />, label: "Trend Line" },
  { id: "horizontal", icon: <Minus size={14} />, label: "Horizontal Line" },
  { id: "fibonacci", icon: <GitBranch size={14} />, label: "Fibonacci Retracement" },
];

export const ChartHUD: React.FC<ChartHUDProps> = ({ drawingKey }) => {
  const { activeDrawingTool, setActiveDrawingTool, clearDrawings, chartDrawings } =
    useStockStore();
  const hudRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const drawingCount = (chartDrawings[drawingKey] || []).length;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!hudRef.current) return;
    const rect = hudRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    hudRef.current.style.setProperty("--hud-x", `${x}px`);
    hudRef.current.style.setProperty("--hud-y", `${y}px`);
  };

  return (
    <div
      ref={hudRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "absolute top-3 right-3 z-40 flex flex-col gap-1 p-1.5 rounded-2xl transition-all duration-500",
        // Glass styling
        "backdrop-blur-2xl",
        "bg-white/35 dark:bg-[#0c0f17]/55",
        "border border-white/40 dark:border-white/[0.07]",
        "shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
        // Expand on hover
        isHovered ? "opacity-100 scale-100" : "opacity-70 scale-[0.97]"
      )}
    >
      {/* Mouse-following glow overlay */}
      {isHovered && (
        <div
          className="pointer-events-none absolute inset-0 z-0 rounded-2xl transition-opacity duration-300 opacity-100"
          style={{
            background: `radial-gradient(100px circle at var(--hud-x, 20px) var(--hud-y, 20px), rgba(99, 102, 241, 0.12), transparent 70%)`,
          }}
        />
      )}

      {/* Drawing tool buttons */}
      {tools.map((tool) => {
        const isActive = activeDrawingTool === tool.id;
        return (
          <button
            key={tool.id}
            title={tool.label}
            onClick={() => setActiveDrawingTool(tool.id)}
            className={cn(
              "relative z-10 flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-300",
              "text-slate-500 dark:text-slate-400",
              "hover:text-slate-800 dark:hover:text-slate-100",
              "hover:bg-white/50 dark:hover:bg-white/[0.08]",
              isActive && "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 dark:bg-indigo-500/15 shadow-[0_0_12px_rgba(99,102,241,0.15)] dark:shadow-[0_0_12px_rgba(99,102,241,0.25)] ring-1 ring-indigo-500/20 dark:ring-indigo-400/20"
            )}
          >
            {tool.icon}
            {/* Active glow dot indicator */}
            {isActive && (
              <span className="absolute -right-0.5 -top-0.5 w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 shadow-md" />
            )}
          </button>
        );
      })}

      {/* Separator line */}
      <div className="mx-2 my-0.5 border-t border-black/5 dark:border-white/5 relative z-10" />

      {/* Clear all drawings */}
      <button
        title={`Clear Drawings (${drawingCount})`}
        onClick={() => clearDrawings(drawingKey)}
        className={cn(
          "relative z-10 flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-300",
          "text-slate-400 dark:text-slate-500",
          "hover:text-rose-500 dark:hover:text-rose-400",
          "hover:bg-rose-500/10 dark:hover:bg-rose-500/10",
          drawingCount > 0 && "text-rose-400/60 dark:text-rose-500/50"
        )}
      >
        <Trash2 size={14} />
        {drawingCount > 0 && (
          <span className="absolute -right-1 -bottom-0.5 text-[8px] font-bold text-rose-500 dark:text-rose-400 bg-rose-500/10 rounded-full w-3.5 h-3.5 flex items-center justify-center">
            {drawingCount}
          </span>
        )}
      </button>
    </div>
  );
};
