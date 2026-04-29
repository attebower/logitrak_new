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
      // ── Colour tokens are CSS-variable-backed so they flip in dark mode.
      // Light values are defined in src/app/globals.css under :root, dark
      // values under .dark. Existing class names (bg-brand-blue, text-grey,
      // etc.) keep working unchanged.
      colors: {
        brand: {
          blue:           "rgb(var(--brand-blue) / <alpha-value>)",
          "blue-hover":   "rgb(var(--brand-blue-hover) / <alpha-value>)",
          "blue-light":   "rgb(var(--brand-blue-light) / <alpha-value>)",
          "blue-mid":     "rgb(var(--brand-blue-mid) / <alpha-value>)",
        },
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          dark:    "rgb(var(--surface-dark) / <alpha-value>)",
          dark2:   "rgb(var(--surface-dark2) / <alpha-value>)",
          dark3:   "rgb(var(--surface-dark3) / <alpha-value>)",
        },
        status: {
          green:          "rgb(var(--status-green) / <alpha-value>)",
          "green-light":  "rgb(var(--status-green-light) / <alpha-value>)",
          amber:          "rgb(var(--status-amber) / <alpha-value>)",
          "amber-light":  "rgb(var(--status-amber-light) / <alpha-value>)",
          red:            "rgb(var(--status-red) / <alpha-value>)",
          "red-light":    "rgb(var(--status-red-light) / <alpha-value>)",
          teal:           "rgb(var(--status-teal) / <alpha-value>)",
          "teal-light":   "rgb(var(--status-teal-light) / <alpha-value>)",
          orange:         "rgb(var(--status-orange) / <alpha-value>)",
          "orange-light": "rgb(var(--status-orange-light) / <alpha-value>)",
        },
        grey: {
          DEFAULT: "rgb(var(--grey) / <alpha-value>)",
          light:   "rgb(var(--grey-light) / <alpha-value>)",
          mid:     "rgb(var(--grey-mid) / <alpha-value>)",
        },
        slate: {
          muted: "rgb(var(--slate-muted) / <alpha-value>)",
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
