"use client";

/**
 * Settings → Locations
 *
 * Manage studios + stages for this account.
 * Two-column inside settings shell: studios list on the left, stages for the
 * selected studio on the right.
 */

import { useState } from "react";
import { SettingsPageShell, SettingsSection } from "@/components/shared/SettingsLayout";
import { SkeletonRows } from "@/components/shared/SkeletonRows";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Plus, Pencil, Trash2, Check, X, Building2, Layers } from "lucide-react";

function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export default function SettingsLocationsPage() {
  const { workspaceId } = useWorkspace();
  const utils = trpc.useUtils();

  const [toast, setToast] = useState<string | null>(null);
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const [selectedStudioId, setSelectedStudioId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const studiosQuery = trpc.location.studio.list.useQuery(
    { workspaceId },
    { enabled: !!workspaceId }
  );

  const stagesQuery = trpc.location.stage.list.useQuery(
    { workspaceId, studioId: selectedStudioId! },
    { enabled: !!selectedStudioId }
  );

  // Studio mutations
  const createStudio = trpc.admin.location.studio.create.useMutation({
    onSuccess: () => { utils.location.studio.list.invalidate(); setNewStudio(""); },
    onError: (e) => showToast(e.message),
  });
  const updateStudio = trpc.admin.location.studio.update.useMutation({
    onSuccess: () => { utils.location.studio.list.invalidate(); setEditingStudio(null); },
    onError: (e) => showToast(e.message),
  });
  const deleteStudio = trpc.admin.location.studio.delete.useMutation({
    onSuccess: () => {
      utils.location.studio.list.invalidate();
      setSelectedStudioId(null);
      setConfirmDeleteStudio(null);
    },
    onError: (e) => showToast(e.message),
  });

  // Stage mutations
  const createStage = trpc.admin.location.stage.create.useMutation({
    onSuccess: () => { utils.location.stage.list.invalidate(); setNewStage(""); },
    onError: (e) => showToast(e.message),
  });
  const updateStage = trpc.admin.location.stage.update.useMutation({
    onSuccess: () => { utils.location.stage.list.invalidate(); setEditingStage(null); },
    onError: (e) => showToast(e.message),
  });
  const deleteStage = trpc.admin.location.stage.delete.useMutation({
    onSuccess: () => { utils.location.stage.list.invalidate(); setConfirmDeleteStage(null); },
    onError: (e) => showToast(e.message),
  });

  const [newStudio,            setNewStudio]            = useState("");
  const [editingStudio,        setEditingStudio]        = useState<{ id: string; name: string } | null>(null);
  const [confirmDeleteStudio,  setConfirmDeleteStudio]  = useState<{ id: string; name: string } | null>(null);

  const [newStage,             setNewStage]             = useState("");
  const [editingStage,         setEditingStage]         = useState<{ id: string; name: string } | null>(null);
  const [confirmDeleteStage,   setConfirmDeleteStage]   = useState<{ id: string; name: string } | null>(null);

  const studios = studiosQuery.data ?? [];
  const stages  = stagesQuery.data ?? [];
  const filteredStudios = studios.filter((s) =>
    !search.trim() || s.name.toLowerCase().includes(search.toLowerCase())
  );
  const selectedStudio = studios.find((s) => s.id === selectedStudioId) ?? null;

  return (
    <>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-surface-dark text-white text-[12px] font-semibold px-4 py-2.5 rounded-card shadow-device">
          {toast}
        </div>
      )}

      <SettingsPageShell
        title="Locations"
        description="Studios and stages equipment can be issued to. Add the places your team works."
      >
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4">
          {/* LEFT — Studios */}
          <SettingsSection
            title={`Studios (${studios.length})`}
            description="Top-level venue where equipment gets issued."
          >
            {/* Add studio */}
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newStudio}
                onChange={(e) => setNewStudio(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newStudio.trim()) {
                    createStudio.mutate({ workspaceId, name: newStudio.trim(), displayId: slugify(newStudio.trim()) });
                  }
                }}
                placeholder="Add studio…"
                className="flex-1 bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue"
              />
              <Button
                size="sm" variant="primary"
                disabled={!newStudio.trim() || createStudio.isPending}
                onClick={() => createStudio.mutate({ workspaceId, name: newStudio.trim(), displayId: slugify(newStudio.trim()) })}
              >
                <Plus size={14} />
              </Button>
            </div>

            {/* Search */}
            {studios.length > 4 && (
              <input
                type="search"
                placeholder="Search studios…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue mb-3"
              />
            )}

            {/* Studios list */}
            {studios.length === 0 ? (
              <div className="text-center py-8 text-[12px] text-grey">
                <Building2 size={20} className="mx-auto mb-2 text-grey-mid" />
                No studios yet &mdash; add your first above.
              </div>
            ) : filteredStudios.length === 0 ? (
              <div className="text-center py-6 text-[12px] text-grey">
                No matches for &ldquo;{search}&rdquo;.
              </div>
            ) : (
              <div className="border border-grey-mid rounded-card overflow-hidden divide-y divide-grey-mid max-h-[480px] overflow-y-auto">
                {filteredStudios.map((studio) => {
                  const isSelected = selectedStudioId === studio.id;
                  const isEditing  = editingStudio?.id === studio.id;
                  const pendingDelete = confirmDeleteStudio?.id === studio.id;

                  if (pendingDelete) {
                    return (
                      <div key={studio.id} className="px-3 py-2.5 bg-status-red/5">
                        <p className="text-[12px] text-status-red font-semibold mb-2">
                          Delete &ldquo;{studio.name}&rdquo; and all its stages?
                        </p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="destructive"
                            onClick={() => deleteStudio.mutate({ studioId: studio.id, workspaceId })}>
                            Delete
                          </Button>
                          <Button size="sm" variant="secondary"
                            onClick={() => setConfirmDeleteStudio(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={studio.id}
                      onClick={() => !isEditing && setSelectedStudioId(studio.id)}
                      className={[
                        "flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors",
                        isSelected ? "bg-brand-blue/10" : "hover:bg-grey-light",
                      ].join(" ")}
                    >
                      {isEditing ? (
                        <>
                          <input
                            type="text"
                            value={editingStudio!.name}
                            onChange={(e) => setEditingStudio({ ...editingStudio!, name: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") updateStudio.mutate({ studioId: studio.id, workspaceId, name: editingStudio!.name.trim() });
                              if (e.key === "Escape") setEditingStudio(null);
                            }}
                            className="flex-1 bg-white border border-brand-blue rounded-btn px-2 py-1 text-[13px] focus:outline-none"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button onClick={(e) => { e.stopPropagation(); updateStudio.mutate({ studioId: studio.id, workspaceId, name: editingStudio!.name.trim() }); }} className="text-status-green p-1">
                            <Check size={14} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setEditingStudio(null); }} className="text-grey p-1">
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className={`flex-1 text-[13px] truncate ${isSelected ? "font-semibold text-brand-blue" : "text-surface-dark"}`}>
                            {studio.name}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingStudio({ id: studio.id, name: studio.name }); }}
                            className="text-grey hover:text-brand-blue p-1"
                            aria-label="Rename"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteStudio({ id: studio.id, name: studio.name }); }}
                            className="text-grey hover:text-status-red p-1"
                            aria-label="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </SettingsSection>

          {/* RIGHT — Stages */}
          <SettingsSection
            title={selectedStudio ? `Stages · ${selectedStudio.name}` : "Stages"}
            description={selectedStudio ? "Individual stages inside this studio." : "Pick a studio to manage its stages."}
          >
            {!selectedStudio ? (
              <div className="text-center py-10 text-[12px] text-grey">
                <Layers size={22} className="mx-auto mb-2 text-grey-mid" />
                Select a studio on the left.
              </div>
            ) : (
              <>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newStage}
                    onChange={(e) => setNewStage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newStage.trim()) {
                        createStage.mutate({ workspaceId, studioId: selectedStudio.id, name: newStage.trim() });
                      }
                    }}
                    placeholder="Add stage…"
                    className="flex-1 bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue"
                  />
                  <Button
                    size="sm" variant="primary"
                    disabled={!newStage.trim() || createStage.isPending}
                    onClick={() => createStage.mutate({ workspaceId, studioId: selectedStudio.id, name: newStage.trim() })}
                  >
                    <Plus size={14} />
                  </Button>
                </div>

                {stagesQuery.isLoading ? (
                  <SkeletonRows count={3} />
                ) : stages.length === 0 ? (
                  <div className="text-center py-8 text-[12px] text-grey">
                    <Layers size={20} className="mx-auto mb-2 text-grey-mid" />
                    No stages yet &mdash; add the first above.
                  </div>
                ) : (
                  <div className="border border-grey-mid rounded-card overflow-hidden divide-y divide-grey-mid max-h-[480px] overflow-y-auto">
                    {stages.map((stage) => {
                      const isEditing     = editingStage?.id === stage.id;
                      const pendingDelete = confirmDeleteStage?.id === stage.id;

                      if (pendingDelete) {
                        return (
                          <div key={stage.id} className="px-3 py-2.5 bg-status-red/5">
                            <p className="text-[12px] text-status-red font-semibold mb-2">
                              Delete stage &ldquo;{stage.name}&rdquo;?
                            </p>
                            <div className="flex gap-2">
                              <Button size="sm" variant="destructive"
                                onClick={() => deleteStage.mutate({ stageId: stage.id, workspaceId })}>
                                Delete
                              </Button>
                              <Button size="sm" variant="secondary"
                                onClick={() => setConfirmDeleteStage(null)}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={stage.id} className="flex items-center gap-2 px-3 py-2 hover:bg-grey-light transition-colors">
                          {isEditing ? (
                            <>
                              <input
                                type="text"
                                value={editingStage!.name}
                                onChange={(e) => setEditingStage({ ...editingStage!, name: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") updateStage.mutate({ stageId: stage.id, workspaceId, name: editingStage!.name.trim() });
                                  if (e.key === "Escape") setEditingStage(null);
                                }}
                                className="flex-1 bg-white border border-brand-blue rounded-btn px-2 py-1 text-[13px] focus:outline-none"
                                autoFocus
                              />
                              <button onClick={() => updateStage.mutate({ stageId: stage.id, workspaceId, name: editingStage!.name.trim() })} className="text-status-green p-1">
                                <Check size={14} />
                              </button>
                              <button onClick={() => setEditingStage(null)} className="text-grey p-1">
                                <X size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="flex-1 text-[13px] text-surface-dark truncate">{stage.name}</span>
                              <button
                                onClick={() => setEditingStage({ id: stage.id, name: stage.name })}
                                className="text-grey hover:text-brand-blue p-1"
                                aria-label="Rename"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                onClick={() => setConfirmDeleteStage({ id: stage.id, name: stage.name })}
                                className="text-grey hover:text-status-red p-1"
                                aria-label="Delete"
                              >
                                <Trash2 size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </SettingsSection>
        </div>
      </SettingsPageShell>
    </>
  );
}
