/**
 * Preview route for the Check In / Check Out "How it works" guide.
 * Public (no auth) so it can be reviewed without a login.
 */

import { CheckInOutGuideSteps } from "@/components/shared/CheckInOutGuideSteps";

export default function PreviewCheckInOutGuidePage() {
  return (
    <div className="min-h-screen bg-grey-light py-12 px-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <p className="text-[11px] font-semibold text-brand-blue uppercase tracking-wider mb-1">Preview</p>
          <h1 className="text-[22px] font-bold text-surface-dark">Check In / Check Out — How It Works</h1>
          <p className="text-[13px] text-grey mt-1">
            This is the 4-step guide that will sit on the <span className="font-mono text-[12px] bg-grey-mid/40 px-1.5 py-0.5 rounded">/checkinout</span> page.
          </p>
        </div>

        <CheckInOutGuideSteps />

        <div className="bg-white rounded-card border border-grey-mid px-5 py-4 text-[12px] text-grey">
          <strong className="text-surface-dark">Notes:</strong>
          <ul className="mt-2 space-y-1 list-disc list-inside">
            <li>Same layout + visual style as the Add Equipment guide — consistent chrome across pages.</li>
            <li>Collapses 1×4 → 2×2 → stacked as the viewport narrows.</li>
            <li>Copy + icons are easy to swap — tell me what to change.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
