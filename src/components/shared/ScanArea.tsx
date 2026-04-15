/**
 * LogiTrak ScanArea Component
 * Matches Screen 02 of LogiTrak_UI_Concepts.html — check in/out scanner panel.
 *
 * Dark background. QR viewfinder with animated corner brackets and scan-line.
 * Serial input below. Used exclusively on the Check In/Out page.
 *
 * Usage:
 *   <ScanArea
 *     onScan={(serial) => addToBatch(serial)}
 *     onManualEntry={(serial) => addToBatch(serial)}
 *   />
 */

"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface ScanAreaProps {
  /** Called when a QR code is successfully decoded */
  onScan?: (serial: string) => void;
  /** Called when the user submits the manual serial entry field */
  onManualEntry?: (serial: string) => void;
  /** Visual state — scan line animates when active */
  isScanning?: boolean;
  className?: string;
}

export function ScanArea({
  onScan, // eslint-disable-line @typescript-eslint/no-unused-vars -- wired in Sprint 2 (QR decode)
  onManualEntry,
  isScanning = true,
  className,
}: ScanAreaProps) {
  const [serial, setSerial] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && serial.trim()) {
      onManualEntry?.(serial.trim().toUpperCase());
      setSerial("");
    }
  }

  return (
    <div
      className={cn(
        "bg-surface-dark rounded-scanner px-8 py-8 text-center relative overflow-hidden",
        className
      )}
    >
      {/* ── QR Viewfinder ── */}
      <div className="relative w-[180px] h-[180px] mx-auto mb-4">
        {/* Background tint */}
        <div className="absolute inset-0 rounded-[12px] border-[3px] border-brand-blue bg-brand-blue/5" />

        {/* Corner brackets */}
        <CornerBracket position="tl" />
        <CornerBracket position="tr" />
        <CornerBracket position="bl" />
        <CornerBracket position="br" />

        {/* Animated scan line */}
        {isScanning && (
          <div className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-brand-blue to-transparent animate-scan-line" />
        )}

        {/* Camera placeholder icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-4xl opacity-30" aria-hidden>📷</span>
        </div>
      </div>

      {/* Label */}
      <p className="text-[13px] text-slate-400">Point camera at QR code</p>
      <p className="text-[12px] text-slate-600 my-3">— or type serial —</p>

      {/* Serial input */}
      <input
        ref={inputRef}
        type="text"
        value={serial}
        onChange={(e) => setSerial(e.target.value.toUpperCase())}
        onKeyDown={handleKeyDown}
        maxLength={10}
        placeholder="00000"
        className={cn(
          "w-[200px] bg-white/[0.06] border border-white/[0.12] rounded-[8px]",
          "px-3.5 py-2.5 text-white text-[16px] font-bold text-center tracking-[0.25rem]",
          "focus:outline-none focus:border-brand-blue focus:bg-white/10",
          "placeholder:text-slate-600 placeholder:tracking-normal"
        )}
        aria-label="Enter serial number manually"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
      />
    </div>
  );
}

// ── Corner bracket helper ──────────────────────────────────────────────────

type CornerPosition = "tl" | "tr" | "bl" | "br";

const cornerClasses: Record<CornerPosition, string> = {
  tl: "top-[-3px] left-[-3px] border-t-[4px] border-l-[4px] rounded-tl-[4px]",
  tr: "top-[-3px] right-[-3px] border-t-[4px] border-r-[4px] rounded-tr-[4px]",
  bl: "bottom-[-3px] left-[-3px] border-b-[4px] border-l-[4px] rounded-bl-[4px]",
  br: "bottom-[-3px] right-[-3px] border-b-[4px] border-r-[4px] rounded-br-[4px]",
};

function CornerBracket({ position }: { position: CornerPosition }) {
  return (
    <div
      className={cn(
        "absolute w-5 h-5 border-brand-blue",
        cornerClasses[position]
      )}
      aria-hidden
    />
  );
}

/*
 * Animation: add to tailwind.config.ts > theme.extend.keyframes + animation:
 *
 * keyframes: {
 *   "scan-line": {
 *     "0%":   { top: "10%" },
 *     "50%":  { top: "85%" },
 *     "100%": { top: "10%" },
 *   },
 * },
 * animation: {
 *   "scan-line": "scan-line 2s ease-in-out infinite",
 * },
 */
