"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Plus, MapPin, Layers, Package,
  X, ChevronRight, Building2, Film, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";

// ── Status colours (sacred) ───────────────────────────────────────────────

const STATUS_COLOURS: Record<string, string> = {
  available:    "text-status-green",
  checked_out:  "text-status-amber",
  damaged:      "text-status-red",
  under_repair: "text-status-teal",
  lost:         "text-status-purple",
  retired:      "text-grey",
};

const STATUS_LABELS: Record<string, string> = {
  available:    "Available",
  checked_out:  "Checked Out",
  damaged:      "Damaged",
  under_repair: "Under Repair",
  lost:         "Lost",
  retired:      "Retired",
};

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

  // Sort studios: project's recommended studio first, then rest alphabetically
  const recommendedStudio = (studios ?? []).find((s) => s.id === projectStudioId);
  const otherStudios = (studios ?? [])
    .filter((s) => s.id !== projectStudioId)
    .sort((a, b) => a.name.localeCompare(b.name));

  const add = trpc.project.sets.add.useMutation({
    onSuccess: () => {
      utils.project.sets.list.invalidate({ projectId });
      onClose();
    },
    onError: (e) => setError(e.message),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!stageId)         { setError("Please select a stage."); return; }
    if (!setName.trim())  { setError("Please enter a set name."); return; }
    add.mutate({ workspaceId, projectId, stageId, setName: setName.trim(), notes: notes.trim() || undefined });
  }

  const inputCls = "w-full border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark bg-white focus:outline-none focus:ring-1 focus:ring-brand-blue";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="w-full max-w-md bg-white rounded-panel border border-grey-mid shadow-lg">
        <div className="px-6 py-5 border-b border-grey-mid flex items-center justify-between">
          <div>
            <h2 className="text-[16px] font-bold text-surface-dark">Add Set to Project</h2>
            <p className="text-[13px] text-slate-500 mt-0.5">Name the set and choose which stage it\'s on.</p>
          </div>
          <button onClick={onClose} className="text-grey hover:text-surface-dark">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          {/* Studio — recommended project studio first */}
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
          </div>

          {/* Stage */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Stage / Area
            </label>
            <select
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              disabled={!studioId}
              className={`${inputCls} ${!studioId ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              <option value="">Select stage…</option>
              {(stages ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Set name — typed, not selected */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Set Name <span className="text-status-red">*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={setName}
              onChange={(e) => setSetName(e.target.value)}
              placeholder="e.g. Throne Room, Ext. Village, Studio B"
              disabled={!stageId}
              className={`${inputCls} ${!stageId ? "opacity-40 cursor-not-allowed" : ""}`}
            />
            {stageId && (
              <p className="text-[11px] text-slate-400 mt-1">
                A new set will be created if this name doesn\'t already exist on the selected stage.
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Notes <span className="text-slate-400 font-normal normal-case">(optional)</span>
            </label>
            <input
              type="text"
              value={notes}
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

        {/* Equipment list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-6 text-[13px] text-slate-400">Loading equipment…</div>
          ) : !equipment?.length ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <Package size={18} className="text-slate-400" />
              </div>
              <p className="text-[14px] font-semibold text-surface-dark mb-1">No equipment on this set</p>
              <p className="text-[12px] text-slate-400">
                Equipment checked out to this set will appear here.
              </p>
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
                        {STATUS_LABELS[item.status] ?? item.status}
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

// ── Main Project Detail Page ──────────────────────────────────────────────

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const { workspaceId, userRole } = useWorkspace();
  const isManager = ["owner", "admin", "manager"].includes(userRole);

  const [showAddSet,      setShowAddSet]      = useState(false);
  const [activeSetDrawer, setActiveSetDrawer] = useState<{
    setId:     string;
    setName:   string;
    stageName: string;
  } | null>(null);

  const utils = trpc.useUtils();

  const { data: projects } = trpc.project.list.useQuery({ workspaceId });
  const project = projects?.find((p) => p.id === projectId);

  const { data: projectSets, isLoading: setsLoading } = trpc.project.sets.list.useQuery(
    { workspaceId, projectId },
    { enabled: !!projectId }
  );

  const removeSet = trpc.project.sets.remove.useMutation({
    onSuccess: () => utils.project.sets.list.invalidate({ projectId }),
  });

  if (!project) {
    return (
      <div className="flex-1 p-6">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-[13px] text-grey hover:text-surface-dark mb-6">
          <ArrowLeft size={14} /> Back to Projects
        </button>
        <p className="text-[13px] text-slate-400">Project not found.</p>
      </div>
    );
  }

  const type = project.industryType as "film_tv" | "events";

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-4xl">

      {/* Back + header */}
      <button
        onClick={() => router.push("/projects")}
        className="flex items-center gap-1.5 text-[12px] text-grey hover:text-surface-dark mb-5 transition-colors"
      >
        <ArrowLeft size={13} /> Back to Projects
      </button>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0 mt-0.5">
            {type === "film_tv"
              ? <Film size={18} className="text-brand-blue" />
              : <Zap  size={18} className="text-brand-blue" />}
          </div>
          <div>
            <h1 className="text-[20px] font-bold text-surface-dark leading-tight">{project.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
              <span className="text-[12px] text-slate-400">
                {type === "film_tv" ? "Film & TV" : "Events"}
              </span>
              {project.studio && (
                <span className="flex items-center gap-1 text-[12px] text-slate-400">
                  <Building2 size={11} /> {project.studio.name}
                </span>
              )}
              {project.eventLocation && (
                <span className="flex items-center gap-1 text-[12px] text-slate-400">
                  <Building2 size={11} /> {project.eventLocation}
                </span>
              )}
            </div>
            {project.description && (
              <p className="text-[12px] text-slate-500 mt-1">{project.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Sets Section ── */}
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
                    <p className="text-[11px] text-slate-400 italic mt-0.5">{ps.notes}</p>
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

      {/* Modals / drawers */}
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
