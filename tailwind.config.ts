import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        glass: {
          bg: {
            light: "rgba(255, 255, 255, 0.45)",
            dark: "rgba(10, 12, 18, 0.55)",
          },
          border: {
            light: "rgba(255, 255, 255, 0.4)",
            dark: "rgba(255, 255, 255, 0.08)",
          }
        }
      },
      boxShadow: {
        "glass-light": "0 8px 32px 0 rgba(31, 38, 135, 0.04), inset 0 1px 1px 0 rgba(255, 255, 255, 0.6)",
        "glass-dark": "0 8px 32px 0 rgba(0, 0, 0, 0.45), inset 0 1px 1px 0 rgba(255, 255, 255, 0.07), inset 0 -12px 24px -10px rgba(0, 0, 0, 0.5)",
        "glass-inset-light": "inset 0 1px 1px 0 rgba(255, 255, 255, 0.6)",
        "glass-inset-dark": "inset 0 1px 1px 0 rgba(255, 255, 255, 0.07)",
        "glow-green": "0 0 15px rgba(34, 197, 94, 0.25)",
        "glow-red": "0 0 15px rgba(239, 68, 68, 0.25)",
      },
      animation: {
        "marquee": "marquee 25s linear infinite",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(-100%)" },
        }
      }
    },
  },
  plugins: [],
};
export default config;
