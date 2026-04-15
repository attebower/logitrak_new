"use client";

/**
 * Locations admin — Sprint 3 (fully wired)
 *
 * Full CRUD via trpc.location.studio/stage/set:
 *   .list / .create / .update / .delete
 *
 * Delete has an active-checkout guard server-side — CONFLICT error is surfaced as toast.
 * Rename → update with new name.
 *
 * Tree loading: studios fetched reactively, then stages+sets loaded
 * imperatively after mount using trpc utils to build the full tree for
 * LocationAdminPanel.
 */

import { useState, useEffect, useCallback } from "react";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { LocationAdminPanel } from "@/components/shared/LocationAdminPanel";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import type { StudioNode, StageNode, SetNode } from "@/components/shared/LocationAdminPanel";
import type { LocationNodeType } from "@/components/shared/LocationAdminPanel";

export default function LocationsPage() {
  const { workspaceId } = useWorkspace();
  const utils = trpc.useUtils();

  const [tree,    setTree]    = useState<StudioNode[]>([]);
  const [toast,   setToast]   = useState<{ msg: string; kind: "info" | "error" } | null>(null);

  function showToast(msg: string, kind: "info" | "error" = "info") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 4000);
  }

  // ── Load full tree ────────────────────────────────────────────────────
  // Studios are fetched reactively; stages + sets loaded imperatively so
  // we can build the nested tree structure LocationAdminPanel expects.

  const { data: studios, refetch: refetchStudios } =
    trpc.location.studio.list.useQuery({ workspaceId });

  const loadTree = useCallback(async () => {
    const studioList = await utils.location.studio.list.fetch({ workspaceId });
    const studioNodes: StudioNode[] = await Promise.all(
      studioList.map(async (studio) => {
        const stageList = await utils.location.stage.list.fetch({
          workspaceId,
          studioId: studio.id,
        });
        const stageNodes: StageNode[] = await Promise.all(
          stageList.map(async (stage) => {
            const setList = await utils.location.set.list.fetch({
              workspaceId,
              stageId: stage.id,
            });
            const setNodes: SetNode[] = setList.map((s) => ({ id: s.id, name: s.name }));
            return { id: stage.id, name: stage.name, sets: setNodes };
          })
        );
        return { id: studio.id, name: studio.name, stages: stageNodes };
      })
    );
    setTree(studioNodes);
  }, [workspaceId, utils]);

  useEffect(() => {
    if (studios) { void loadTree(); }
  }, [studios, loadTree]);

  // ── Mutations ─────────────────────────────────────────────────────────

  const createStudio = trpc.location.studio.create.useMutation({
    onSuccess: () => { void refetchStudios(); void loadTree(); },
    onError:   (err) => showToast(err.message, "error"),
  });

  const updateStudio = trpc.location.studio.update.useMutation({
    onSuccess: () => { void loadTree(); },
    onError:   (err) => showToast(err.message, "error"),
  });

  const deleteStudio = trpc.location.studio.delete.useMutation({
    onSuccess: () => { void refetchStudios(); void loadTree(); },
    onError:   (err) => showToast(err.message, "error"),
  });

  const createStage = trpc.location.stage.create.useMutation({
    onSuccess: () => { void loadTree(); },
    onError:   (err) => showToast(err.message, "error"),
  });

  const updateStage = trpc.location.stage.update.useMutation({
    onSuccess: () => { void loadTree(); },
    onError:   (err) => showToast(err.message, "error"),
  });

  const deleteStage = trpc.location.stage.delete.useMutation({
    onSuccess: () => { void loadTree(); },
    onError:   (err) => showToast(err.message, "error"),
  });

  const createSet = trpc.location.set.create.useMutation({
    onSuccess: () => { void loadTree(); },
    onError:   (err) => showToast(err.message, "error"),
  });

  const updateSet = trpc.location.set.update.useMutation({
    onSuccess: () => { void loadTree(); },
    onError:   (err) => showToast(err.message, "error"),
  });

  const deleteSet = trpc.location.set.delete.useMutation({
    onSuccess: () => { void loadTree(); },
    onError:   (err) => showToast(err.message, "error"),
  });

  // ── Handler wrappers ──────────────────────────────────────────────────

  async function handleRename(type: LocationNodeType, id: string, name: string) {
    if (type === "studio") {
      await updateStudio.mutateAsync({ workspaceId, studioId: id, name });
    } else if (type === "stage") {
      await updateStage.mutateAsync({ workspaceId, stageId: id, name });
    } else {
      await updateSet.mutateAsync({ workspaceId, setId: id, name });
    }
  }

  async function handleDelete(type: LocationNodeType, id: string) {
    if (type === "studio") {
      await deleteStudio.mutateAsync({ workspaceId, studioId: id });
    } else if (type === "stage") {
      await deleteStage.mutateAsync({ workspaceId, stageId: id });
    } else {
      await deleteSet.mutateAsync({ workspaceId, setId: id });
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <>
      <AppTopbar title="Locations" />

      {/* Toast */}
      {toast && (
        <div className={[
          "fixed bottom-6 right-6 z-50 text-[12px] font-semibold px-4 py-2.5 rounded-card shadow-device max-w-sm",
          toast.kind === "error"
            ? "bg-status-red text-white"
            : "bg-surface-dark text-white",
        ].join(" ")}>
          {toast.msg}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl">
          <p className="text-[13px] text-grey mb-5">
            Manage studios, stages, and sets. These are used in the check-out flow to record where equipment is going.
            Deleting a location with active equipment checked out is blocked until the equipment is returned.
          </p>

          <LocationAdminPanel
            studios={tree}
            onAddStudio={async (name) => {
              await createStudio.mutateAsync({ workspaceId, name });
            }}
            onAddStage={async (studioId, name) => {
              await createStage.mutateAsync({ workspaceId, studioId, name });
            }}
            onAddSet={async (stageId, name) => {
              await createSet.mutateAsync({ workspaceId, stageId, name });
            }}
            onRename={handleRename}
            onDelete={handleDelete}
          />
        </div>
      </div>
    </>
  );
}
