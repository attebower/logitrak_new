/**
 * Preview route for the "How it works" guide that will live on the Add
 * Equipment page. Public (no auth) so the team can review the design.
 */

import { EquipmentGuideSteps } from "@/components/shared/EquipmentGuideSteps";

export default function PreviewEquipmentGuidePage() {
  return (
    <div className="min-h-screen bg-grey-light py-12 px-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <p className="text-[11px] font-semibold text-brand-blue uppercase tracking-wider mb-1">Preview</p>
          <h1 className="text-[22px] font-bold text-surface-dark">Add Equipment — How It Works</h1>
          <p className="text-[13px] text-grey mt-1">
            This is the 4-step guide that will sit on the <span className="font-mono text-[12px] bg-grey-mid/40 px-1.5 py-0.5 rounded">/equipment/new</span> page.
          </p>
        </div>

        <EquipmentGuideSteps />

        <div className="bg-white rounded-card border border-grey-mid px-5 py-4 text-[12px] text-grey">
          <strong className="text-surface-dark">Notes:</strong>
          <ul className="mt-2 space-y-1 list-disc list-inside">
            <li>Collapses to 2×2 on medium screens, 1×4 on desktop, stacks vertically on mobile.</li>
            <li>Connector arrows between cards only show on the large-screen layout.</li>
            <li>Icons are Lucide at 20px inside a 40px brand-blue-light rounded square.</li>
            <li>Copy + icons are easy to swap — tell me what to change.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
