/**
 * LogiTrak LocationAdminPanel Component
 * Accordion list of Studios → Stages → Sets with inline add/edit/delete.
 *
 * Used on the Settings > Locations page.
 * Each studio expands to show its stages; each stage expands to show its sets.
 * Inline editing: click the pencil to rename; click + to add a child; click × to delete.
 *
 * Usage:
 *   <LocationAdminPanel
 *     studios={studios}
 *     onAddStudio={async (name) => await addStudio(name)}
 *     onAddStage={async (studioId, name) => await addStage(studioId, name)}
 *     onAddSet={async (stageId, name) => await addSet(stageId, name)}
 *     onRename={async (type, id, name) => await rename(type, id, name)}
 *     onDelete={async (type, id) => await deleteLocation(type, id)}
 *   />
 */

"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// ── Data shapes ───────────────────────────────────────────────────────────

export interface SetNode {
  id:   string;
  name: string;
}

export interface StageNode {
  id:   string;
  name: string;
  sets: SetNode[];
}

export interface StudioNode {
  id:     string;
  name:   string;
  stages: StageNode[];
}

export type LocationNodeType = "studio" | "stage" | "set";

// ── Component ─────────────────────────────────────────────────────────────

export interface LocationAdminPanelProps {
  studios:      StudioNode[];
  onAddStudio:  (name: string) => Promise<void>;
  onAddStage:   (studioId: string, name: string) => Promise<void>;
  onAddSet:     (stageId: string, name: string) => Promise<void>;
  onRename:     (type: LocationNodeType, id: string, name: string) => Promise<void>;
  onDelete:     (type: LocationNodeType, id: string) => Promise<void>;
}

export function LocationAdminPanel({
  studios,
  onAddStudio,
  onAddStage,
  onAddSet,
  onRename,
  onDelete,
}: LocationAdminPanelProps) {
  const [openStudios, setOpenStudios] = useState<Set<string>>(new Set());
  const [openStages,  setOpenStages]  = useState<Set<string>>(new Set());

  function toggleStudio(id: string) {
    setOpenStudios((s) => {
      const next = new Set(s);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  function toggleStage(id: string) {
    setOpenStages((s) => {
      const next = new Set(s);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  return (
    <div className="bg-white rounded-card border border-grey-mid overflow-hidden">
      {/* ── Studios list ── */}
      {studios.map((studio) => (
        <div key={studio.id} className="border-b border-grey-mid last:border-b-0">
          {/* Studio row */}
          <AccordionRow
            label={studio.name}
            isOpen={openStudios.has(studio.id)}
            onToggle={() => toggleStudio(studio.id)}
            depth={0}
            onRename={(name) => onRename("studio", studio.id, name)}
            onDelete={() => onDelete("studio", studio.id)}
            childCount={studio.stages.length}
            childLabel="stages"
          />

          {/* Stages */}
          {openStudios.has(studio.id) && (
            <div className="border-t border-grey-mid">
              {studio.stages.map((stage) => (
                <div key={stage.id} className="border-b border-grey-mid last:border-b-0">
                  {/* Stage row */}
                  <AccordionRow
                    label={stage.name}
                    isOpen={openStages.has(stage.id)}
                    onToggle={() => toggleStage(stage.id)}
                    depth={1}
                    onRename={(name) => onRename("stage", stage.id, name)}
                    onDelete={() => onDelete("stage", stage.id)}
                    childCount={stage.sets.length}
                    childLabel="sets"
                  />

                  {/* Sets */}
                  {openStages.has(stage.id) && (
                    <div className="border-t border-grey-mid">
                      {stage.sets.map((set) => (
                        <LeafRow
                          key={set.id}
                          label={set.name}
                          depth={2}
                          onRename={(name) => onRename("set", set.id, name)}
                          onDelete={() => onDelete("set", set.id)}
                        />
                      ))}
                      {/* Add set */}
                      <AddInlineRow
                        depth={2}
                        placeholder="New set name…"
                        onAdd={(name) => onAddSet(stage.id, name)}
                      />
                    </div>
                  )}
                </div>
              ))}
              {/* Add stage */}
              <AddInlineRow
                depth={1}
                placeholder="New stage name…"
                onAdd={(name) => onAddStage(studio.id, name)}
              />
            </div>
          )}
        </div>
      ))}

      {/* Add studio */}
      <AddInlineRow
        depth={0}
        placeholder="New studio / venue name…"
        onAdd={onAddStudio}
        topBorder={studios.length > 0}
      />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

const depthPad = ["pl-5", "pl-10", "pl-16"] as const;

interface AccordionRowProps {
  label:       string;
  isOpen:      boolean;
  onToggle:    () => void;
  depth:       0 | 1 | 2;
  onRename:    (name: string) => Promise<void>;
  onDelete:    () => Promise<void>;
  childCount:  number;
  childLabel:  string;
}

function AccordionRow({
  label, isOpen, onToggle, depth, onRename, onDelete, childCount, childLabel,
}: AccordionRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(label);
  const [loading, setLoading] = useState(false);

  async function commitRename() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === label) { setEditing(false); setDraft(label); return; }
    setLoading(true);
    try { await onRename(trimmed); setEditing(false); }
    finally { setLoading(false); }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${label}"? This will also delete all child items.`)) return;
    setLoading(true);
    try { await onDelete(); }
    finally { setLoading(false); }
  }

  return (
    <div className={cn("flex items-center gap-2 py-2.5 pr-4 hover:bg-grey-light/60 group", depthPad[depth])}>
      {/* Chevron */}
      <button
        onClick={onToggle}
        className="text-grey hover:text-surface-dark text-[11px] w-4 text-center flex-shrink-0"
        aria-label={isOpen ? "Collapse" : "Expand"}
      >
        {isOpen ? "▾" : "▸"}
      </button>

      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") { setEditing(false); setDraft(label); }
          }}
          disabled={loading}
          className="flex-1 text-[13px] font-semibold text-surface-dark bg-grey-light border border-brand-blue rounded px-2 py-0.5 focus:outline-none"
        />
      ) : (
        <button onClick={onToggle} className="flex-1 text-left">
          <span className="text-[13px] font-semibold text-surface-dark">{label}</span>
          <span className="text-[11px] text-grey ml-2">{childCount} {childLabel}</span>
        </button>
      )}

      {/* Action icons — visible on hover */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <IconBtn onClick={() => setEditing(true)}  label={`Rename ${label}`}      icon="✏" />
        <IconBtn onClick={handleDelete}             label={`Delete ${label}`}       icon="×" danger />
      </div>
    </div>
  );
}

interface LeafRowProps {
  label:    string;
  depth:    0 | 1 | 2;
  onRename: (name: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

function LeafRow({ label, depth, onRename, onDelete }: LeafRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(label);
  const [loading, setLoading] = useState(false);

  async function commitRename() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === label) { setEditing(false); setDraft(label); return; }
    setLoading(true);
    try { await onRename(trimmed); setEditing(false); }
    finally { setLoading(false); }
  }

  async function handleDelete() {
    if (!confirm(`Delete set "${label}"?`)) return;
    setLoading(true);
    try { await onDelete(); }
    finally { setLoading(false); }
  }

  return (
    <div className={cn("flex items-center gap-2 py-2 pr-4 hover:bg-grey-light/60 group", depthPad[depth])}>
      <span className="text-grey text-[11px] w-4 text-center flex-shrink-0">—</span>

      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") { setEditing(false); setDraft(label); }
          }}
          disabled={loading}
          className="flex-1 text-[13px] text-surface-dark bg-grey-light border border-brand-blue rounded px-2 py-0.5 focus:outline-none"
        />
      ) : (
        <span className="flex-1 text-[13px] text-surface-dark">{label}</span>
      )}

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <IconBtn onClick={() => setEditing(true)} label={`Rename ${label}`} icon="✏" />
        <IconBtn onClick={handleDelete}            label={`Delete ${label}`}  icon="×" danger />
      </div>
    </div>
  );
}

interface AddInlineRowProps {
  depth:       0 | 1 | 2;
  placeholder: string;
  onAdd:       (name: string) => Promise<void>;
  topBorder?:  boolean;
}

function AddInlineRow({ depth, placeholder, onAdd, topBorder }: AddInlineRowProps) {
  const [adding,  setAdding]  = useState(false);
  const [draft,   setDraft]   = useState("");
  const [loading, setLoading] = useState(false);

  async function commit() {
    const trimmed = draft.trim();
    if (!trimmed) { setAdding(false); setDraft(""); return; }
    setLoading(true);
    try { await onAdd(trimmed); setAdding(false); setDraft(""); }
    finally { setLoading(false); }
  }

  return (
    <div className={cn(depthPad[depth], "pr-4 py-2", topBorder && "border-t border-grey-mid")}>
      {adding ? (
        <div className="flex items-center gap-2">
          <span className="text-grey text-[11px] w-4 text-center">+</span>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") { setAdding(false); setDraft(""); }
            }}
            disabled={loading}
            placeholder={placeholder}
            className="flex-1 text-[13px] text-surface-dark bg-grey-light border border-brand-blue rounded px-2 py-0.5 focus:outline-none placeholder:text-grey"
          />
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="text-[12px] text-grey hover:text-brand-blue transition-colors flex items-center gap-1.5 pl-5"
        >
          <span>+</span> {placeholder.replace("…", "")}
        </button>
      )}
    </div>
  );
}

function IconBtn({
  onClick, label, icon, danger,
}: {
  onClick: () => void;
  label:   string;
  icon:    string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        "text-[13px] leading-none px-1 py-0.5 rounded hover:bg-grey-mid transition-colors",
        danger ? "text-status-red hover:bg-status-red-light" : "text-grey hover:text-surface-dark"
      )}
    >
      {icon}
    </button>
  );
}
