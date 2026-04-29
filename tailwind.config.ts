import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue:           "#1B4FD8",
          "blue-hover":   "#1741B3",
          "blue-light":   "#EFF6FF",
          "blue-mid":     "#DBEAFE",
        },
        surface: {
          dark:  "#0F172A",
          dark2: "#1E293B",
          dark3: "#334155",
        },
        status: {
          green:          "#16A34A",
          "green-light":  "#DCFCE7",
          amber:          "#D97706",
          "amber-light":  "#FEF3C7",
          red:            "#DC2626",
          "red-light":    "#FEE2E2",
          teal:           "#0D9488",
          "teal-light":   "#CCFBF1",
          // Under Repair — orange
          orange:         "#EA580C",
          "orange-light": "#FFF7ED",
        },
        grey: {
          DEFAULT: "#64748B",
          light:   "#F8FAFC",
          mid:     "#E2E8F0",
        },
        slate: {
          muted: "#475569",
        },
      },
      fontSize: {
        display:     ["1.75rem", { fontWeight: "800", letterSpacing: "-0.0625rem", lineHeight: "1.1" }],
        heading:     ["1.25rem", { fontWeight: "700", lineHeight: "1.3" }],
        "body-semi": ["0.9375rem", { fontWeight: "600", lineHeight: "1.5" }],
        body:        ["0.8125rem", { fontWeight: "400", lineHeight: "1.5" }],
        caption:     ["0.6875rem", { fontWeight: "700", lineHeight: "1.4", letterSpacing: "0.03125rem" }],
        serial:      ["0.8125rem", { fontWeight: "700", letterSpacing: "0.125rem" }],
      },
      borderRadius: {
        card:    "10px",
        btn:     "7px",
        badge:   "12px",
        panel:   "14px",
        scanner: "12px",
      },
      boxShadow: {
        device: "0 24px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)",
        card:   "0 1px 3px rgba(0,0,0,0.05)",
      },
      width: {
        sidebar: "240px",
      },
      height: {
        topbar: "56px",
      },
      keyframes: {
        "scan-line": {
          "0%":   { top: "10%" },
          "50%":  { top: "85%" },
          "100%": { top: "10%" },
        },
        throb: {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.35" },
        },
        cutaway: {
          "0%":   { opacity: "0", transform: "scale(0.92)" },
          "15%":  { opacity: "1", transform: "scale(1)" },
          "80%":  { opacity: "1", transform: "scale(1)" },
          "100%": { opacity: "0", transform: "scale(1.02)" },
        },
        "check-pop": {
          "0%":   { opacity: "0", transform: "scale(0.4) rotate(-10deg)" },
          "60%":  { opacity: "1", transform: "scale(1.15) rotate(0deg)" },
          "100%": { opacity: "1", transform: "scale(1)   rotate(0deg)" },
        },
      },
      animation: {
        "scan-line": "scan-line 2s ease-in-out infinite",
        "throb":     "throb 2s ease-in-out infinite",
        "cutaway":   "cutaway 1500ms ease-in-out forwards",
        "check-pop": "check-pop 500ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
