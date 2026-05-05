"use client";

import { useState } from "react";
import { Building2, Layers, Square, Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Data shapes ───────────────────────────────────────────────────────────────

export interface SetNode   { id: string; name: string }
export interface StageNode { id: string; name: string; sets: SetNode[] }
export interface StudioNode { id: string; name: string; stages: StageNode[] }
export type LocationNodeType = "studio" | "stage" | "set";

export interface LocationAdminPanelProps {
  studios:     StudioNode[];
  onAddStudio: (name: string) => Promise<void>;
  onAddStage:  (studioId: string, name: string) => Promise<void>;
  onAddSet:    (stageId: string, name: string) => Promise<void>;
  onRename:    (type: LocationNodeType, id: string, name: string) => Promise<void>;
  onDelete:    (type: LocationNodeType, id: string) => Promise<void>;
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function LocationAdminPanel({
  studios, onAddStudio, onAddStage, onAddSet, onRename, onDelete,
}: LocationAdminPanelProps) {
  const [addingStudio, setAddingStudio] = useState(false);
  const [newStudioName, setNewStudioName] = useState("");
  const [saving, setSaving] = useState(false);

  async function commitAddStudio() {
    const name = newStudioName.trim();
    if (!name) { setAddingStudio(false); setNewStudioName(""); return; }
    setSaving(true);
    try { await onAddStudio(name); setAddingStudio(false); setNewStudioName(""); }
    finally { setSaving(false); }
  }

  const totalStages = studios.reduce((n, s) => n + s.stages.length, 0);
  const totalSets   = studios.reduce((n, s) => n + s.stages.reduce((m, st) => m + st.sets.length, 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      {studios.length > 0 && (
        <div className="flex items-center gap-6 px-1 mb-2">
          <Stat icon={<Building2 size={13} />} label="Studios" value={studios.length} />
          <Stat icon={<Layers size={13} />}    label="Stages"  value={totalStages} />
          <Stat icon={<Square size={13} />}    label="Sets"    value={totalSets} />
        </div>
      )}

      {/* Studio cards */}
      {studios.map((studio) => (
        <StudioCard
          key={studio.id}
          studio={studio}
          onAddStage={onAddStage}
          onAddSet={onAddSet}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}

      {/* Add studio */}
      {addingStudio ? (
        <div className="bg-white border border-brand-blue rounded-panel p-4 flex items-center gap-3">
          <Building2 size={16} className="text-brand-blue shrink-0" />
          <input
            autoFocus
            value={newStudioName}
            onChange={(e) => setNewStudioName(e.target.value)}
            onBlur={commitAddStudio}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitAddStudio();
              if (e.key === "Escape") { setAddingStudio(false); setNewStudioName(""); }
            }}
            disabled={saving}
            placeholder="Studio or venue name…"
            className="flex-1 text-[13px] text-surface-dark focus:outline-none placeholder:text-slate-400"
          />
        </div>
      ) : (
        <button
          onClick={() => setAddingStudio(true)}
          className="w-full flex items-center gap-2 px-4 py-3 border border-dashed border-grey-mid rounded-panel text-[13px] text-slate-400 hover:text-brand-blue hover:border-brand-blue transition-colors"
        >
          <Plus size={14} />
          Add studio or venue
        </button>
      )}
    </div>
  );
}

// ── Studio card ───────────────────────────────────────────────────────────────

function StudioCard({
  studio, onAddStage, onAddSet, onRename, onDelete,
}: {
  studio:     StudioNode;
  onAddStage: (studioId: string, name: string) => Promise<void>;
  onAddSet:   (stageId: string, name: string) => Promise<void>;
  onRename:   (type: LocationNodeType, id: string, name: string) => Promise<void>;
  onDelete:   (type: LocationNodeType, id: string) => Promise<void>;
}) {
  const [collapsed, setCollapsed]   = useState(false);
  const [editing,   setEditing]     = useState(false);
  const [draft,     setDraft]       = useState(studio.name);
  const [saving,    setSaving]      = useState(false);
  const [addingStage, setAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState("");

  const setCount = studio.stages.reduce((n, st) => n + st.sets.length, 0);

  async function commitRename() {
    const name = draft.trim();
    if (!name || name === studio.name) { setEditing(false); setDraft(studio.name); return; }
    setSaving(true);
    try { await onRename("studio", studio.id, name); setEditing(false); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirm(`Delete studio "${studio.name}" and all its stages and sets?`)) return;
    setSaving(true);
    try { await onDelete("studio", studio.id); }
    finally { setSaving(false); }
  }

  async function commitAddStage() {
    const name = newStageName.trim();
    if (!name) { setAddingStage(false); setNewStageName(""); return; }
    setSaving(true);
    try { await onAddStage(studio.id, name); setAddingStage(false); setNewStageName(""); }
    finally { setSaving(false); }
  }

  return (
    <div className="bg-white border border-grey-mid rounded-panel overflow-hidden shadow-sm">
      {/* Studio header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-grey-mid bg-grey-light/40 group">
        <button onClick={() => setCollapsed((v) => !v)} className="text-slate-400 hover:text-surface-dark shrink-0">
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>

        <Building2 size={16} className="text-brand-blue shrink-0" />

        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") { setEditing(false); setDraft(studio.name); }
            }}
            disabled={saving}
            className="flex-1 text-[15px] font-bold text-surface-dark bg-white border border-brand-blue rounded px-2 py-0.5 focus:outline-none"
          />
        ) : (
          <span className="flex-1 text-[15px] font-bold text-surface-dark">{studio.name}</span>
        )}

        <div className="flex items-center gap-3 ml-auto">
          <span className="text-[12px] text-slate-400 hidden sm:block">
            {studio.stages.length} {studio.stages.length === 1 ? "stage" : "stages"} · {setCount} {setCount === 1 ? "set" : "sets"}
          </span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <ActionBtn onClick={() => setEditing(true)}  icon={<Pencil size={12} />}  label="Rename studio" />
            <ActionBtn onClick={handleDelete}             icon={<Trash2 size={12} />}  label="Delete studio" danger />
          </div>
        </div>
      </div>

      {/* Stages */}
      {!collapsed && (
        <div>
          {studio.stages.length === 0 && !addingStage ? (
            <p className="px-6 py-4 text-[13px] text-slate-400 italic">No stages yet.</p>
          ) : (
            studio.stages.map((stage, i) => (
              <StageRow
                key={stage.id}
                stage={stage}
                isLast={i === studio.stages.length - 1 && !addingStage}
                onAddSet={onAddSet}
                onRename={onRename}
                onDelete={onDelete}
              />
            ))
          )}

          {/* Add stage inline */}
          {addingStage ? (
            <div className="flex items-center gap-3 px-6 py-3 border-t border-grey-mid bg-brand-blue/5">
              <Layers size={13} className="text-brand-blue shrink-0" />
              <input
                autoFocus
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                onBlur={commitAddStage}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitAddStage();
                  if (e.key === "Escape") { setAddingStage(false); setNewStageName(""); }
                }}
                disabled={saving}
                placeholder="Stage name…"
                className="flex-1 text-[13px] text-surface-dark focus:outline-none bg-transparent placeholder:text-slate-400"
              />
            </div>
          ) : (
            <button
              onClick={() => setAddingStage(true)}
              className="w-full flex items-center gap-2 px-6 py-3 border-t border-grey-mid text-[12px] text-slate-400 hover:text-brand-blue hover:bg-brand-blue/5 transition-colors"
            >
              <Plus size={13} />
              Add stage
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Stage row ─────────────────────────────────────────────────────────────────

function StageRow({
  stage, isLast, onAddSet, onRename, onDelete,
}: {
  stage:    StageNode;
  isLast:   boolean;
  onAddSet: (stageId: string, name: string) => Promise<void>;
  onRename: (type: LocationNodeType, id: string, name: string) => Promise<void>;
  onDelete: (type: LocationNodeType, id: string) => Promise<void>;
}) {
  const [expanded,    setExpanded]    = useState(true);
  const [editing,     setEditing]     = useState(false);
  const [draft,       setDraft]       = useState(stage.name);
  const [saving,      setSaving]      = useState(false);
  const [addingSet,   setAddingSet]   = useState(false);
  const [newSetName,  setNewSetName]  = useState("");

  async function commitRename() {
    const name = draft.trim();
    if (!name || name === stage.name) { setEditing(false); setDraft(stage.name); return; }
    setSaving(true);
    try { await onRename("stage", stage.id, name); setEditing(false); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirm(`Delete stage "${stage.name}" and all its sets?`)) return;
    setSaving(true);
    try { await onDelete("stage", stage.id); }
    finally { setSaving(false); }
  }

  async function commitAddSet() {
    const name = newSetName.trim();
    if (!name) { setAddingSet(false); setNewSetName(""); return; }
    setSaving(true);
    try { await onAddSet(stage.id, name); setAddingSet(false); setNewSetName(""); }
    finally { setSaving(false); }
  }

  return (
    <div className={cn("border-t border-grey-mid", isLast && "")}>
      {/* Stage header */}
      <div className="flex items-center gap-3 pl-8 pr-4 py-3 hover:bg-grey-light/50 group">
        <button onClick={() => setExpanded((v) => !v)} className="text-slate-300 hover:text-slate-500 shrink-0">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        <Layers size={13} className="text-slate-400 shrink-0" />

        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") { setEditing(false); setDraft(stage.name); }
            }}
            disabled={saving}
            className="flex-1 text-[13px] font-semibold text-surface-dark bg-white border border-brand-blue rounded px-2 py-0.5 focus:outline-none"
          />
        ) : (
          <span className="flex-1 text-[13px] font-semibold text-surface-dark">{stage.name}</span>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[11px] text-slate-400">
            {stage.sets.length} {stage.sets.length === 1 ? "set" : "sets"}
          </span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <ActionBtn onClick={() => setEditing(true)} icon={<Pencil size={11} />} label="Rename stage" />
            <ActionBtn onClick={handleDelete}            icon={<Trash2 size={11} />} label="Delete stage" danger />
          </div>
        </div>
      </div>

      {/* Sets */}
      {expanded && (
        <div className="pl-16 pr-4 pb-2">
          {stage.sets.map((set) => (
            <SetRow
              key={set.id}
              set={set}
              onRename={(name) => onRename("set", set.id, name)}
              onDelete={() => onDelete("set", set.id)}
            />
          ))}

          {addingSet ? (
            <div className="flex items-center gap-2 py-1.5">
              <Square size={11} className="text-brand-blue shrink-0" />
              <input
                autoFocus
                value={newSetName}
                onChange={(e) => setNewSetName(e.target.value)}
                onBlur={commitAddSet}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitAddSet();
                  if (e.key === "Escape") { setAddingSet(false); setNewSetName(""); }
                }}
                disabled={saving}
                placeholder="Set name…"
                className="flex-1 text-[12px] text-surface-dark focus:outline-none bg-transparent placeholder:text-slate-400"
              />
            </div>
          ) : (
            <button
              onClick={() => setAddingSet(true)}
              className="flex items-center gap-1.5 py-1.5 text-[12px] text-slate-400 hover:text-brand-blue transition-colors"
            >
              <Plus size={12} />
              Add set
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Set row ───────────────────────────────────────────────────────────────────

function SetRow({
  set, onRename, onDelete,
}: {
  set:      SetNode;
  onRename: (name: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(set.name);
  const [saving,  setSaving]  = useState(false);

  async function commitRename() {
    const name = draft.trim();
    if (!name || name === set.name) { setEditing(false); setDraft(set.name); return; }
    setSaving(true);
    try { await onRename(name); setEditing(false); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirm(`Delete set "${set.name}"?`)) return;
    setSaving(true);
    try { await onDelete(); }
    finally { setSaving(false); }
  }

  return (
    <div className="flex items-center gap-2 py-1.5 group">
      <Square size={11} className="text-slate-300 shrink-0" />

      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") { setEditing(false); setDraft(set.name); }
          }}
          disabled={saving}
          className="flex-1 text-[12px] text-surface-dark bg-white border border-brand-blue rounded px-2 py-0.5 focus:outline-none"
        />
      ) : (
        <span className="flex-1 text-[12px] text-surface-dark">{set.name}</span>
      )}

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <ActionBtn onClick={() => setEditing(true)} icon={<Pencil size={10} />} label="Rename set" />
        <ActionBtn onClick={handleDelete}            icon={<Trash2 size={10} />} label="Delete set" danger />
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
      <span className="text-slate-400">{icon}</span>
      <span className="font-semibold text-surface-dark">{value}</span>
      <span>{label}</span>
    </div>
  );
}

function ActionBtn({ onClick, icon, label, danger }: { onClick: () => void; icon: React.ReactNode; label: string; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        "p-1 rounded transition-colors",
        danger
          ? "text-slate-300 hover:text-status-red hover:bg-status-red/10"
          : "text-slate-300 hover:text-surface-dark hover:bg-grey-mid"
      )}
    >
      {icon}
    </button>
  );
}
