/**
 * LogiTrak LocationPicker Component
 * Cascading location selector for Check In/Out — Screen 02.
 *
 * Field order (matches spec):
 *   Production (read-only, from workspace context)
 *   Studio / Venue → Stage / Area → Set / Zone
 *   Position Type (4 values from prototype — confirmed by Matt)
 *   Exact Location Description (conditional: shows only for Inside Prop Make / In Prop Dressing)
 *
 * Position Types (from PROTOTYPE_FINDINGS.md — DO NOT use spec values):
 *   - Inside Prop Make
 *   - In Prop Dressing
 *   - On Set
 *   - Rigged to Outside of Set
 *
 * Usage:
 *   <LocationPicker
 *     production="Series 4 — Episode 7"
 *     studios={[{ id: "1", name: "Pinewood — Stage 7", stages: [...] }]}
 *     value={locationValue}
 *     onChange={setLocationValue}
 *   />
 */

"use client";

// useState / useEffect reserved for Sprint 2 cascading tRPC fetch
import { cn } from "@/lib/utils";

// ── Position types (confirmed from prototype — do not change without checking PROTOTYPE_FINDINGS.md)
export const POSITION_TYPES = [
  "Inside Prop Make",
  "In Prop Dressing",
  "On Set",
  "Rigged to Outside of Set",
] as const;

export type PositionType = (typeof POSITION_TYPES)[number];

/** Position types that require an exact location description */
const EXACT_LOCATION_REQUIRED: PositionType[] = [
  "Inside Prop Make",
  "In Prop Dressing",
];

// ── Data shapes (passed in from tRPC queries) ─────────────────────────────

export interface SetOption {
  id:   string;
  name: string;
}

export interface StageOption {
  id:   string;
  name: string;
  sets: SetOption[];
}

export interface StudioOption {
  id:     string;
  name:   string;
  stages: StageOption[];
}

// ── Value shape ───────────────────────────────────────────────────────────

export interface LocationValue {
  studioId?:              string;
  stageId?:               string;
  setId?:                 string;
  positionType?:          PositionType;
  exactLocationDescription?: string;
}

// ── Component ─────────────────────────────────────────────────────────────

export interface LocationPickerProps {
  /** Current production/series — display-only */
  production:  string;
  /** Available studios with nested stages and sets */
  studios:     StudioOption[];
  value:       LocationValue;
  onChange:    (value: LocationValue) => void;
  className?:  string;
}

export function LocationPicker({
  production,
  studios,
  value,
  onChange,
  className,
}: LocationPickerProps) {
  // Derive cascading options from current selections
  const selectedStudio = studios.find((s) => s.id === value.studioId);
  const selectedStage  = selectedStudio?.stages.find((s) => s.id === value.stageId);
  const stages         = selectedStudio?.stages ?? [];
  const sets           = selectedStage?.sets ?? [];

  // Show exact location description only for the two position types that need it
  const showExactLocation =
    value.positionType != null &&
    (EXACT_LOCATION_REQUIRED as string[]).includes(value.positionType);

  // Reset downstream selections when parent changes
  function handleStudioChange(studioId: string) {
    onChange({ ...value, studioId, stageId: undefined, setId: undefined });
  }

  function handleStageChange(stageId: string) {
    onChange({ ...value, stageId, setId: undefined });
  }

  function handleSetChange(setId: string) {
    onChange({ ...value, setId });
  }

  function handlePositionTypeChange(positionType: PositionType) {
    // Clear exact description when switching to a type that doesn't need it
    const needsExact = (EXACT_LOCATION_REQUIRED as string[]).includes(positionType);
    onChange({
      ...value,
      positionType,
      exactLocationDescription: needsExact ? value.exactLocationDescription : undefined,
    });
  }

  return (
    <div className={cn("space-y-3.5", className)}>
      {/* Production (read-only) */}
      <FormField label="Production">
        <input
          type="text"
          value={production}
          readOnly
          className={formInputClass + " opacity-60 cursor-default"}
        />
      </FormField>

      {/* Studio / Venue */}
      <FormField label="Studio / Venue">
        <select
          value={value.studioId ?? ""}
          onChange={(e) => handleStudioChange(e.target.value)}
          className={formSelectClass}
        >
          <option value="" disabled>Select studio…</option>
          {studios.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </FormField>

      {/* Stage / Area */}
      <FormField label="Stage / Area">
        <select
          value={value.stageId ?? ""}
          onChange={(e) => handleStageChange(e.target.value)}
          disabled={!value.studioId}
          className={cn(formSelectClass, !value.studioId && "opacity-40 cursor-not-allowed")}
        >
          <option value="" disabled>Select stage…</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </FormField>

      {/* Set / Zone */}
      <FormField label="Set / Zone">
        <select
          value={value.setId ?? ""}
          onChange={(e) => handleSetChange(e.target.value)}
          disabled={!value.stageId}
          className={cn(formSelectClass, !value.stageId && "opacity-40 cursor-not-allowed")}
        >
          <option value="" disabled>Select set…</option>
          {sets.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </FormField>

      {/* Position Type */}
      <FormField label="Position Type">
        <select
          value={value.positionType ?? ""}
          onChange={(e) => handlePositionTypeChange(e.target.value as PositionType)}
          className={formSelectClass}
        >
          <option value="" disabled>Select position…</option>
          {POSITION_TYPES.map((pt) => (
            <option key={pt} value={pt}>{pt}</option>
          ))}
        </select>
      </FormField>

      {/* Exact Location Description — conditional */}
      {showExactLocation && (
        <FormField label="Exact Description">
          <input
            type="text"
            value={value.exactLocationDescription ?? ""}
            onChange={(e) =>
              onChange({ ...value, exactLocationDescription: e.target.value })
            }
            placeholder="e.g. Grid rigged above throne, position 4"
            className={formInputClass}
          />
        </FormField>
      )}
    </div>
  );
}

// ── Form helpers ──────────────────────────────────────────────────────────

const formInputClass =
  "w-full bg-grey-light border-[1.5px] border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue";

const formSelectClass =
  "w-full bg-grey-light border-[1.5px] border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue";

function FormField({
  label,
  children,
}: {
  label:    string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-caption text-grey uppercase mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
