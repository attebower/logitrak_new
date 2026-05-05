/**
 * LogiTrak LocationPicker Component
 * Cascading location selector for Check In/Out — Screen 02.
 *
 * Field order:
 *   Project
 *   Studio / Venue  ─┐ combined via VenuePicker
 *   Stage or Location ─┘ (includes "On Location" section)
 *   Set / Zone
 *   Position Type
 *   Exact Location Description (conditional)
 *
 * On-location support:
 *   - The stage dropdown has an "On Location" section listing existing
 *     project-scoped locations + a "+ New on-location venue…" option.
 *   - When on-location is selected, sets list queries by onLocationId.
 */

"use client";

import { useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import { VenuePicker, type VenueValue } from "@/components/shared/VenuePicker";
import { useWorkspace } from "@/lib/workspace-context";

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

// ── Data shapes ───────────────────────────────────────────────────────────

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
  projectId?:                string;
  projectName?:              string;
  studioId?:                 string;
  stageId?:                  string;
  onLocationId?:             string;
  setId?:                    string;
  positionType?:             PositionType;
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
  projects:    ProjectOption[];
  /** Unused now that VenuePicker fetches its own data; kept for prop compat. */
  studios?:    StudioOption[];
  value:       LocationValue;
  onChange:    (value: LocationValue) => void;
  className?:  string;
}

export function LocationPicker({
  projects,
  value,
  onChange,
  className,
}: LocationPickerProps) {
  const { workspaceId } = useWorkspace();

  const selectedProject = projects.find((p) => p.id === value.projectId);
  const projectStudioId = selectedProject?.studioId ?? null;

  // Sets under the chosen stage or onLocation
  const { data: setsByStage } = trpc.location.set.list.useQuery(
    { workspaceId: workspaceId!, stageId: value.stageId! },
    { enabled: !!workspaceId && !!value.stageId },
  );
  const { data: setsByLoc } = trpc.location.set.list.useQuery(
    { workspaceId: workspaceId!, onLocationId: value.onLocationId! },
    { enabled: !!workspaceId && !!value.onLocationId },
  );
  const sets = useMemo(() => {
    if (value.stageId)      return setsByStage ?? [];
    if (value.onLocationId) return setsByLoc   ?? [];
    return [];
  }, [value.stageId, value.onLocationId, setsByStage, setsByLoc]);

  // When the chosen set is no longer in the options (e.g. stage changed),
  // clear it so the user reselects.
  useEffect(() => {
    if (value.setId && !sets.find((s) => s.id === value.setId)) {
      onChange({ ...value, setId: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets, value.setId]);

  const showExactLocation =
    value.positionType != null &&
    (EXACT_LOCATION_REQUIRED as string[]).includes(value.positionType);

  function handleProjectChange(projectId: string) {
    const project = projects.find((p) => p.id === projectId);
    onChange({
      ...value,
      projectId,
      projectName:  project?.name,
      // Pre-select studio, clear everything downstream
      studioId:     project?.studioId ?? undefined,
      stageId:      undefined,
      onLocationId: undefined,
      setId:        undefined,
    });
  }

  function handleVenueChange(v: VenueValue) {
    onChange({
      ...value,
      stageId:      v.stageId      || undefined,
      onLocationId: v.onLocationId || undefined,
      setId:        undefined,
    });
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

      {/* Studio / Venue + Stage / Location (shared VenuePicker) */}
      {value.projectId && workspaceId && (
        <VenuePicker
          projectId={value.projectId}
          workspaceId={workspaceId}
          projectStudioId={projectStudioId}
          initialStudioId={value.studioId ?? projectStudioId ?? ""}
          value={{ stageId: value.stageId ?? "", onLocationId: value.onLocationId ?? "" }}
          onChange={handleVenueChange}
        />
      )}

      {/* Set / Zone */}
      <FormField label="Set / Zone">
        <select
          value={value.setId ?? ""}
          onChange={(e) => handleSetChange(e.target.value)}
          disabled={!value.stageId && !value.onLocationId}
          className={cn(formSelectClass, !(value.stageId || value.onLocationId) && "opacity-40 cursor-not-allowed")}
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

      {/* Exact Location Description */}
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
