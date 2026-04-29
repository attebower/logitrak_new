"use client";

/**
 * ThemeToggle — three-state theme switch (System / Light / Dark).
 *
 * Persists to localStorage under "logitrak-theme". On mount, reads stored
 * preference and applies; if "system", listens to prefers-color-scheme.
 *
 * Pair with the inline anti-flash script in src/app/layout.tsx that runs
 * before React hydrates so the page renders with the right theme on first
 * paint.
 */

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "system" | "light" | "dark";
const STORAGE_KEY = "logitrak-theme";

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === "light" || v === "dark" || v === "system") return v;
  return "system";
}

function resolveSystem(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const resolved = theme === "system" ? resolveSystem() : theme;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(readStoredTheme());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    applyTheme(theme);
    window.localStorage.setItem(STORAGE_KEY, theme);

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyTheme("system");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme, mounted]);

  // Avoid hydration flash by rendering an inert placeholder until mounted.
  if (!mounted) {
    return <div className={cn("h-7", compact ? "w-7" : "w-[110px]")} aria-hidden />;
  }

  const options: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: "light",  label: "Light",  icon: <Sun     className="h-3.5 w-3.5" /> },
    { value: "system", label: "Auto",   icon: <Monitor className="h-3.5 w-3.5" /> },
    { value: "dark",   label: "Dark",   icon: <Moon    className="h-3.5 w-3.5" /> },
  ];

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-btn bg-grey-light p-0.5"
      role="radiogroup"
      aria-label="Theme"
    >
      {options.map((opt) => {
        const active = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(opt.value)}
            className={cn(
              "inline-flex items-center gap-1 rounded-[5px] px-2 py-1 text-[11px] font-semibold transition-colors",
              active
                ? "bg-surface text-surface-dark shadow-sm"
                : "text-grey hover:text-surface-dark"
            )}
            title={`Theme: ${opt.label}`}
          >
            {opt.icon}
            {!compact && <span>{opt.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
