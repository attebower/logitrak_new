"use client";

/**
 * Projects — sidebar layout.
 *
 * Left rail:   project list (active highlighted, status pill, type icon)
 * Right panel: inline project detail (sets, equipment drawer)
 *
 * The [projectId] route still exists for direct-link compat but can be
 * retired later once we confirm sidebar routing is the pattern.
 */

import { useState } from "react";
import {
  Plus, Film, Zap, Calendar, ChevronDown, Building2,
  MapPin, Layers, Package, X, ChevronRight, FileDown, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import { cn } from "@/lib/utils";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/routers/_app";

// ── Types ─────────────────────────────────────────────────────────────────

type IndustryType  = "film_tv" | "events";
type ProjectStatus = "active" | "wrapped" | "archived";

// ── Constants ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<ProjectStatus, string> = {
  active:   "bg-status-green/10 text-status-green",
  wrapped:  "bg-slate-100 text-slate-500",
  archived: "bg-slate-100 text-slate-400",
};

const STATUS_LABELS: Record<ProjectStatus, string> = {
  active:   "Active",
  wrapped:  "Wrapped",
  archived: "Archived",
};

const STATUS_COLOURS: Record<string, string> = {
  available:    "text-status-green",
  checked_out:  "text-status-amber",
  damaged:      "text-status-red",
  under_repair: "text-status-teal",
  lost:         "text-status-purple",
  retired:      "text-grey",
};

const STATUS_EQ_LABELS: Record<string, string> = {
  available:    "Available",
  checked_out:  "Checked Out",
  damaged:      "Damaged",
  under_repair: "Under Repair",
  lost:         "Lost",
  retired:      "Retired",
};

const KNOWN_STUDIOS = [
  "Pinewood Studios",
  "Shepperton Studios",
  "Elstree Studios",
  "Warner Bros. Studios, Leavesden",
  "Sky Studios Elstree",
  "Longcross Studios",
  "Twickenham Studios",
  "Ealing Studios",
  "Arborfield Studios",
  "The Bottle Yard Studios",
  "Seren Studios",
  "Titanic Studios",
  "Universal Studios Hollywood",
  "Warner Bros. Studios, Burbank",
  "Paramount Pictures Studios",
  "Sony Pictures Studios",
  "20th Century Studios",
  "Other",
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ── New Project Modal ─────────────────────────────────────────────────────

function NewProjectModal({
  onClose,
  workspaceId,
  onCreated,
}: {
  onClose:     () => void;
  workspaceId: string;
  onCreated:   (id: string) => void;
}) {
  const utils  = trpc.useUtils();
  const create = trpc.project.create.useMutation({
    onSuccess: (project) => {
      void utils.project.list.invalidate();
      onCreated(project.id);
      onClose();
    },
  });

  const { data: existingStudios } = trpc.location.studio.list.useQuery({ workspaceId });

  const [name,          setName]          = useState("");
  const [industryType,  setIndustryType]  = useState<IndustryType>("film_tv");
  const [startDate,     setStartDate]     = useState(today());
  const [description,   setDescription]   = useState("");
  const [studioChoice,  setStudioChoice]  = useState("");
  const [customStudio,  setCustomStudio]  = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [error,         setError]         = useState<string | null>(null);

  const workspaceStudioNames = (existingStudios ?? []).map((s) => s.name);
  const mergedStudios = [
    ...workspaceStudioNames,
    ...KNOWN_STUDIOS.filter((s) => s !== "Other" && !workspaceStudioNames.includes(s)),
    "Other",
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Project name is required."); return; }
    if (industryType === "film_tv" && studioChoice === "Other" && !customStudio.trim()) {
      setError("Please enter the studio name."); return;
    }
    if (industryType === "events" && !eventLocation.trim()) {
      setError("Please enter the event location."); return;
    }

    const existingMatch = (existingStudios ?? []).find((s) => s.name === studioChoice);

    try {
      await create.mutateAsync({
        workspaceId,
        name:        name.trim(),
        industryType,
        startDate:   startDate || undefined,
        description: description.trim() || undefined,
        studioId:    industryType === "film_tv" ? existingMatch?.id : undefined,
        newStudioName: industryType === "film_tv"
          ? (!existingMatch && studioChoice && studioChoice !== "Other"
              ? studioChoice
              : studioChoice === "Other"
              ? customStudio.trim()
              : undefined)
          : undefined,
        eventLocation: industryType === "events" ? eventLocation.trim() : undefined,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  const inputCls =
    "w-full border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark bg-white focus:outline-none focus:ring-1 focus:ring-brand-blue placeholder:text-slate-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="w-full max-w-md bg-white rounded-panel border border-grey-mid shadow-lg">
        <div className="px-6 py-5 border-b border-grey-mid">
          <h2 className="text-[16px] font-bold text-surface-dark">New Project</h2>
          <p className="text-[13px] text-slate-500 mt-0.5">Set up a production or event.</p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Project Name <span className="text-status-red">*</span>
            </label>
            <input
              type="text" autoFocus value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. The Crown S7, Glastonbury 2026"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Type
            </label>
            <div className="flex gap-2">
              {(["film_tv", "events"] as IndustryType[]).map((t) => (
                <button
                  key={t} type="button"
                  onClick={() => { setIndustryType(t); setStudioChoice(""); setCustomStudio(""); setEventLocation(""); }}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 rounded-btn border text-[13px] font-medium transition-colors",
                    industryType === t
                      ? "border-brand-blue bg-brand-blue/5 text-brand-blue"
                      : "border-grey-mid text-slate-500 hover:bg-grey-light"
                  )}
                >
                  {t === "film_tv" ? <Film size={14} /> : <Zap size={14} />}
                  {t === "film_tv" ? "Film & TV" : "Events"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Start Date
            </label>
            <input
              type="date" value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputCls}
            />
          </div>

          {industryType === "film_tv" && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Studio
              </label>
              <select
                value={studioChoice}
                onChange={(e) => { setStudioChoice(e.target.value); setCustomStudio(""); }}
                className={inputCls}
              >
                <option value="">Select studio…</option>
                {mergedStudios.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {studioChoice === "Other" && (
                <input
                  type="text" value={customStudio}
                  onChange={(e) => setCustomStudio(e.target.value)}
                  placeholder="Enter studio name"
                  className={`${inputCls} mt-2`}
                />
              )}
            </div>
          )}

          {industryType === "events" && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Event Location <span className="text-status-red">*</span>
              </label>
              <input
                type="text" value={eventLocation}
                onChange={(e) => setEventLocation(e.target.value)}
                placeholder="e.g. Glastonbury Festival, ExCeL London"
                className={inputCls}
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes about this project…"
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </div>

          {error && <p className="text-[12px] text-status-red">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create Project"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Add Set Modal ─────────────────────────────────────────────────────────

function EditSetModal({
  projectId,
  workspaceId,
  projectSetId,
  initial,
  onClose,
}: {
  projectId:    string;
  workspaceId:  string;
  projectSetId: string;
  initial: {
    setName:  string;
    stageId:  string;
    studioId: string;
    notes:    string;
  };
  onClose: () => void;
}) {
  const utils = trpc.useUtils();

  const [studioId, setStudioId] = useState(initial.studioId);
  const [stageId,  setStageId]  = useState(initial.stageId);
  const [setName,  setSetName]  = useState(initial.setName);
  const [notes,    setNotes]    = useState(initial.notes);
  const [error,    setError]    = useState<string | null>(null);

  const { data: studios } = trpc.location.studio.list.useQuery({ workspaceId });
  const { data: stages }  = trpc.location.stage.list.useQuery(
    { workspaceId, studioId },
    { enabled: !!studioId }
  );

  const update = trpc.project.sets.update.useMutation({
    onSuccess: () => {
      void utils.project.sets.list.invalidate({ projectId });
      onClose();
    },
    onError: (e) => setError(e.message),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!stageId)        { setError("Please select a stage."); return; }
    if (!setName.trim()) { setError("Set name is required."); return; }
    update.mutate({
      workspaceId,
      projectSetId,
      setName: setName.trim(),
      stageId,
      notes:   notes.trim() || undefined,
    });
  }

  const inputCls = "w-full border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark bg-white focus:outline-none focus:ring-1 focus:ring-brand-blue";
  const nameChanged  = setName.trim() !== initial.setName;
  const stageChanged = stageId !== initial.stageId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="w-full max-w-md bg-white rounded-panel border border-grey-mid shadow-lg">
        <div className="px-6 py-5 border-b border-grey-mid flex items-center justify-between">
          <div>
            <h2 className="text-[16px] font-bold text-surface-dark">Edit Set</h2>
            <p className="text-[13px] text-slate-500 mt-0.5">Rename, move to a different stage, or update notes.</p>
          </div>
          <button onClick={onClose} className="text-grey hover:text-surface-dark">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Set Name <span className="text-status-red">*</span>
            </label>
            <input
              type="text" autoFocus value={setName}
              onChange={(e) => setSetName(e.target.value)}
              placeholder="e.g. Throne Room, Ext. Village, Studio B"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Studio / Venue
            </label>
            <select
              value={studioId}
              onChange={(e) => { setStudioId(e.target.value); setStageId(""); }}
              className={inputCls}
            >
              <option value="">Select studio…</option>
              {(studios ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Stage / Area <span className="text-status-red">*</span>
            </label>
            <select
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              disabled={!studioId}
              className={cn(inputCls, !studioId && "opacity-40 cursor-not-allowed")}
            >
              <option value="">Select stage…</option>
              {(stages ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Notes <span className="text-slate-400 font-normal normal-case">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Hero set, practical lighting rig"
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>

          {(nameChanged || stageChanged) && setName.trim() && stageId && (
            <p className="text-[11px] text-slate-500 bg-grey-light border border-grey-mid rounded-btn px-3 py-2">
              Renaming or moving the set will re-link this project to a different set. Other projects using the original set won&apos;t be affected.
            </p>
          )}

          {error && <p className="text-[12px] text-status-red">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddSetModal({
  projectId,
  workspaceId,
  projectStudioId,
  onClose,
}: {
  projectId:       string;
  workspaceId:     string;
  projectStudioId: string | null;
  onClose:         () => void;
}) {
  const utils = trpc.useUtils();
  const [studioId, setStudioId] = useState(projectStudioId ?? "");
  const [stageId,  setStageId]  = useState("");
  const [setName,  setSetName]  = useState("");
  const [notes,    setNotes]    = useState("");
  const [error,    setError]    = useState<string | null>(null);

  const { data: studios } = trpc.location.studio.list.useQuery({ workspaceId });
  const { data: stages }  = trpc.location.stage.list.useQuery(
    { workspaceId, studioId },
    { enabled: !!studioId }
  );

  const recommendedStudio = (studios ?? []).find((s) => s.id === projectStudioId);
  const otherStudios = (studios ?? [])
    .filter((s) => s.id !== projectStudioId)
    .sort((a, b) => a.name.localeCompare(b.name));

  const add = trpc.project.sets.add.useMutation({
    onSuccess: () => {
      void utils.project.sets.list.invalidate({ projectId });
      onClose();
    },
    onError: (e) => setError(e.message),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!stageId)        { setError("Please select a stage."); return; }
    if (!setName.trim()) { setError("Please enter a set name."); return; }
    add.mutate({ workspaceId, projectId, stageId, setName: setName.trim(), notes: notes.trim() || undefined });
  }

  const inputCls = "w-full border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark bg-white focus:outline-none focus:ring-1 focus:ring-brand-blue";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="w-full max-w-md bg-white rounded-panel border border-grey-mid shadow-lg">
        <div className="px-6 py-5 border-b border-grey-mid flex items-center justify-between">
          <div>
            <h2 className="text-[16px] font-bold text-surface-dark">Add Set to Project</h2>
            <p className="text-[13px] text-slate-500 mt-0.5">Name the set and choose which stage it&apos;s on.</p>
          </div>
          <button onClick={onClose} className="text-grey hover:text-surface-dark">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Studio / Venue
            </label>
            <select
              value={studioId}
              onChange={(e) => { setStudioId(e.target.value); setStageId(""); }}
              className={inputCls}
            >
              <option value="">Select studio…</option>
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
              Stage / Area
            </label>
            <select
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              disabled={!studioId}
              className={cn(inputCls, !studioId && "opacity-40 cursor-not-allowed")}
            >
              <option value="">Select stage…</option>
              {(stages ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Set Name <span className="text-status-red">*</span>
            </label>
            <input
              type="text" autoFocus value={setName}
              onChange={(e) => setSetName(e.target.value)}
              placeholder="e.g. Throne Room, Ext. Village, Studio B"
              disabled={!stageId}
              className={cn(inputCls, !stageId && "opacity-40 cursor-not-allowed")}
            />
            {stageId && (
              <p className="text-[11px] text-slate-400 mt-1">
                A new set will be created if this name doesn&apos;t already exist on the selected stage.
              </p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Notes <span className="text-slate-400 font-normal normal-case">(optional)</span>
            </label>
            <input
              type="text" value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Hero set, practical lighting rig"
              className={inputCls}
            />
          </div>

          {error && <p className="text-[12px] text-status-red">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={add.isPending}>
              {add.isPending ? "Adding…" : "Add Set"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Set Equipment Drawer ──────────────────────────────────────────────────

type DrawerTab = "equipment" | "photos" | "layouts" | "damage";

function SetEquipmentDrawer({
  projectId,
  projectSetId,
  setId,
  setName,
  stageName,
  workspaceId,
  onClose,
}: {
  projectId:    string;
  projectSetId: string;
  setId:        string;
  setName:      string;
  stageName:    string;
  workspaceId:  string;
  onClose:      () => void;
}) {
  const [tab, setTab] = useState<DrawerTab>("equipment");
  const [snapshotBusy, setSnapshotBusy] = useState(false);

  const utils = trpc.useUtils();

  const { data: equipment, isLoading: eqLoading } = trpc.project.sets.equipment.useQuery({
    workspaceId, projectId, setId,
  });
  const { data: photos,  isLoading: photosLoading } = trpc.project.setAttachments.listPhotos.useQuery(
    { workspaceId, projectSetId },
  );
  const { data: layouts, isLoading: layoutsLoading } = trpc.project.setAttachments.listLayouts.useQuery(
    { workspaceId, projectSetId },
  );
  const { data: damage,  isLoading: damageLoading } = trpc.project.setAttachments.damageOnSet.useQuery(
    { workspaceId, projectId, projectSetId },
  );

  // Signed URLs for rendering thumbnails
  const photoPaths   = (photos  ?? []).map((p) => p.storagePath);
  const layoutPaths  = (layouts ?? []).map((l) => l.storagePath);
  const { data: photoUrls }  = trpc.project.setAttachments.signUrls.useQuery(
    { workspaceId, bucket: "set-photos",  paths: photoPaths  },
    { enabled: photoPaths.length  > 0 },
  );
  const { data: layoutUrls } = trpc.project.setAttachments.signUrls.useQuery(
    { workspaceId, bucket: "set-layouts", paths: layoutPaths },
    { enabled: layoutPaths.length > 0 },
  );

  const deletePhoto  = trpc.project.setAttachments.deletePhoto.useMutation({
    onSuccess: async (res) => {
      await fetch("/api/sets/delete-file", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ bucket: "set-photos", storagePath: res.storagePath }),
      }).catch(() => {});
      void utils.project.setAttachments.listPhotos.invalidate({ workspaceId, projectSetId });
    },
  });
  const deleteLayout = trpc.project.setAttachments.deleteLayout.useMutation({
    onSuccess: async (res) => {
      await fetch("/api/sets/delete-file", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ bucket: "set-layouts", storagePath: res.storagePath }),
      }).catch(() => {});
      void utils.project.setAttachments.listLayouts.invalidate({ workspaceId, projectSetId });
    },
  });

  async function handleUpload(file: File, bucket: "set-photos" | "set-layouts") {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("bucket", bucket);
    fd.append("projectSetId", projectSetId);
    const res = await fetch("/api/sets/upload", { method: "POST", body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Upload failed" }));
      alert(err.error ?? "Upload failed");
      return;
    }
    if (bucket === "set-photos") {
      void utils.project.setAttachments.listPhotos.invalidate({ workspaceId, projectSetId });
    } else {
      void utils.project.setAttachments.listLayouts.invalidate({ workspaceId, projectSetId });
    }
  }

  async function handleSnapshot() {
    setSnapshotBusy(true);
    try {
      const res = await fetch(`/api/sets/snapshot?projectSetId=${encodeURIComponent(projectSetId)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Snapshot failed" }));
        alert(err.error ?? "Snapshot failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${setName} snapshot.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setSnapshotBusy(false);
    }
  }

  const TABS: { id: DrawerTab; label: string; count: number | null }[] = [
    { id: "equipment", label: "Equipment", count: equipment?.length ?? null },
    { id: "photos",    label: "Photos",    count: photos?.length    ?? null },
    { id: "layouts",   label: "Layouts",   count: layouts?.length   ?? null },
    { id: "damage",    label: "Damage",    count: damage?.length    ?? null },
  ];

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-white shadow-xl flex flex-col h-full">
        {/* Header */}
        <div className="px-5 py-4 border-b border-grey-mid flex items-start justify-between">
          <div>
            <p className="text-[11px] text-grey uppercase tracking-wider font-semibold mb-0.5">{stageName}</p>
            <h2 className="text-[16px] font-bold text-surface-dark">{setName}</h2>
          </div>
          <button onClick={onClose} className="text-grey hover:text-surface-dark mt-0.5">
            <X size={18} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="px-5 border-b border-grey-mid flex gap-0 overflow-x-auto">
          {TABS.map((t) => {
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "px-3 py-2.5 text-[12px] font-medium border-b-2 transition-colors whitespace-nowrap",
                  isActive
                    ? "border-brand-blue text-brand-blue"
                    : "border-transparent text-grey hover:text-surface-dark"
                )}
              >
                {t.label}
                {t.count !== null && (
                  <span className={cn("ml-1.5 text-[10px]", isActive ? "text-brand-blue" : "text-slate-400")}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {tab === "equipment" && (
            <EquipmentTab
              isLoading={eqLoading}
              equipment={equipment}
            />
          )}
          {tab === "photos" && (
            <PhotosTab
              isLoading={photosLoading}
              photos={photos ?? []}
              urls={photoUrls ?? {}}
              onUpload={(f) => handleUpload(f, "set-photos")}
              onDelete={(id) => deletePhoto.mutate({ workspaceId, photoId: id })}
            />
          )}
          {tab === "layouts" && (
            <LayoutsTab
              isLoading={layoutsLoading}
              layouts={layouts ?? []}
              urls={layoutUrls ?? {}}
              onUpload={(f) => handleUpload(f, "set-layouts")}
              onDelete={(id) => deleteLayout.mutate({ workspaceId, layoutId: id })}
            />
          )}
          {tab === "damage" && (
            <DamageTab isLoading={damageLoading} damage={damage ?? []} />
          )}
        </div>

        {/* Footer: Snapshot button */}
        <div className="px-5 py-3.5 border-t border-grey-mid flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-400">
            Snapshot combines all four tabs into a branded PDF.
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSnapshot}
            disabled={snapshotBusy}
          >
            <FileDown size={13} className="mr-1" />
            {snapshotBusy ? "Generating…" : "Set Snapshot PDF"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Drawer tab components ──────────────────────────────────────────────

type RouterOutputs = inferRouterOutputs<AppRouter>;
type EquipmentItem = RouterOutputs["project"]["sets"]["equipment"][number];

function EquipmentTab({
  isLoading,
  equipment,
}: {
  isLoading: boolean;
  equipment: EquipmentItem[] | undefined;
}) {
  if (isLoading) return <div className="p-6 text-[13px] text-slate-400">Loading equipment…</div>;
  if (!equipment?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
          <Package size={18} className="text-slate-400" />
        </div>
        <p className="text-[14px] font-semibold text-surface-dark mb-1">No equipment on this set</p>
        <p className="text-[12px] text-slate-400">Equipment checked out to this set will appear here.</p>
      </div>
    );
  }
  return (
    <div className="divide-y divide-grey-mid">
      {equipment.map((item) => {
        const lastEvent = item.checkEvents[0];
        return (
          <div key={item.id} className="px-5 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-surface-dark truncate">{item.name}</p>
                <p className="text-serial text-grey mt-0.5">{item.serial}</p>
                {item.category && (
                  <p className="text-[11px] text-slate-400 mt-0.5">{item.category.name}</p>
                )}
              </div>
              <span className={`text-[11px] font-semibold shrink-0 ${STATUS_COLOURS[item.status] ?? "text-grey"}`}>
                {STATUS_EQ_LABELS[item.status] ?? item.status}
              </span>
            </div>
            {lastEvent?.user && (
              <p className="text-[11px] text-slate-400 mt-1.5">
                Issued to {lastEvent.user.displayName ?? lastEvent.user.email}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

type PhotoItem = RouterOutputs["project"]["setAttachments"]["listPhotos"][number];

function PhotosTab({
  isLoading, photos, urls, onUpload, onDelete,
}: {
  isLoading: boolean;
  photos:    PhotoItem[];
  urls:      Record<string, string>;
  onUpload:  (file: File) => void;
  onDelete:  (photoId: string) => void;
}) {
  return (
    <div className="p-5">
      <UploadDropzone
        label="Add Photos"
        accept="image/jpeg,image/png,image/webp,image/heic,image/gif"
        hint="JPG, PNG, WebP, HEIC up to 15MB"
        onFile={onUpload}
      />

      {isLoading ? (
        <div className="mt-6 text-[13px] text-slate-400">Loading photos…</div>
      ) : photos.length === 0 ? (
        <p className="mt-6 text-[12px] text-slate-400 text-center">No photos yet. Drop images above to upload.</p>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3">
          {photos.map((p) => {
            const url = urls[p.storagePath];
            return (
              <div key={p.id} className="relative group bg-grey-light rounded-btn overflow-hidden border border-grey-mid aspect-square">
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={p.caption ?? p.filename} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[11px] text-slate-400">
                    Loading…
                  </div>
                )}
                <button
                  onClick={() => { if (confirm("Delete this photo?")) onDelete(p.id); }}
                  className="absolute top-1 right-1 p-1 rounded-full bg-white/90 text-slate-500 hover:text-status-red opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                  title="Delete photo"
                >
                  <X size={12} />
                </button>
                {p.caption && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent text-white text-[10px] px-2 py-1 line-clamp-1">
                    {p.caption}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type LayoutItem = RouterOutputs["project"]["setAttachments"]["listLayouts"][number];

function LayoutsTab({
  isLoading, layouts, urls, onUpload, onDelete,
}: {
  isLoading: boolean;
  layouts:   LayoutItem[];
  urls:      Record<string, string>;
  onUpload:  (file: File) => void;
  onDelete:  (layoutId: string) => void;
}) {
  return (
    <div className="p-5">
      <UploadDropzone
        label="Add Lighting Layout"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        hint="PDF or image up to 25MB"
        onFile={onUpload}
      />

      {isLoading ? (
        <div className="mt-6 text-[13px] text-slate-400">Loading layouts…</div>
      ) : layouts.length === 0 ? (
        <p className="mt-6 text-[12px] text-slate-400 text-center">No layouts yet. Upload lighting plans or plots above.</p>
      ) : (
        <div className="mt-5 space-y-3">
          {layouts.map((l) => {
            const url = urls[l.storagePath];
            const isPdf = l.mimeType === "application/pdf";
            return (
              <div key={l.id} className="border border-grey-mid rounded-btn p-3 bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-surface-dark truncate">
                      {l.title ?? l.filename}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {isPdf ? "PDF" : "Image"} · {Math.round(l.sizeBytes / 1024)} KB
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded text-slate-400 hover:text-brand-blue hover:bg-grey-light"
                        title="Open"
                      >
                        <FileDown size={13} />
                      </a>
                    )}
                    <button
                      onClick={() => { if (confirm("Delete this layout?")) onDelete(l.id); }}
                      className="p-1.5 rounded text-slate-400 hover:text-status-red hover:bg-status-red/5"
                      title="Delete"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
                {!isPdf && url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={l.title ?? l.filename} className="mt-3 w-full rounded border border-grey-mid object-contain max-h-64 bg-grey-light" />
                )}
                {l.description && (
                  <p className="text-[11px] text-slate-500 mt-2">{l.description}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type DamageItem = RouterOutputs["project"]["setAttachments"]["damageOnSet"][number];

function DamageTab({
  isLoading, damage,
}: {
  isLoading: boolean;
  damage: DamageItem[];
}) {
  if (isLoading) return <div className="p-6 text-[13px] text-slate-400">Loading damage reports…</div>;
  if (!damage.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
          <Package size={18} className="text-slate-400" />
        </div>
        <p className="text-[14px] font-semibold text-surface-dark mb-1">No damage reports</p>
        <p className="text-[12px] text-slate-400">Damage on equipment used on this set will appear here.</p>
      </div>
    );
  }
  function fmt(d: Date | string | null | undefined) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }
  return (
    <div className="divide-y divide-grey-mid">
      {damage.map((d) => {
        const repair = d.repairLogs[0];
        return (
          <div key={d.id} className={cn(
            "px-5 py-4 border-l-2",
            repair ? "border-status-teal" : "border-status-red",
          )}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-surface-dark">{d.equipment.name}</p>
                <p className="text-[11px] text-slate-400">{d.equipment.serial}</p>
              </div>
              <span className="text-[11px] text-slate-400 shrink-0">{fmt(d.reportedAt)}</span>
            </div>
            <p className="text-[12px] text-surface-dark mt-2">{d.description}</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Reported by {d.reporter?.displayName ?? d.reporter?.email ?? "Unknown"}
            </p>
            {repair && (
              <div className="mt-3 pt-3 pl-3 border-l-2 border-status-teal">
                <p className="text-[11px] font-semibold text-status-teal">
                  Repaired · {fmt(repair.repairedAt)}
                </p>
                {repair.description && (
                  <p className="text-[12px] text-surface-dark mt-1">{repair.description}</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function UploadDropzone({
  label, accept, hint, onFile,
}: {
  label:  string;
  accept: string;
  hint:   string;
  onFile: (file: File) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || !files[0]) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        await onFile(f);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <label
      className={cn(
        "block border-2 border-dashed rounded-btn px-4 py-5 text-center transition-colors cursor-pointer",
        dragOver ? "border-brand-blue bg-brand-blue/5" : "border-grey-mid hover:border-brand-blue/40 hover:bg-grey-light",
      )}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setDragOver(false);
        void handleFiles(e.dataTransfer.files);
      }}
    >
      <input
        type="file"
        accept={accept}
        multiple
        className="hidden"
        disabled={busy}
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <div className="flex flex-col items-center gap-1">
        <Plus size={16} className="text-brand-blue" />
        <p className="text-[13px] font-semibold text-surface-dark">
          {busy ? "Uploading…" : label}
        </p>
        <p className="text-[11px] text-slate-400">{hint}</p>
      </div>
    </label>
  );
}

// ── Metadata field (header card) ────────────────────────────────

function MetaField({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?:  React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="flex items-center gap-1.5 text-[13px] text-surface-dark">
        {icon && <span className="text-slate-400">{icon}</span>}
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}

// ── Project Detail Panel ─────────────────────────────────────────────────

function ProjectDetail({
  projectId,
  workspaceId,
  userRole,
}: {
  projectId:   string;
  workspaceId: string;
  userRole:    string;
}) {
  const isManager = ["owner", "admin", "manager"].includes(userRole);
  const utils     = trpc.useUtils();

  const [showAddSet,      setShowAddSet]      = useState(false);
  const [activeSetDrawer, setActiveSetDrawer] = useState<{
    projectSetId: string;
    setId:        string;
    setName:      string;
    stageName:    string;
  } | null>(null);
  const [editingSet, setEditingSet] = useState<{
    projectSetId: string;
    setName:      string;
    stageId:      string;
    studioId:     string;
    notes:        string;
  } | null>(null);

  const { data: projects } = trpc.project.list.useQuery({ workspaceId });
  const project = projects?.find((p) => p.id === projectId);

  const { data: projectSets, isLoading: setsLoading } = trpc.project.sets.list.useQuery(
    { workspaceId, projectId },
    { enabled: !!projectId }
  );

  const removeSet = trpc.project.sets.remove.useMutation({
    onSuccess: () => void utils.project.sets.list.invalidate({ projectId }),
  });

  const updateStatus = trpc.project.updateStatus.useMutation({
    onSuccess: () => void utils.project.list.invalidate(),
  });
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  if (!project) {
    return <div className="p-8 text-[13px] text-slate-400">Loading…</div>;
  }

  const type = project.industryType as "film_tv" | "events";

  function fmtDate(d: Date | string | null | undefined) {
    if (!d) return null;
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  const projStatus = project.status as ProjectStatus;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* ── Header card ── */}
      <section className="bg-white rounded-panel border border-grey-mid p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0 mt-0.5">
              {type === "film_tv"
                ? <Film size={18} className="text-brand-blue" />
                : <Zap  size={18} className="text-brand-blue" />}
            </div>
            <div className="min-w-0">
              <h1 className="text-[20px] font-bold text-surface-dark leading-tight truncate">{project.name}</h1>
              <p className="text-[12px] text-slate-500 mt-1">
                {type === "film_tv" ? "Film & TV production" : "Event"}
              </p>
            </div>
          </div>
          <div className="relative shrink-0">
            <button
              onClick={() => setShowStatusMenu((v) => !v)}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold",
                STATUS_STYLES[projStatus]
              )}
            >
              {STATUS_LABELS[projStatus]}
              <ChevronDown size={11} />
            </button>
            {showStatusMenu && (
              <div className="absolute right-0 top-8 z-10 bg-white border border-grey-mid rounded-panel shadow-md py-1 w-32">
                {(["active", "wrapped", "archived"] as ProjectStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      updateStatus.mutate({ workspaceId, projectId, status: s });
                      setShowStatusMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-[12px] text-surface-dark hover:bg-grey-light"
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Metadata grid */}
        <div className="mt-5 pt-5 border-t border-grey-mid grid grid-cols-2 md:grid-cols-4 gap-4">
          {project.studio && (
            <MetaField
              label="Studio"
              value={project.studio.name}
              icon={<Building2 size={11} />}
            />
          )}
          {project.eventLocation && (
            <MetaField
              label="Location"
              value={project.eventLocation}
              icon={<Building2 size={11} />}
            />
          )}
          <MetaField
            label="Start Date"
            value={fmtDate(project.startDate) ?? "—"}
            icon={<Calendar size={11} />}
          />
          <MetaField
            label="Status"
            value={STATUS_LABELS[projStatus]}
          />
        </div>

        {project.description && (
          <div className="mt-5 pt-5 border-t border-grey-mid">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Description
            </p>
            <p className="text-[13px] text-surface-dark">{project.description}</p>
          </div>
        )}
      </section>

      {/* ── Sets card ── */}
      <section className="bg-white rounded-panel border border-grey-mid">
        <div className="px-5 py-4 border-b border-grey-mid flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-semibold text-surface-dark flex items-center gap-2">
              <Layers size={14} className="text-brand-blue" />
              Sets
            </h2>
            <p className="text-[12px] text-slate-400 mt-0.5">
              Sets assigned to this project. Click a set to see equipment on it.
            </p>
          </div>
          {isManager && (
            <Button variant="secondary" size="sm" onClick={() => setShowAddSet(true)}>
              <Plus size={12} className="mr-1" />
              Add Set
            </Button>
          )}
        </div>

        {setsLoading ? (
          <div className="px-5 py-6 text-[13px] text-slate-400">Loading sets…</div>
        ) : !projectSets?.length ? (
          <div className="px-5 py-10 text-center">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <MapPin size={18} className="text-slate-400" />
            </div>
            <p className="text-[14px] font-semibold text-surface-dark mb-1">No sets added yet</p>
            <p className="text-[12px] text-slate-400 mb-4">
              Add the sets this production is using to track equipment by location.
            </p>
            {isManager && (
              <Button variant="secondary" size="sm" onClick={() => setShowAddSet(true)}>
                <Plus size={12} className="mr-1" />
                Add First Set
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-grey-mid">
            {projectSets.map((ps) => (
              <div
                key={ps.id}
                className="px-5 py-3.5 flex items-center gap-4 group hover:bg-grey-light/60 transition-colors cursor-pointer"
                onClick={() => setActiveSetDrawer({
                  projectSetId: ps.id,
                  setId:        ps.set.id,
                  setName:      ps.set.name,
                  stageName:    ps.stage.name,
                })}
              >
                <div className="w-8 h-8 rounded-lg bg-brand-blue/8 flex items-center justify-center shrink-0">
                  <MapPin size={14} className="text-brand-blue" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-surface-dark">{ps.set.name}</p>
                  <p className="text-[12px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <Building2 size={10} />
                    {ps.stage.studio.name} — {ps.stage.name}
                  </p>
                  {ps.notes && (
                    <p className="text-[11px] text-slate-400 mt-0.5">{ps.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-slate-400 group-hover:text-brand-blue transition-colors hidden sm:block">
                    View equipment
                  </span>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-brand-blue transition-colors" />
                  {isManager && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingSet({
                            projectSetId: ps.id,
                            setName:      ps.set.name,
                            stageId:      ps.stage.id,
                            studioId:     ps.stage.studio.id,
                            notes:        ps.notes ?? "",
                          });
                        }}
                        className="p-1 rounded text-slate-300 hover:text-brand-blue hover:bg-brand-blue/5 transition-colors"
                        title="Edit set"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Remove "${ps.set.name}" from this project?`)) {
                            removeSet.mutate({ workspaceId, projectSetId: ps.id });
                          }
                        }}
                        className="p-1 rounded text-slate-300 hover:text-status-red hover:bg-status-red/5 transition-colors"
                        title="Remove set from project"
                      >
                        <X size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showAddSet && (
        <AddSetModal
          projectId={projectId}
          workspaceId={workspaceId}
          projectStudioId={project.studio?.id ?? null}
          onClose={() => setShowAddSet(false)}
        />
      )}

      {editingSet && (
        <EditSetModal
          projectId={projectId}
          workspaceId={workspaceId}
          projectSetId={editingSet.projectSetId}
          initial={{
            setName:  editingSet.setName,
            stageId:  editingSet.stageId,
            studioId: editingSet.studioId,
            notes:    editingSet.notes,
          }}
          onClose={() => setEditingSet(null)}
        />
      )}

      {activeSetDrawer && (
        <SetEquipmentDrawer
          projectId={projectId}
          projectSetId={activeSetDrawer.projectSetId}
          setId={activeSetDrawer.setId}
          setName={activeSetDrawer.setName}
          stageName={activeSetDrawer.stageName}
          workspaceId={workspaceId}
          onClose={() => setActiveSetDrawer(null)}
        />
      )}
    </div>
  );
}

// ── Empty state (no project selected) ────────────────────────────────────

function NoProjectSelected({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
      <div className="w-12 h-12 rounded-full bg-brand-blue/10 flex items-center justify-center mb-4">
        <Film size={22} className="text-brand-blue" />
      </div>
      <p className="text-[15px] font-semibold text-surface-dark mb-1">Select a project</p>
      <p className="text-[13px] text-slate-400 mb-5">
        Choose a project from the list, or create a new one.
      </p>
      <Button variant="primary" onClick={onNew}>
        <Plus size={14} className="mr-1.5" />
        New Project
      </Button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { workspaceId, userRole } = useWorkspace();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showModal,  setShowModal]  = useState(false);

  const { data: projects, isLoading } = trpc.project.list.useQuery(
    { workspaceId: workspaceId! },
    { enabled: !!workspaceId }
  );

  const utils = trpc.useUtils();
  const updateListStatus = trpc.project.updateStatus.useMutation({
    onSuccess: () => void utils.project.list.invalidate(),
  });
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null);

  function fmtListDate(d: Date | null) {
    if (!d) return null;
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  return (
    <>
      <AppTopbar
        title="Projects"
        actions={
          <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>
            <Plus size={14} className="mr-1.5" />
            New Project
          </Button>
        }
      />

      <div className="flex-1 overflow-hidden flex">
        {/* Sub-sidebar — project list */}
        <aside className="w-[260px] shrink-0 bg-white border-r border-grey-mid overflow-y-auto flex flex-col">
          <div className="py-4 px-3 flex-1">
            {isLoading ? (
              <div className="space-y-2 px-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-14 bg-grey-light rounded-btn animate-pulse" />
                ))}
              </div>
            ) : !projects?.length ? (
              <div className="px-2 py-6 text-center">
                <p className="text-[12px] text-slate-400 mb-3">No projects yet</p>
                <Button variant="secondary" size="sm" onClick={() => setShowModal(true)}>
                  <Plus size={12} className="mr-1" />
                  New Project
                </Button>
              </div>
            ) : (
              <ul className="space-y-0.5">
                {projects.map((p) => {
                  const isActive = selectedId === p.id;
                  const status   = p.status as ProjectStatus;
                  const type     = p.industryType as IndustryType;
                  return (
                    <li key={p.id}>
                      <button
                        onClick={() => setSelectedId(p.id)}
                        className={cn(
                          "w-full text-left px-2 py-2.5 rounded-btn transition-colors group",
                          isActive ? "bg-brand-blue/10" : "hover:bg-grey-light"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <span className={cn("mt-0.5 shrink-0", isActive ? "text-brand-blue" : "text-slate-400")}>
                            {type === "film_tv" ? <Film size={13} /> : <Zap size={13} />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className={cn(
                              "text-[13px] font-medium truncate leading-snug",
                              isActive ? "text-brand-blue" : "text-surface-dark"
                            )}>
                              {p.name}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={cn(
                                "inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold",
                                STATUS_STYLES[status]
                              )}>
                                {STATUS_LABELS[status]}
                              </span>
                              {p.startDate && (
                                <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                                  <Calendar size={9} />
                                  {fmtListDate(p.startDate)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setStatusMenuId(statusMenuId === p.id ? null : p.id)}
                              className="p-1 rounded text-slate-300 hover:text-slate-500 hover:bg-grey-light"
                              title="Change status"
                            >
                              <ChevronDown size={11} />
                            </button>
                            {statusMenuId === p.id && (
                              <div className="absolute right-0 top-6 z-20 bg-white border border-grey-mid rounded-panel shadow-md py-1 w-28">
                                {(["active", "wrapped", "archived"] as ProjectStatus[]).map((s) => (
                                  <button
                                    key={s}
                                    onClick={() => {
                                      updateListStatus.mutate({ workspaceId: workspaceId!, projectId: p.id, status: s });
                                      setStatusMenuId(null);
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-[12px] text-surface-dark hover:bg-grey-light"
                                  >
                                    {STATUS_LABELS[s]}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Content — detail or empty state */}
        {selectedId && workspaceId ? (
          <ProjectDetail
            key={selectedId}
            projectId={selectedId}
            workspaceId={workspaceId}
            userRole={userRole}
          />
        ) : (
          <NoProjectSelected onNew={() => setShowModal(true)} />
        )}
      </div>

      {showModal && workspaceId && (
        <NewProjectModal
          workspaceId={workspaceId}
          onClose={() => setShowModal(false)}
          onCreated={(id) => setSelectedId(id)}
        />
      )}
    </>
  );
}
