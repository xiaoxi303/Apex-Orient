"use client";

import React, { useRef, useState } from "react";
import { cn } from "@/utils/cn";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  glowColor?: string;
  interactive?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className,
  glowColor,
  interactive = true,
  ...props
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    cardRef.current.style.setProperty("--mouse-x", `${x}px`);
    cardRef.current.style.setProperty("--mouse-y", `${y}px`);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "relative overflow-hidden rounded-2xl transition-all duration-300",
        // Light Theme Styling
        "bg-white/40 shadow-glass-light border border-white/50 glass-border-light",
        // Dark Theme Styling
        "dark:bg-[#0c0f17]/45 dark:shadow-glass-dark dark:border-white/5 dark:glass-border-dark",
        // Interactive Scaling
        interactive && "hover:shadow-2xl hover:scale-[1.005] duration-500",
        className
      )}
      {...props}
    >
      {/* Light scattering (inner body glow) */}
      {interactive && isHovered && (
        <div
          className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-500 opacity-100"
          style={{
            background: `radial-gradient(280px circle at var(--mouse-x, 0px) var(--mouse-y, 0px), ${
              glowColor || "var(--card-glow-active)"
            }, transparent 80%)`,
          }}
        />
      )}
      
      {/* High-contrast glossy surface highlight */}
      {interactive && isHovered && (
        <div
          className="pointer-events-none absolute inset-0 z-20 transition-opacity duration-500 opacity-100 rounded-2xl"
          style={{
            background: `radial-gradient(120px circle at var(--mouse-x, 0px) var(--mouse-y, 0px), rgba(255, 255, 255, 0.12), transparent 70%)`,
          }}
        />
      )}

      {/* Content pane — must mirror flex-col to pass layout through */}
      <div className="relative z-30 h-full w-full flex flex-col">{children}</div>
    </div>
  );
};
