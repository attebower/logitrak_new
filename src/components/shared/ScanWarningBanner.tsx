/**
 * LogiTrak ScanWarningBanner / ScanWarningList Components
 *
 * Dismissible inline alert banners for QR scan validation results.
 * Shown below ScanArea on the Check In/Out page when a scan is rejected
 * or flagged. Up to 3 warnings are shown at once; oldest are pushed out.
 *
 * Warning kinds:
 *   duplicate    — serial already in the current batch (grey)
 *   damaged      — item is flagged as damaged — blocked from check-out (red)
 *   wrong-state  — item can't be transitioned in current state (amber)
 *   unknown      — serial not found in this workspace (grey)
 *
 * Usage (single):
 *   <ScanWarningBanner
 *     warning={{ serial: "AT-002", kind: "damaged", message: "AT-002 is flagged as damaged." }}
 *     onDismiss={() => removeWarning("AT-002")}
 *   />
 *
 * Usage (list — preferred):
 *   <ScanWarningList warnings={warnings} onDismiss={(serial) => removeWarning(serial)} />
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type ScanWarningKind = "duplicate" | "damaged" | "wrong-state" | "unknown";

export interface ScanWarning {
  /** The serial number that triggered this warning */
  serial:  string;
  kind:    ScanWarningKind;
  /** Human-readable message to display */
  message: string;
  /** Optional secondary detail/description rendered below the message */
  detail?: string;
  /** Optional action button (e.g. link to damage report) */
  action?: {
    label: string;
    href:  string;
  };
}

// ── Styles ─────────────────────────────────────────────────────────────────

const variantStyles: Record<ScanWarningKind, string> = {
  duplicate:     "bg-grey-light border-grey-mid text-grey",
  damaged:       "bg-status-red-light border-status-red/20 text-status-red",
  "wrong-state": "bg-status-amber-light border-status-amber/20 text-status-amber",
  unknown:       "bg-grey-light border-grey-mid text-grey",
};

const warningIcons: Record<ScanWarningKind, string> = {
  duplicate:     "⊘",
  damaged:       "⚠",
  "wrong-state": "⚠",
  unknown:       "?",
};

// ── ScanWarningBanner ──────────────────────────────────────────────────────

export interface ScanWarningBannerProps {
  warning:   ScanWarning;
  onDismiss: () => void;
}

export function ScanWarningBanner({ warning, onDismiss }: ScanWarningBannerProps) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 px-4 py-2.5 rounded-card border text-[12px] font-medium ${variantStyles[warning.kind]}`}
    >
      <span className="text-[14px] shrink-0 leading-none mt-0.5" aria-hidden="true">
        {warningIcons[warning.kind]}
      </span>
      <div className="flex-1 min-w-0">
        <div>{warning.message}</div>
        {warning.detail && (
          <div className="text-[11px] font-normal opacity-80 mt-0.5">{warning.detail}</div>
        )}
        {warning.action && (
          <a
            href={warning.action.href}
            className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-semibold underline underline-offset-2 hover:opacity-80"
          >
            {warning.action.label} →
          </a>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="text-inherit opacity-60 hover:opacity-100 text-base leading-none shrink-0"
        aria-label={`Dismiss warning for ${warning.serial}`}
      >
        ×
      </button>
    </div>
  );
}

// ── ScanWarningList ────────────────────────────────────────────────────────

export interface ScanWarningListProps {
  warnings:  ScanWarning[];
  /** Called with the serial number of the dismissed warning */
  onDismiss: (serial: string) => void;
}

/**
 * Renders a live-region list of ScanWarningBanners.
 * Returns null when warnings is empty — safe to render unconditionally.
 */
export function ScanWarningList({ warnings, onDismiss }: ScanWarningListProps) {
  if (warnings.length === 0) return null;
  return (
    <div className="space-y-2" role="log" aria-live="polite" aria-label="Scan warnings">
      {warnings.map((w) => (
        <ScanWarningBanner
          key={w.serial}
          warning={w}
          onDismiss={() => onDismiss(w.serial)}
        />
      ))}
    </div>
  );
}
