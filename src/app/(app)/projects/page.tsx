"use client";

import { useState } from "react";
import { Plus, Film, Zap, Calendar, ChevronDown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";

type IndustryType = "film_tv" | "events";
type ProjectStatus = "active" | "wrapped" | "archived";

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

function NewProjectModal({ onClose, workspaceId }: { onClose: () => void; workspaceId: string }) {
  const utils = trpc.useUtils();
  const create = trpc.project.create.useMutation({
    onSuccess: () => { utils.project.list.invalidate(); onClose(); },
  });

  const { data: existingStudios } = trpc.location.studio.list.useQuery({ workspaceId });

  const [name, setName] = useState("");
  const [industryType, setIndustryType] = useState<IndustryType>("film_tv");
  const [startDate, setStartDate] = useState(today());
  const [description, setDescription] = useState("");
  const [studioChoice, setStudioChoice] = useState("");
  const [customStudio, setCustomStudio] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Build the merged studio list: workspace studios first, then known ones not already present, then Other
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

    // Resolve studioId for existing workspace studios
    const existingMatch = (existingStudios ?? []).find((s) => s.name === studioChoice);

    try {
      await create.mutateAsync({
        workspaceId,
        name: name.trim(),
        industryType,
        startDate: startDate || undefined,
        description: description.trim() || undefined,
        studioId: industryType === "film_tv" ? existingMatch?.id : undefined,
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
          {/* Name */}
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

          {/* Type */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Type
            </label>
            <div className="flex gap-2">
              {(["film_tv", "events"] as IndustryType[]).map((t) => (
                <button
                  key={t} type="button"
                  onClick={() => { setIndustryType(t); setStudioChoice(""); setCustomStudio(""); setEventLocation(""); }}
                  className={[
                    "flex-1 flex items-center justify-center gap-2 py-2 rounded-btn border text-[13px] font-medium transition-colors",
                    industryType === t
                      ? "border-brand-blue bg-brand-blue/5 text-brand-blue"
                      : "border-grey-mid text-slate-500 hover:bg-grey-light",
                  ].join(" ")}
                >
                  {t === "film_tv" ? <Film size={14} /> : <Zap size={14} />}
                  {t === "film_tv" ? "Film & TV" : "Events"}
                </button>
              ))}
            </div>
          </div>

          {/* Start date */}
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

          {/* Studio (Film & TV only) */}
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

          {/* Event location (Events only) */}
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

          {/* Description */}
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

function ProjectCard({
  project,
  workspaceId,
}: {
  project: {
    id: string;
    name: string;
    industryType: string;
    status: string;
    startDate: Date | null;
    description: string | null;
    studio: { id: string; name: string } | null;
    eventLocation: string | null;
  };
  workspaceId: string;
}) {
  const utils = trpc.useUtils();
  const updateStatus = trpc.project.updateStatus.useMutation({
    onSuccess: () => utils.project.list.invalidate(),
  });
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const status = project.status as ProjectStatus;
  const type = project.industryType as IndustryType;

  function fmt(d: Date | null) {
    if (!d) return null;
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  return (
    <div className="bg-white rounded-panel border border-grey-mid p-5 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 w-8 h-8 rounded-lg bg-brand-blue/10 flex items-center justify-center shrink-0">
          {type === "film_tv" ? <Film size={15} className="text-brand-blue" /> : <Zap size={15} className="text-brand-blue" />}
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-surface-dark truncate">{project.name}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
            <span className="text-[12px] text-slate-400">
              {type === "film_tv" ? "Film & TV" : "Events"}
            </span>
            {project.studio && (
              <span className="flex items-center gap-1 text-[12px] text-slate-400">
                <Building2 size={11} />
                {project.studio.name}
              </span>
            )}
            {project.eventLocation && (
              <span className="flex items-center gap-1 text-[12px] text-slate-400">
                <Building2 size={11} />
                {project.eventLocation}
              </span>
            )}
            {project.startDate && (
              <span className="flex items-center gap-1 text-[12px] text-slate-400">
                <Calendar size={11} />
                {fmt(project.startDate)}
              </span>
            )}
          </div>
          {project.description && (
            <p className="text-[12px] text-slate-500 mt-1 line-clamp-1">{project.description}</p>
          )}
        </div>
      </div>

      <div className="relative shrink-0">
        <button
          onClick={() => setShowStatusMenu((v) => !v)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${STATUS_STYLES[status]}`}
        >
          {STATUS_LABELS[status]}
          <ChevronDown size={11} />
        </button>
        {showStatusMenu && (
          <div className="absolute right-0 top-7 z-10 bg-white border border-grey-mid rounded-panel shadow-md py-1 w-32">
            {(["active", "wrapped", "archived"] as ProjectStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => {
                  updateStatus.mutate({ workspaceId, projectId: project.id, status: s });
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
  );
}

export default function ProjectsPage() {
  const { workspaceId } = useWorkspace();
  const [showModal, setShowModal] = useState(false);

  const { data: projects, isLoading } = trpc.project.list.useQuery(
    { workspaceId: workspaceId! },
    { enabled: !!workspaceId }
  );

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[20px] font-bold text-surface-dark">Projects</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Productions and events your team is working on.</p>
        </div>
        <Button variant="primary" onClick={() => setShowModal(true)}>
          <Plus size={14} className="mr-1.5" />
          New Project
        </Button>
      </div>

      {isLoading ? (
        <div className="text-[13px] text-slate-400">Loading…</div>
      ) : !projects?.length ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-full bg-brand-blue/10 flex items-center justify-center mb-4">
            <Film size={22} className="text-brand-blue" />
          </div>
          <p className="text-[15px] font-semibold text-surface-dark mb-1">No projects yet</p>
          <p className="text-[13px] text-slate-400 mb-5">
            Create your first project to start tracking equipment by production.
          </p>
          <Button variant="primary" onClick={() => setShowModal(true)}>
            <Plus size={14} className="mr-1.5" />
            New Project
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} workspaceId={workspaceId!} />
          ))}
        </div>
      )}

      {showModal && workspaceId && (
        <NewProjectModal workspaceId={workspaceId} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}
