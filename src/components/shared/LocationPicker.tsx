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
  projectId?:             string;
  projectName?:           string;
  studioId?:              string;
  stageId?:               string;
  setId?:                 string;
  positionType?:          PositionType;
  exactLocationDescription?: string;
}

// ── Project option ────────────────────────────────────────────────────────

export interface ProjectOption {
  id:       string;
  name:     string;
  studioId: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────

export interface LocationPickerProps {
  /** Active projects for the project selector */
  projects:    ProjectOption[];
  /** Available studios with nested stages and sets */
  studios:     StudioOption[];
  value:       LocationValue;
  onChange:    (value: LocationValue) => void;
  className?:  string;
}

export function LocationPicker({
  projects,
  studios,
  value,
  onChange,
  className,
}: LocationPickerProps) {
  // The project's linked studio (if any) — used to sort the studio list
  const selectedProject   = projects.find((p) => p.id === value.projectId);
  const projectStudioId   = selectedProject?.studioId ?? null;

  // Sort studios: project's studio first (with separator), rest alphabetically
  const recommendedStudio = projectStudioId ? studios.find((s) => s.id === projectStudioId) : null;
  const otherStudios      = studios
    .filter((s) => s.id !== projectStudioId)
    .sort((a, b) => a.name.localeCompare(b.name));

  const selectedStudio = studios.find((s) => s.id === value.studioId);
  const selectedStage  = selectedStudio?.stages.find((s) => s.id === value.stageId);
  const stages         = selectedStudio?.stages ?? [];
  const sets           = selectedStage?.sets ?? [];

  const showExactLocation =
    value.positionType != null &&
    (EXACT_LOCATION_REQUIRED as string[]).includes(value.positionType);

  function handleProjectChange(projectId: string) {
    const project = projects.find((p) => p.id === projectId);
    // Pre-select the project's studio, clear downstream
    onChange({
      ...value,
      projectId,
      projectName: project?.name,
      studioId:    project?.studioId ?? undefined,
      stageId:     undefined,
      setId:       undefined,
    });
  }

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
    const needsExact = (EXACT_LOCATION_REQUIRED as string[]).includes(positionType);
    onChange({
      ...value,
      positionType,
      exactLocationDescription: needsExact ? value.exactLocationDescription : undefined,
    });
  }

  return (
    <div className={cn("space-y-3.5", className)}>

      {/* Project selector */}
      <FormField label="Project">
        <select
          value={value.projectId ?? ""}
          onChange={(e) => handleProjectChange(e.target.value)}
          className={formSelectClass}
        >
          <option value="" disabled>Select project…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </FormField>

      {/* Studio / Venue — recommended project studio at top */}
      <FormField label="Studio / Venue">
        <select
          value={value.studioId ?? ""}
          onChange={(e) => handleStudioChange(e.target.value)}
          className={formSelectClass}
        >
          <option value="" disabled>Select studio…</option>
          {recommendedStudio && (
            <>
              <option value={recommendedStudio.id}>
                {recommendedStudio.name}
              </option>
              {otherStudios.length > 0 && (
                <option disabled value="">───────────────</option>
              )}
            </>
          )}
          {otherStudios.map((s) => (
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
