"use client";

/**
 * Team Management — Sprint 3
 *
 * trpc.team.list            → member rows
 * trpc.team.invite          → InviteModal
 * trpc.team.listInvitations → pending invites in InviteModal
 * trpc.team.updateRole      → role change (Admin+)
 * trpc.team.deactivateMember → deactivate (Admin+)
 */

import { useState } from "react";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { Button } from "@/components/ui/button";
import { TeamMemberRow, TeamTableHead } from "@/components/shared/TeamMemberRow";
import { InviteModal } from "@/components/shared/InviteModal";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import type { TeamMember } from "@/components/shared/TeamMemberRow";
import type { WorkspaceRole } from "@/components/shared/RoleBadge";
import type { PendingInvite } from "@/components/shared/InviteModal";

// Map Prisma role → WorkspaceRole display type
function mapRole(r: string): WorkspaceRole {
  if (r === "read_only") return "read-only";
  return r as WorkspaceRole;
}

function relTime(d: Date | string | null | undefined): string {
  if (!d) return "Never";
  const ms = Date.now() - new Date(d).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function TeamPage() {
  const { workspaceId, userRole } = useWorkspace();
  const isAdmin = ["owner", "admin"].includes(userRole);

  const [showInvite,        setShowInvite]        = useState(false);
  const [roleModalMemberId, setRoleModalMemberId] = useState<string | null>(null);
  const [selectedRole,      setSelectedRole]      = useState<WorkspaceRole>("operator");
  const [actionError,       setActionError]       = useState<string | null>(null);

  // ── Queries ───────────────────────────────────────────────────────────

  const { data: members, refetch: refetchMembers } =
    trpc.team.list.useQuery({ workspaceId });

  const { data: invitations, refetch: refetchInvitations } =
    trpc.team.listInvitations.useQuery(
      { workspaceId },
      { enabled: isAdmin }
    );

  // ── Mutations ─────────────────────────────────────────────────────────

  const invite = trpc.team.invite.useMutation({
    onSuccess: () => { void refetchInvitations(); },
    onError: (err) => setActionError(err.message),
  });

  const updateRole = trpc.team.updateRole.useMutation({
    onSuccess: () => { void refetchMembers(); setRoleModalMemberId(null); },
    onError: (err) => setActionError(err.message),
  });

  const deactivate = trpc.team.deactivateMember.useMutation({
    onSuccess: () => { void refetchMembers(); },
    onError: (err) => setActionError(err.message),
  });

  // ── Map to display types ──────────────────────────────────────────────

  const memberRows: TeamMember[] = (members ?? []).map((m) => ({
    id:         m.id,
    name:       m.user.displayName ?? m.user.email,
    email:      m.user.email,
    role:       mapRole(m.role),
    status:     "active" as const,
    lastActive: relTime(m.joinedAt),
  }));

  const pendingInvites: PendingInvite[] = (invitations ?? []).map((inv) => ({
    id:     inv.id,
    email:  inv.email,
    role:   mapRole(inv.role),
    sentAt: inv.createdAt.toISOString(),
  }));

  // Role change modal member
  const roleModalMember = members?.find((m) => m.id === roleModalMemberId);

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <>
      <AppTopbar
        title="Team"
        actions={
          isAdmin && (
            <Button variant="primary" size="sm" onClick={() => setShowInvite(true)}>
              + Invite Member
            </Button>
          )
        }
      />

      <div className="flex-1 overflow-y-auto p-6">

        {actionError && (
          <div className="mb-4 bg-status-red-light border border-status-red/20 rounded-card px-4 py-3 text-[12px] text-status-red flex items-center justify-between">
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} className="text-inherit opacity-60 hover:opacity-100">×</button>
          </div>
        )}

        <div className="bg-white rounded-card border border-grey-mid shadow-card overflow-hidden">
          <table className="w-full">
            <TeamTableHead />
            <tbody>
              {(memberRows.length === 0) ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-[13px] text-grey">
                    No team members yet.
                  </td>
                </tr>
              ) : (
                memberRows.map((member) => (
                  <TeamMemberRow
                    key={member.id}
                    member={member}
                    currentUserRole={mapRole(userRole)}
                    onChangeRole={isAdmin ? (id) => {
                      setRoleModalMemberId(id);
                      const m = members?.find((x) => x.id === id);
                      if (m) setSelectedRole(mapRole(m.role));
                    } : undefined}
                    onDeactivate={isAdmin ? (id) => {
                      if (confirm("Deactivate this member? They will lose access immediately.")) {
                        deactivate.mutate({ workspaceId, memberId: id });
                      }
                    } : undefined}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite modal */}
      <InviteModal
        isOpen={showInvite}
        onClose={() => setShowInvite(false)}
        onSendInvite={async ({ email, role }) => {
          await invite.mutateAsync({ workspaceId, email, role: role === "read-only" ? "read_only" as never : role });
        }}
        pendingInvites={pendingInvites}
      />

      {/* Role change modal */}
      {roleModalMemberId && roleModalMember && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-panel w-full max-w-sm p-6 space-y-4 shadow-device">
            <h2 className="text-[16px] font-bold text-surface-dark">Change Role</h2>
            <p className="text-[13px] text-grey">
              Changing role for <strong>{roleModalMember.user.displayName ?? roleModalMember.user.email}</strong>
            </p>
            <div>
              <label className="block text-caption text-grey uppercase mb-1.5">New Role</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as WorkspaceRole)}
                className="w-full bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue"
              >
                {(["admin", "manager", "operator", "read-only"] as WorkspaceRole[]).map((r) => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary" size="sm"
                disabled={updateRole.isPending}
                onClick={() => {
                  const dbRole = selectedRole === "read-only" ? "read_only" : selectedRole;
                  updateRole.mutate({ workspaceId, memberId: roleModalMemberId, role: dbRole as never });
                }}
              >
                {updateRole.isPending ? "Saving…" : "Save Role"}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setRoleModalMemberId(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
