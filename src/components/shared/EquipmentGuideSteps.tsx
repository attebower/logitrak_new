/**
 * EquipmentGuideSteps — 4-step visual onboarding panel shown on the Add
 * Equipment page. Explains the physical→digital workflow at a glance.
 */

import { Printer, Package, BookOpen, ScanLine } from "lucide-react";
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
    icon:  Printer,
    title: "Print your labels",
    body:  "Generate a batch of QR or barcode labels from Equipment → Labels. Pick your design and printer, hit print.",
  },
  {
    num:   "02",
    icon:  Package,
    title: "Stick them on",
    body:  "Apply each label to a piece of kit. Every label has a unique 5-digit serial — that's its permanent ID.",
  },
  {
    num:   "03",
    icon:  BookOpen,
    title: "Pick or create a product",
    body:  "Choose the product from your catalog, or create a new one with name, category, and description.",
  },
  {
    num:   "04",
    icon:  ScanLine,
    title: "Scan them in",
    body:  "Scan each labelled item — or bulk-assign a range of serials. Confirm and the kit is registered.",
  },
];

export function EquipmentGuideSteps() {
  return (
    <div className="bg-white rounded-card border border-grey-mid overflow-hidden">
      <div className="px-5 py-3.5 border-b border-grey-mid">
        <h2 className="text-[13px] font-semibold text-surface-dark">How it works</h2>
        <p className="text-[12px] text-grey mt-0.5">
          Four steps from physical kit to live-tracked equipment.
        </p>
      </div>

      <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <div
            key={step.num}
            className="relative p-5 border-grey-mid border-b md:border-b-0 md:border-r last:border-0 md:last:border-r-0"
          >
            {/* Connector arrow (between cards on lg+) */}
            {i < STEPS.length - 1 && (
              <div
                className="hidden lg:flex absolute top-1/2 -right-3 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-white border border-grey-mid items-center justify-center"
                aria-hidden
              >
                <svg viewBox="0 0 12 12" className="w-3 h-3 text-grey" fill="currentColor">
                  <path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}

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
    </div>
  );
}
