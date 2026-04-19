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
  Plus, Film, Zap, Building2,
  MapPin, Layers, Package, X, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import { cn } from "@/lib/utils";

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

function SetEquipmentDrawer({
  projectId,
  setId,
  setName,
  stageName,
  workspaceId,
  onClose,
}: {
  projectId:   string;
  setId:       string;
  setName:     string;
  stageName:   string;
  workspaceId: string;
  onClose:     () => void;
}) {
  const { data: equipment, isLoading } = trpc.project.sets.equipment.useQuery({
    workspaceId,
    projectId,
    setId,
  });

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-white shadow-xl flex flex-col h-full">
        <div className="px-5 py-4 border-b border-grey-mid flex items-start justify-between">
          <div>
            <p className="text-[11px] text-grey uppercase tracking-wider font-semibold mb-0.5">{stageName}</p>
            <h2 className="text-[16px] font-bold text-surface-dark">{setName}</h2>
          </div>
          <button onClick={onClose} className="text-grey hover:text-surface-dark mt-0.5">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-6 text-[13px] text-slate-400">Loading equipment…</div>
          ) : !equipment?.length ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <Package size={18} className="text-slate-400" />
              </div>
              <p className="text-[14px] font-semibold text-surface-dark mb-1">No equipment on this set</p>
              <p className="text-[12px] text-slate-400">Equipment checked out to this set will appear here.</p>
            </div>
          ) : (
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
          )}
        </div>

        <div className="px-5 py-4 border-t border-grey-mid">
          <p className="text-[12px] text-slate-400">
            {equipment?.length ?? 0} item{(equipment?.length ?? 0) !== 1 ? "s" : ""} currently on this set
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Project Detail Panel ──────────────────────────────────────────────────

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
    setId:     string;
    setName:   string;
    stageName: string;
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
    <div className="flex-1 overflow-y-auto p-6">
      {/* Project header — compact single row, then metadata + description */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4 mb-2">
          <h1 className="text-[18px] font-semibold text-surface-dark leading-tight">{project.name}</h1>
          <div className="relative">
            <button
              onClick={() => setShowStatusMenu((v) => !v)}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold",
                STATUS_STYLES[projStatus]
              )}
            >
              {STATUS_LABELS[projStatus]}
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
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-slate-500">
          <span className="flex items-center gap-1.5">
            {type === "film_tv" ? <Film size={11} /> : <Zap size={11} />}
            {type === "film_tv" ? "Film & TV" : "Events"}
          </span>
          {project.studio && (
            <span className="flex items-center gap-1.5">
              <Building2 size={11} /> {project.studio.name}
            </span>
          )}
          {project.eventLocation && (
            <span className="flex items-center gap-1.5">
              <Building2 size={11} /> {project.eventLocation}
            </span>
          )}
          {project.startDate && (
            <span>Starts {fmtDate(project.startDate)}</span>
          )}
        </div>
        {project.description && (
          <p className="text-[13px] text-surface-dark mt-3">{project.description}</p>
        )}
      </div>

      {/* Sets section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[15px] font-bold text-surface-dark flex items-center gap-2">
              <Layers size={15} className="text-brand-blue" />
              Sets
            </h2>
            <p className="text-[12px] text-slate-400 mt-0.5">
              Sets assigned to this project. Click a set to see equipment on it.
            </p>
          </div>
          {isManager && (
            <Button variant="secondary" onClick={() => setShowAddSet(true)}>
              <Plus size={13} className="mr-1" />
              Add Set
            </Button>
          )}
        </div>

        {setsLoading ? (
          <div className="text-[13px] text-slate-400">Loading sets…</div>
        ) : !projectSets?.length ? (
          <div className="bg-white rounded-panel border border-grey-mid border-dashed p-8 text-center">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <MapPin size={18} className="text-slate-400" />
            </div>
            <p className="text-[14px] font-semibold text-surface-dark mb-1">No sets added yet</p>
            <p className="text-[12px] text-slate-400 mb-4">
              Add the sets this production is using to track equipment by location.
            </p>
            {isManager && (
              <Button variant="secondary" onClick={() => setShowAddSet(true)}>
                <Plus size={13} className="mr-1" />
                Add First Set
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {projectSets.map((ps) => (
              <div
                key={ps.id}
                className="bg-white rounded-panel border border-grey-mid p-4 flex items-center gap-4 group hover:border-brand-blue/40 transition-colors cursor-pointer"
                onClick={() => setActiveSetDrawer({
                  setId:     ps.set.id,
                  setName:   ps.set.name,
                  stageName: ps.stage.name,
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSet.mutate({ workspaceId, projectSetId: ps.id });
                      }}
                      className="p-1 rounded text-slate-300 hover:text-status-red hover:bg-status-red/5 transition-colors"
                      title="Remove set from project"
                    >
                      <X size={13} />
                    </button>
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

      {activeSetDrawer && (
        <SetEquipmentDrawer
          projectId={projectId}
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
                  // Small coloured dot per status — much quieter than a pill
                  const dotColour =
                    status === "active"  ? "bg-status-green" :
                    status === "wrapped" ? "bg-slate-300"    :
                                           "bg-slate-200";
                  return (
                    <li key={p.id}>
                      <button
                        onClick={() => setSelectedId(p.id)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1.5 rounded-btn text-[13px] transition-colors text-left",
                          isActive
                            ? "bg-brand-blue/10 text-brand-blue font-semibold"
                            : "text-surface-dark hover:bg-grey-light"
                        )}
                      >
                        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColour)} />
                        <span className="truncate flex-1">{p.name}</span>
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
