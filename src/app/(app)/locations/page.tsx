"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import {
  Building2, ChevronDown, ChevronRight, Plus, Pencil, Trash2,
  Check, X, MapPin, Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";

// UK Studios reference data — sourced from logitrack_uk_studios_reference.docx
const UK_STUDIOS_REFERENCE: Record<string, { location: string; sections: { name: string; stages: string[] }[] }> = {
  "Pinewood Studios": {
    location: "Iver Heath, Buckinghamshire",
    sections: [
      { name: "Pinewood West — Original Lot", stages: ["007 Stage (Albert R. Broccoli Stage)", "The Roger Moore Stage", "The Richard Attenborough Stage", "Q Stage", "V Stage", "S Stage", "R Stage", "U Stage", "N Stage", "M Stage", "F Stage", "L Stage", "A Stage", "B Stage", "C Stage", "D Stage", "E Stage", "W Stage", "X Stage", "Z Stage", "Underwater Stage"] },
      { name: "Pinewood East — Newer Expansion Lot", stages: ["Stage 1", "Stage 2", "Stage 3", "Stage 4", "Stage 5", "Stage 6", "Stage 7", "Stage 8", "Stage 9", "The Sean Connery Stage"] },
      { name: "Pinewood South", stages: ["Pinewood South Stage 1", "Pinewood South Stage 2", "Pinewood South Stage 3"] },
    ],
  },
  "Shepperton Studios": {
    location: "Shepperton, Surrey",
    sections: [
      { name: "Original Lot — Netflix-Held", stages: ["A Stage", "B Stage", "C Stage", "D Stage", "E Stage", "F Stage", "G Stage", "H Stage", "I Stage", "J Stage", "K Stage", "L Stage", "M Stage", "N Stage"] },
      { name: "South Cluster", stages: ["South Stage 1", "South Stage 2", "South Stage 3", "South Stage 4", "South Stage 5", "South Stage 6", "South Stage 7", "South Stage 8", "South Stage 9", "South Stage 10", "South Stage 11", "South Stage 12", "South Stage 13", "South Stage 14"] },
      { name: "Northwest Cluster", stages: ["NW Stage 15", "NW Stage 16", "NW Stage 17"] },
    ],
  },
  "Warner Bros. Studios Leavesden": {
    location: "Leavesden, Watford, Hertfordshire",
    sections: [
      { name: "Production Stages — Original", stages: ["Stage A", "Stage B", "Stage C", "Stage D", "Stage E", "Stage F", "Stage G", "Stage H"] },
      { name: "Production Stages — Newer Build", stages: ["Stage L", "Stage T", "Stage U", "Stage V"] },
    ],
  },
  "Elstree Studios": {
    location: "Shenley Road, Borehamwood, Hertfordshire",
    sections: [
      { name: "Main Studio", stages: ["George Lucas Stage 1", "George Lucas Stage 2", "Platinum Stage 3", "Platinum Stage 4", "Stage 5", "Stage 6", "Stage 7", "Stage 8", "Stage 9", "Exterior Lot"] },
    ],
  },
  "Sky Studios Elstree": {
    location: "Rowleys Lane, Borehamwood, Hertfordshire",
    sections: [
      { name: "Main Studio", stages: ["Stage 1", "Stage 2", "Stage 3", "Stage 4", "Stage 5", "Stage 6", "Stage 7", "Stage 8", "Stage 9", "Stage 10", "Stage 11", "Stage 12", "Backlot"] },
    ],
  },
  "Longcross Studios": {
    location: "North Longcross, Chertsey, Surrey",
    sections: [
      { name: "Main Studio", stages: ["Stage 1", "Stage 2", "Stage 3", "Stage 4", "Stage 5", "Stage 6", "Tank", "Test Track / Backlot"] },
    ],
  },
  "Longcross South Studios": {
    location: "Longcross, Chertsey, Surrey",
    sections: [
      { name: "Main Studio", stages: ["Stage A", "Stage B", "Stage C", "Stage D", "Stage E", "Space 1", "Space 2", "Space 3", "Space 4"] },
    ],
  },
  "Shinfield Studios (Shadowbox Studios)": {
    location: "Shinfield, Reading, Berkshire",
    sections: [
      { name: "Main Studio", stages: Array.from({ length: 18 }, (_, i) => `Stage ${i + 1}`).concat(["Backlot"]) },
    ],
  },
  "3 Mills Studios": {
    location: "Three Mills Island, Bow, East London",
    sections: [
      { name: "Main Studio", stages: ["Stage 1", "Stage 2", "Stage 3", "Stage 4", "Stage 5", "Stage 6", "Stage 7", "Stage 8", "Stage 9", "Clock Mill", "Floating Stage"] },
    ],
  },
  "Ealing Studios": {
    location: "Ealing Green, Ealing, London",
    sections: [
      { name: "Main Studio", stages: ["Stage 1 (Main Stage)", "Stage 2", "Stage 3", "New Stage", "Ealing Green (Backlot)"] },
    ],
  },
  "Twickenham Film Studios": {
    location: "St Margarets, Twickenham, Middlesex",
    sections: [
      { name: "Main Studio", stages: ["Stage 1", "Stage 2", "Stage 3", "Post Production Theatre 1", "Post Production Theatre 2", "Post Production Theatre 3"] },
    ],
  },
  "Black Island Studios": {
    location: "Park Royal, London",
    sections: [
      { name: "Main Studio", stages: ["Stage 1", "Stage 2", "Stage 3", "Stage 4", "Stage 5"] },
    ],
  },
  "Garden Studios": {
    location: "Park Royal, West London",
    sections: [
      { name: "Orchid Campus", stages: ["Orchid Stage 1", "Orchid Stage 2", "Orchid Stage 3"] },
      { name: "Iris Campus", stages: ["Iris Stage 1", "Iris Stage 2", "Iris Stage 3", "Lily Stage 3"] },
      { name: "Rose Campus", stages: ["Rose Stage"] },
    ],
  },
  "Troubadour Meridian Water Studios": {
    location: "Meridian Water, Edmonton, North London",
    sections: [
      { name: "Main Studio", stages: ["Stage 1", "Stage 2", "Stage 3"] },
    ],
  },
  "The Bottle Yard Studios": {
    location: "Whitchurch, Bristol",
    sections: [
      { name: "TBY1 — Main Site", stages: ["Tank House 1", "Tank House 2", "Tank House 3", "Tank House 4", "Export Warehouse 5", "Studio 6", "Studio 7", "Studio 8 (Green Screen)"] },
      { name: "TBY2 — Premium Facility", stages: ["Studio 9", "Studio 10", "Studio 11"] },
    ],
  },
  "Titanic Studios": {
    location: "Titanic Quarter, Belfast",
    sections: [
      { name: "Main Studio", stages: ["Paint Hall Stage 1", "Paint Hall Stage 2", "Paint Hall Stage 3", "Paint Hall Stage 4", "William MacQuitty Stage", "Brian Hurst Stage"] },
    ],
  },
  "Belfast Harbour Studios": {
    location: "Titanic Quarter, Belfast",
    sections: [
      { name: "Main Studio", stages: ["Stage 1", "Stage 2", "Studio Ulster"] },
    ],
  },
};

const UK_STUDIO_NAMES = Object.keys(UK_STUDIOS_REFERENCE).sort();

export default function LocationsPage() {
  const { workspaceId } = useWorkspace();
  console.log('[LocationsPage] workspaceId:', workspaceId);

  // Studios query
  const studiosQuery = trpc.location.studio.list.useQuery(
    { workspaceId },
    { enabled: !!workspaceId }
  );
  const utils = trpc.useUtils();

  // Selected studio
  const [selectedStudioId, setSelectedStudioId] = useState<string | null>(null);

  // Add studio
  const [showAddStudio, setShowAddStudio] = useState(false);
  const [newStudioName, setNewStudioName] = useState("");
  const createStudio = trpc.admin.location.studio.create.useMutation({
    onSuccess: () => { utils.location.studio.list.invalidate(); setShowAddStudio(false); setNewStudioName(""); },
  });

  // Edit studio
  const [editingStudioId, setEditingStudioId] = useState<string | null>(null);
  const [editStudioName, setEditStudioName] = useState("");
  const updateStudio = trpc.admin.location.studio.update.useMutation({
    onSuccess: () => { utils.location.studio.list.invalidate(); setEditingStudioId(null); },
  });
  const deleteStudio = trpc.admin.location.studio.delete.useMutation({
    onSuccess: () => { utils.location.studio.list.invalidate(); setSelectedStudioId(null); },
  });

  // Stages query
  const stagesQuery = trpc.location.stage.list.useQuery(
    { workspaceId, studioId: selectedStudioId! },
    { enabled: !!selectedStudioId }
  );

  // Add stage
  const [showAddStage, setShowAddStage] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const createStage = trpc.admin.location.stage.create.useMutation({
    onSuccess: () => { utils.location.stage.list.invalidate(); setShowAddStage(false); setNewStageName(""); },
  });

  // Edit stage
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editStageName, setEditStageName] = useState("");
  const updateStage = trpc.admin.location.stage.update.useMutation({
    onSuccess: () => { utils.location.stage.list.invalidate(); setEditingStageId(null); },
  });
  const deleteStage = trpc.admin.location.stage.delete.useMutation({
    onSuccess: () => utils.location.stage.list.invalidate(),
  });

  const studios = studiosQuery.data ?? [];
  const selectedStudio = studios.find((s) => s.id === selectedStudioId);
  const stages = stagesQuery.data ?? [];

  const inp = "w-full border border-grey-mid rounded-lg px-3 py-2 text-[13px] text-surface-dark bg-white focus:outline-none focus:ring-1 focus:ring-brand-blue";

  return (
    <div className="flex h-full overflow-hidden">

      {/* Left panel — Studios list */}
      <div className="w-72 flex-shrink-0 border-r border-grey-mid bg-white flex flex-col">
        <div className="px-4 py-3 border-b border-grey-mid flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 size={15} className="text-grey" />
            <span className="text-[13px] font-semibold text-surface-dark">Studios</span>
            <span className="text-[11px] text-grey bg-grey-light px-1.5 py-0.5 rounded-full">{studios.length}</span>
          </div>
          <button onClick={() => setShowAddStudio(true)}
            className="text-brand-blue hover:text-brand-blue/80 transition-colors">
            <Plus size={16} />
          </button>
        </div>

        {/* Add studio panel */}
        {showAddStudio && (
          <div className="border-b border-grey-mid p-4 bg-grey-light space-y-3">
            <p className="text-[12px] font-semibold text-surface-dark">Add Studio</p>
            <div>
              <label className="block text-[11px] text-grey mb-1">Studio name *</label>
              <input value={newStudioName} onChange={(e) => setNewStudioName(e.target.value)}
                placeholder="e.g. Shepperton Studios" className={inp + " text-[12px]"}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newStudioName.trim()) createStudio.mutate({ workspaceId, name: newStudioName.trim(), displayId: newStudioName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") });
                  if (e.key === "Escape") { setShowAddStudio(false); setNewStudioName(""); }
                }} />
            </div>
            <div className="flex gap-2">
              <Button variant="primary" size="sm"
                disabled={!newStudioName.trim() || createStudio.isPending}
                onClick={() => createStudio.mutate({ workspaceId, name: newStudioName.trim(), displayId: newStudioName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") })}>
                {createStudio.isPending ? "Adding…" : "Add"}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => { setShowAddStudio(false); setNewStudioName(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Studios list */}
        <div className="flex-1 overflow-y-auto">
          {studios.length === 0 && !studiosQuery.isLoading && (
            <div className="p-6 text-center">
              <MapPin size={24} className="text-grey-mid mx-auto mb-2" />
              <p className="text-[12px] text-grey">No studios yet</p>
              <button onClick={() => setShowAddStudio(true)}
                className="text-[12px] text-brand-blue mt-1 hover:underline">Add your first studio</button>
            </div>
          )}
          {studios.map((studio) => (
            <div key={studio.id}
              className={`group flex items-center gap-2 px-4 py-3 cursor-pointer border-b border-grey-mid/50 transition-colors ${selectedStudioId === studio.id ? "bg-brand-blue/5 border-l-2 border-l-brand-blue" : "hover:bg-grey-light"}`}
              onClick={() => { setSelectedStudioId(studio.id); setEditingStudioId(null); }}>

              {editingStudioId === studio.id ? (
                <input value={editStudioName}
                  onChange={(e) => setEditStudioName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") updateStudio.mutate({ studioId: studio.id, workspaceId, name: editStudioName.trim() });
                    if (e.key === "Escape") setEditingStudioId(null);
                  }}
                  className="flex-1 text-[13px] border border-brand-blue rounded px-2 py-0.5 focus:outline-none"
                  onClick={(e) => e.stopPropagation()} autoFocus />
              ) : (
                <span className="flex-1 text-[13px] font-medium text-surface-dark truncate">{studio.name}</span>
              )}

              {editingStudioId === studio.id ? (
                <div className="flex gap-1">
                  <button onClick={(e) => { e.stopPropagation(); updateStudio.mutate({ studioId: studio.id, workspaceId, name: editStudioName.trim() }); }}
                    className="text-status-green"><Check size={13} /></button>
                  <button onClick={(e) => { e.stopPropagation(); setEditingStudioId(null); }}
                    className="text-grey"><X size={13} /></button>
                </div>
              ) : (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); setEditingStudioId(studio.id); setEditStudioName(studio.name); }}
                    className="text-grey hover:text-brand-blue transition-colors"><Pencil size={12} /></button>
                  <button onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete "${studio.name}"? This will also delete all its stages.`))
                      deleteStudio.mutate({ studioId: studio.id, workspaceId });
                  }}
                    className="text-grey hover:text-status-red transition-colors"><Trash2 size={12} /></button>
                </div>
              )}

              {selectedStudioId === studio.id
                ? <ChevronRight size={14} className="text-brand-blue flex-shrink-0" />
                : <ChevronRight size={14} className="text-grey-mid flex-shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — Stages */}
      <div className="flex-1 flex flex-col bg-grey-light overflow-hidden">
        {!selectedStudio ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Layers size={36} className="text-grey-mid mx-auto mb-3" />
              <p className="text-[14px] font-medium text-grey">Select a studio</p>
              <p className="text-[12px] text-grey mt-1">Choose a studio on the left to view and manage its stages</p>
            </div>
          </div>
        ) : (
          <>
            {/* Stages header */}
            <div className="px-6 py-4 bg-white border-b border-grey-mid flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-bold text-surface-dark">{selectedStudio.name}</h2>
                <p className="text-[12px] text-grey mt-0.5">{stages.length} stage{stages.length !== 1 ? "s" : ""}</p>
              </div>
              <Button variant="primary" size="sm" onClick={() => setShowAddStage(true)}>
                <Plus size={14} className="mr-1" /> Add Stage
              </Button>
            </div>

            {/* Add stage inline */}
            {showAddStage && (
              <div className="mx-6 mt-4 p-4 bg-white border border-grey-mid rounded-xl flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold text-grey mb-1">Stage name</label>
                  <input value={newStageName} onChange={(e) => setNewStageName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newStageName.trim())
                        createStage.mutate({ workspaceId, studioId: selectedStudioId!, name: newStageName.trim() });
                      if (e.key === "Escape") setShowAddStage(false);
                    }}
                    placeholder="e.g. Stage 1, A Stage, North Stage…"
                    className={inp} autoFocus />
                </div>
                <Button variant="primary" size="sm"
                  disabled={!newStageName.trim() || createStage.isPending}
                  onClick={() => createStage.mutate({ workspaceId, studioId: selectedStudioId!, name: newStageName.trim() })}>
                  Add
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setShowAddStage(false)}>
                  Cancel
                </Button>
              </div>
            )}

            {/* Stages list */}
            <div className="flex-1 overflow-y-auto p-6">
              {stagesQuery.isLoading && (
                <div className="text-center py-8 text-[12px] text-grey">Loading stages…</div>
              )}
              {!stagesQuery.isLoading && stages.length === 0 && !showAddStage && (
                <div className="text-center py-12">
                  <Layers size={28} className="text-grey-mid mx-auto mb-2" />
                  <p className="text-[13px] text-grey">No stages yet</p>
                  <button onClick={() => setShowAddStage(true)}
                    className="text-[12px] text-brand-blue mt-1 hover:underline">Add the first stage</button>
                </div>
              )}
              {stages.length > 0 && (
                <div className="bg-white rounded-xl border border-grey-mid overflow-hidden">
                  {stages.map((stage, i) => (
                    <div key={stage.id}
                      className={`group flex items-center gap-3 px-4 py-3 ${i < stages.length - 1 ? "border-b border-grey-mid/50" : ""}`}>

                      <div className="w-6 h-6 rounded-md bg-grey-light flex items-center justify-center flex-shrink-0">
                        <Layers size={12} className="text-grey" />
                      </div>

                      {editingStageId === stage.id ? (
                        <input value={editStageName}
                          onChange={(e) => setEditStageName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") updateStage.mutate({ stageId: stage.id, workspaceId, name: editStageName.trim() });
                            if (e.key === "Escape") setEditingStageId(null);
                          }}
                          className="flex-1 text-[13px] border border-brand-blue rounded px-2 py-0.5 focus:outline-none"
                          autoFocus />
                      ) : (
                        <span className="flex-1 text-[13px] text-surface-dark">{stage.name}</span>
                      )}

                      {editingStageId === stage.id ? (
                        <div className="flex gap-2">
                          <button onClick={() => updateStage.mutate({ stageId: stage.id, workspaceId, name: editStageName.trim() })}
                            className="text-status-green"><Check size={14} /></button>
                          <button onClick={() => setEditingStageId(null)}
                            className="text-grey"><X size={14} /></button>
                        </div>
                      ) : (
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingStageId(stage.id); setEditStageName(stage.name); }}
                            className="text-grey hover:text-brand-blue transition-colors"><Pencil size={13} /></button>
                          <button onClick={() => {
                            if (confirm(`Delete stage "${stage.name}"?`))
                              deleteStage.mutate({ stageId: stage.id, workspaceId });
                          }}
                            className="text-grey hover:text-status-red transition-colors"><Trash2 size={13} /></button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
