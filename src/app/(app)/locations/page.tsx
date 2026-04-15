"use client";

/**
 * Locations admin — Sprint 3
 *
 * LocationAdminPanel wired to trpc.admin.location (= trpc.location) procedures:
 *   - trpc.location.studio.list/create
 *   - trpc.location.stage.list/create
 *   - trpc.location.set.list/create
 *
 * Note: rename and delete are not yet in Sage's location router.
 * Handlers are stubbed with a visible "coming soon" toast until those land.
 */

import { useState } from "react";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { LocationAdminPanel } from "@/components/shared/LocationAdminPanel";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import type { StudioNode } from "@/components/shared/LocationAdminPanel";
import type { LocationNodeType } from "@/components/shared/LocationAdminPanel";

export default function LocationsPage() {
  const { workspaceId } = useWorkspace();
  const [toast, setToast] = useState<string | null>(null);
  const utils = trpc.useUtils();

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // ── Queries ───────────────────────────────────────────────────────────

  const { data: studios } = trpc.location.studio.list.useQuery({ workspaceId });

  // Fetch all stages and sets for every studio in parallel
  // We use the studio list to drive the tree — LocationAdminPanel needs the full tree.
  // For now, build a flat structure from what we have; deep tree loads lazily.
  const studioNodes: StudioNode[] = (studios ?? []).map((s) => ({
    id:     s.id,
    name:   s.name,
    stages: [], // TODO: load stages per studio — see note below
  }));

  // ── Mutations ─────────────────────────────────────────────────────────

  const createStudio = trpc.location.studio.create.useMutation({
    onSuccess: () => { void utils.location.studio.list.invalidate({ workspaceId }); },
    onError:   (err) => showToast(`Error: ${err.message}`),
  });

  const createStage = trpc.location.stage.create.useMutation({
    onSuccess: () => { void utils.location.studio.list.invalidate({ workspaceId }); },
    onError:   (err) => showToast(`Error: ${err.message}`),
  });

  const createSet = trpc.location.set.create.useMutation({
    onSuccess: () => { void utils.location.studio.list.invalidate({ workspaceId }); },
    onError:   (err) => showToast(`Error: ${err.message}`),
  });

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <>
      <AppTopbar title="Locations" />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-surface-dark text-white text-[12px] font-semibold px-4 py-2.5 rounded-card shadow-device">
          {toast}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl">
          <p className="text-[13px] text-grey mb-5">
            Manage your studios, stages, and sets. These are used in the check-out flow to record where equipment is going.
          </p>

          <LocationAdminPanel
            studios={studioNodes}
            onAddStudio={async (name) => {
              await createStudio.mutateAsync({ workspaceId, name });
            }}
            onAddStage={async (studioId, name) => {
              await createStage.mutateAsync({ workspaceId, studioId, name });
            }}
            onAddSet={async (stageId, name) => {
              await createSet.mutateAsync({ workspaceId, stageId, name });
            }}
            onRename={async (type: LocationNodeType, _id: string, _name: string) => {
              // TODO: wire when trpc.location.studio/stage/set.rename lands
              showToast(`Rename ${type} — coming in a future sprint`);
            }}
            onDelete={async (type: LocationNodeType, _id: string) => {
              // TODO: wire when trpc.location.studio/stage/set.delete lands
              showToast(`Delete ${type} — coming in a future sprint`);
            }}
          />
        </div>
      </div>
    </>
  );
}
