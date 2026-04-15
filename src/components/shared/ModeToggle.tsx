/**
 * LogiTrak ModeToggle Component
 * Check In / Check Out pill toggle.
 *
 * Spec:
 *   - Container: grey-light bg, grey-mid border, rounded-[8px], overflow-hidden
 *   - Check Out active: amber background (#D97706), white text
 *   - Check In active: teal background (#0D9488), white text
 *   - Inactive: grey text, transparent bg
 *
 * Usage:
 *   const [mode, setMode] = useState<CheckMode>("out");
 *   <ModeToggle mode={mode} onChange={setMode} />
 */

"use client";

import { cn } from "@/lib/utils";

export type CheckMode = "in" | "out";

export interface ModeToggleProps {
  mode:     CheckMode;
  onChange: (mode: CheckMode) => void;
  disabled?: boolean;
  className?: string;
}

export function ModeToggle({ mode, onChange, disabled, className }: ModeToggleProps) {
  return (
    <div
      className={cn(
        "flex bg-grey-light border border-grey-mid rounded-[8px] overflow-hidden",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
      role="group"
      aria-label="Check in or out mode"
    >
      {/* Check In */}
      <button
        type="button"
        onClick={() => onChange("in")}
        className={cn(
          "flex-1 py-2 text-[13px] font-semibold transition-colors text-center",
          mode === "in"
            ? "bg-status-teal text-white"
            : "text-grey hover:text-surface-dark"
        )}
        aria-pressed={mode === "in"}
      >
        Check In
      </button>

      {/* Check Out */}
      <button
        type="button"
        onClick={() => onChange("out")}
        className={cn(
          "flex-1 py-2 text-[13px] font-semibold transition-colors text-center",
          mode === "out"
            ? "bg-status-amber text-white"
            : "text-grey hover:text-surface-dark"
        )}
        aria-pressed={mode === "out"}>
        Check Out
      </button>
    </div>
  );
}
