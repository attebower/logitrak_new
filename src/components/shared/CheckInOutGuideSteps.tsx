'use client';

/**
 * CheckInOutGuideSteps — 4-step visual guide shown on the Check In / Check
 * Out page. Explains the scan-batch-confirm flow at a glance. Collapsible.
 */

import { useState } from "react";
import { ArrowLeftRight, ScanLine, MapPin, CheckCircle2, ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Step {
  num:   string;
  icon:  LucideIcon;
  title: string;
  body:  string;
}

const STEPS: Step[] = [
  {
    num:   "01",
    icon:  ArrowLeftRight,
    title: "Pick your mode",
    body:  "Check Out to issue kit to crew, or Check In to return it to stock. Switch anytime.",
  },
  {
    num:   "02",
    icon:  ScanLine,
    title: "Scan the labels",
    body:  "Scan the QR or barcode on each item — or type the 5-digit serial. Items batch up instantly.",
  },
  {
    num:   "03",
    icon:  MapPin,
    title: "Set location or flag damage",
    body:  "On Check Out, pick the Studio → Stage → Set. On Check In, flag any damage inline.",
  },
  {
    num:   "04",
    icon:  CheckCircle2,
    title: "Confirm the batch",
    body:  "Hit confirm — every item is tracked in real-time. No more radio calls asking where the kit is.",
  },
];

export function CheckInOutGuideSteps() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-card border border-grey-mid overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-3.5 border-b border-grey-mid hover:bg-slate-50 transition-colors flex items-center justify-center text-left relative"
      >
        <div className="flex-1">
          <h2 className="text-[13px] font-semibold text-surface-dark">How it works</h2>
          <p className="text-[12px] text-grey mt-0.5">
            Four steps to keep every piece of kit tracked as it moves.
          </p>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-brand-blue transition-transform duration-200 flex-shrink-0 ml-4 ${
            expanded ? "rotate-180" : ""
          }`}
          strokeWidth={1.5}
        />
      </button>

      {expanded && (
        <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <div
              key={step.num}
              className="relative p-5 border-grey-mid border-b md:border-b-0 md:border-r last:border-0 md:last:border-r-0"
            >
              {/* Number + icon */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold tracking-widest text-grey uppercase">Step {step.num}</span>
                <div className="w-10 h-10 rounded-[10px] bg-brand-blue-light flex items-center justify-center flex-shrink-0">
                  <step.icon className="w-5 h-5 text-brand-blue" strokeWidth={1.75} />
                </div>
              </div>

              {/* Title + body */}
              <h3 className="text-[14px] font-semibold text-surface-dark leading-tight mb-1.5">
                {step.title}
              </h3>
              <p className="text-[12px] text-grey leading-relaxed">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
