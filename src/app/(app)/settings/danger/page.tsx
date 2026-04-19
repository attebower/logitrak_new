"use client";

/**
 * Settings → Advanced → Danger Zone
 *
 * Destructive actions. Owner-only gates handled at middleware + UI level.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SettingsPageShell, SettingsSection } from "@/components/shared/SettingsLayout";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";

export default function SettingsDangerPage() {
  const { workspaceId, userRole } = useWorkspace();
  const isOwner = userRole === "owner";

  const { data: workspace } = trpc.workspace.get.useQuery({ workspaceId });

  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [toast,         setToast]         = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function handleDelete() {
    if (deleteConfirm !== workspace?.name) {
      showToast("Account name doesn't match. Type it exactly to confirm.");
      return;
    }
    // TODO: wire trpc.workspace.delete when available
    showToast("Delete account — not yet implemented.");
    setDeleteConfirm("");
  }

  return (
    <>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-surface-dark text-white text-[12px] font-semibold px-4 py-2.5 rounded-card shadow-device">
          {toast}
        </div>
      )}

      <SettingsPageShell
        title="Danger Zone"
        description="Destructive actions that can&rsquo;t be undone. Handle with care."
      >
        {!isOwner ? (
          <SettingsSection title="Owner only">
            <p className="text-[13px] text-grey">Only the account owner can access danger-zone actions.</p>
          </SettingsSection>
        ) : (
          <SettingsSection
            title="Delete account"
            description="Permanently delete this account and all its data — equipment, projects, history, team members. This cannot be undone."
            variant="danger"
          >
            <div className="space-y-3">
              <p className="text-[12px] text-status-red">
                Type <strong>{workspace?.name}</strong> to confirm deletion.
              </p>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="Account name"
                className="w-full bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-status-red"
              />
              <Button
                variant="destructive" size="sm"
                disabled={deleteConfirm !== workspace?.name}
                onClick={handleDelete}
              >
                Delete Account
              </Button>
            </div>
          </SettingsSection>
        )}
      </SettingsPageShell>
    </>
  );
}
