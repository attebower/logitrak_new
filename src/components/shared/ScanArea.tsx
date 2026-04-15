/**
 * LogiTrak ScanArea Component
 * Matches Screen 02 of LogiTrak_UI_Concepts.html — check in/out scanner panel.
 *
 * Dark background. QR viewfinder with animated corner brackets and scan-line.
 * Serial input below. Used exclusively on the Check In/Out page.
 *
 * QR scanning: react-qr-barcode-scanner (camera-based)
 * Audio: Web Audio API — short confirmation beep on successful scan
 *
 * Usage:
 *   <ScanArea
 *     onScan={(serial) => addToBatch(serial)}
 *     onManualEntry={(serial) => addToBatch(serial)}
 *   />
 */

"use client";

import { useRef, useState, useCallback } from "react";
import BarcodeScannerComponent from "react-qr-barcode-scanner";
import { cn } from "@/lib/utils";

export interface ScanAreaProps {
  /** Called when a QR code or barcode is successfully decoded */
  onScan?: (serial: string) => void;
  /** Called when the user submits the manual serial entry field */
  onManualEntry?: (serial: string) => void;
  /** Visual state — scan line animates when active */
  isScanning?: boolean;
  className?: string;
}

// ── Web Audio confirmation beep ──────────────────────────────────────────

function playConfirmationBeep() {
  try {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);          // A5 — bright, clear
    oscillator.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08); // ramp up

    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18); // quick decay

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.2);

    // Close AudioContext after sound finishes to avoid resource leak
    oscillator.onended = () => { void ctx.close(); };
  } catch {
    // AudioContext unavailable (e.g. SSR) — silently ignore
  }
}

// ── Component ─────────────────────────────────────────────────────────────

export function ScanArea({
  onScan,
  onManualEntry,
  isScanning = true,
  className,
}: ScanAreaProps) {
  const [serial, setSerial]             = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [lastScanned, setLastScanned]   = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce: QR scanners fire rapidly — only accept a serial once per 1.5s
  const lastScanTime = useRef<number>(0);

  const handleBarcodeScan = useCallback(
    (_err: unknown, result: { getText: () => string } | undefined) => {
      if (!result) return;
      const text = result.getText().trim().toUpperCase();
      if (!text) return;

      const now = Date.now();
      if (now - lastScanTime.current < 1500) return; // debounce
      lastScanTime.current = now;

      setLastScanned(text);
      playConfirmationBeep();
      onScan?.(text);
    },
    [onScan]
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && serial.trim()) {
      const value = serial.trim().toUpperCase();
      playConfirmationBeep();
      onManualEntry?.(value);
      setLastScanned(value);
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
      {/* ── Camera toggle ── */}
      <div className="flex justify-end mb-3">
        <button
          type="button"
          onClick={() => setCameraActive((v) => !v)}
          className="text-[11px] font-semibold text-brand-blue hover:text-brand-blue-hover transition-colors"
        >
          {cameraActive ? "📷 Hide Camera" : "📷 Use Camera"}
        </button>
      </div>

      {/* ── Camera view (react-qr-barcode-scanner) ── */}
      {cameraActive ? (
        <div className="relative w-[240px] h-[240px] mx-auto mb-4 rounded-[12px] overflow-hidden border-[3px] border-brand-blue">
          <BarcodeScannerComponent
            width={240}
            height={240}
            onUpdate={handleBarcodeScan}
          />
          {/* Corner brackets overlay */}
          <div className="absolute inset-0 pointer-events-none">
            <CornerBracket position="tl" />
            <CornerBracket position="tr" />
            <CornerBracket position="bl" />
            <CornerBracket position="br" />
          </div>
          {/* Scan line */}
          {isScanning && (
            <div className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-brand-blue to-transparent animate-scan-line pointer-events-none" />
          )}
        </div>
      ) : (
        /* ── Static viewfinder (no camera) ── */
        <div className="relative w-[180px] h-[180px] mx-auto mb-4">
          <div className="absolute inset-0 rounded-[12px] border-[3px] border-brand-blue bg-brand-blue/5" />
          <CornerBracket position="tl" />
          <CornerBracket position="tr" />
          <CornerBracket position="bl" />
          <CornerBracket position="br" />
          {isScanning && (
            <div className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-brand-blue to-transparent animate-scan-line" />
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl opacity-30" aria-hidden>📷</span>
          </div>
        </div>
      )}

      {/* Last scanned confirmation */}
      {lastScanned && (
        <p className="text-[11px] text-status-green mb-2 font-semibold">
          ✓ Scanned: {lastScanned}
        </p>
      )}

      <p className="text-[13px] text-slate-400">
        {cameraActive ? "Point camera at QR code" : "Enable camera or type serial below"}
      </p>
      <p className="text-[12px] text-slate-600 my-3">— or type serial —</p>

      {/* ── Serial input ── */}
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
