"use client";

/**
 * Shared "where is this for?" picker, used by:
 *   - Project sets (Add/Edit Set modals)
 *   - Check In/Out → Issue flow
 *
 * Two dropdowns:
 *   1. Studio / Venue — workspace studios (recommended first)
 *   2. Stage / Area — stages under the chosen studio, plus an
 *      "─── On Location ───" separator, existing on-location venues
 *      for this project, and a footer "+ New on-location venue…"
 *      that opens NewOnLocationModal via portal.
 *
 * Value is { stageId, onLocationId }; exactly one will be set.
 *
 * Related: OnLocation is project-scoped (unique per project). Once a
 * location is created for a project, it reappears in the dropdown on
 * later sets / check-outs within that same project.
 */

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

export type VenueValue = { stageId: string; onLocationId: string };

// ── New On-Location modal (portaled) ─────────────────────────────────────

export function NewOnLocationModal(props: {
  projectId:   string;
  workspaceId: string;
  onClose:     () => void;
  onCreated:   (loc: { id: string; name: string }) => void;
}) {
  // Portal to document.body so this modal isn't nested inside any
  // parent <form>. Nested forms flatten in HTML; without the portal
  // hitting Save here would submit the outer Add/Edit Set form.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(<NewOnLocationModalBody {...props} />, document.body);
}

function NewOnLocationModalBody({
  projectId,
  workspaceId,
  onClose,
  onCreated,
}: {
  projectId:   string;
  workspaceId: string;
  onClose:     () => void;
  onCreated:   (loc: { id: string; name: string }) => void;
}) {
  const utils = trpc.useUtils();
  const [name,        setName]        = useState("");
  const [description, setDescription] = useState("");
  const [address,     setAddress]     = useState("");
  const [error,       setError]       = useState<string | null>(null);

  const create = trpc.project.onLocations.create.useMutation({
    onSuccess: (loc) => {
      void utils.project.onLocations.list.invalidate({ workspaceId, projectId });
      onCreated({ id: loc.id, name: loc.name });
      onClose();
    },
    onError: (e) => setError(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Location name is required."); return; }
    create.mutate({
      workspaceId,
      projectId,
      name:        name.trim(),
      description: description.trim() || undefined,
      address:     address.trim()     || undefined,
    });
  }

  const inputCls = "w-full border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark bg-white focus:outline-none focus:ring-1 focus:ring-brand-blue";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md bg-white rounded-panel border border-grey-mid shadow-lg">
        <div className="px-6 py-5 border-b border-grey-mid flex items-center justify-between">
          <div>
            <h2 className="text-[16px] font-bold text-surface-dark">New On-Location Venue</h2>
            <p className="text-[13px] text-slate-500 mt-0.5">Add a location outside a studio. It&apos;ll be reusable for other sets on this project.</p>
          </div>
          <button onClick={onClose} className="text-grey hover:text-surface-dark">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Location Name <span className="text-status-red">*</span>
            </label>
            <input
              type="text" autoFocus value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Trafalgar Square, Brighton Pier"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Where is it <span className="text-slate-400 font-normal normal-case">(address / city / notes)</span>
            </label>
            <input
              type="text" value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Trafalgar Square, London WC2N 5DN"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Description <span className="text-slate-400 font-normal normal-case">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Access notes, contacts, timings, etc."
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>

          {error && <p className="text-[12px] text-status-red">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={create.isPending}>
              {create.isPending ? "Saving…" : "Add Location"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Venue Picker ─────────────────────────────────────────────────────────

export function VenuePicker({
  projectId,
  workspaceId,
  projectStudioId,
  initialStudioId,
  value,
  onChange,
  stageLabel = "Stage / Area",
}: {
  projectId:        string;
  workspaceId:      string;
  projectStudioId:  string | null;
  initialStudioId?: string;
  value:            VenueValue;
  onChange:         (v: VenueValue) => void;
  stageLabel?:      string;
}) {
  const [studioId, setStudioId] = useState<string>(initialStudioId ?? "");
  const [showNewLocation, setShowNewLocation] = useState(false);

  const { data: studios } = trpc.location.studio.list.useQuery({ workspaceId });
  const { data: stages }  = trpc.location.stage.list.useQuery(
    { workspaceId, studioId },
    { enabled: !!studioId },
  );
  const { data: locations } = trpc.project.onLocations.list.useQuery(
    { workspaceId, projectId },
    { enabled: !!projectId },
  );

  const recommendedStudio = (studios ?? []).find((s) => s.id === projectStudioId);
  const otherStudios = (studios ?? [])
    .filter((s) => s.id !== projectStudioId)
    .sort((a, b) => a.name.localeCompare(b.name));

  const inputCls = "w-full border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark bg-white focus:outline-none focus:ring-1 focus:ring-brand-blue";
  const ON_LOCATION_NEW = "__ON_LOCATION_NEW__";

  const studioDropdownDisabled = !!value.onLocationId;

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          Studio / Venue
        </label>
        <select
          value={studioDropdownDisabled ? "" : studioId}
          onChange={(e) => {
            const next = e.target.value;
            setStudioId(next);
            onChange({ stageId: "", onLocationId: "" });
          }}
          disabled={studioDropdownDisabled}
          className={cn(inputCls, studioDropdownDisabled && "opacity-40 cursor-not-allowed")}
        >
          <option value="">
            {studioDropdownDisabled ? "— on location —" : "Select studio…"}
          </option>
          {recommendedStudio && (
            <>
              <option value={recommendedStudio.id}>{recommendedStudio.name}</option>
              {otherStudios.length > 0 && <option disabled value="">───────────────</option>}
            </>
          )}
          {otherStudios.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          {stageLabel}
        </label>
        <select
          value={
            value.onLocationId
              ? `loc:${value.onLocationId}`
              : value.stageId || ""
          }
          onChange={(e) => {
            const v = e.target.value;
            if (v === ON_LOCATION_NEW) {
              setShowNewLocation(true);
              return;
            }
            if (v.startsWith("loc:")) {
              onChange({ stageId: "", onLocationId: v.slice(4) });
              return;
            }
            onChange({ stageId: v, onLocationId: "" });
          }}
          className={inputCls}
        >
          <option value="">Select stage or location…</option>
          {studioId && (stages ?? []).map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
          {(((studioId && (stages ?? []).length > 0) || (locations ?? []).length > 0)) && (
            <option disabled value="">─────── On Location ───────</option>
          )}
          {(locations ?? []).map((l) => (
            <option key={l.id} value={`loc:${l.id}`}>{l.name}</option>
          ))}
          <option value={ON_LOCATION_NEW}>+ New on-location venue…</option>
        </select>
      </div>

      {showNewLocation && (
        <NewOnLocationModal
          projectId={projectId}
          workspaceId={workspaceId}
          onClose={() => setShowNewLocation(false)}
          onCreated={(loc) => onChange({ stageId: "", onLocationId: loc.id })}
        />
      )}
    </div>
  );
}
