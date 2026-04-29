"use client";

/**
 * Team Management
 *
 * Two-tier access:
 *   - Admin    → workspace-wide
 *   - User     → scoped to specific projects (operator role + ProjectMembership rows)
 *
 * Members are listed with their assigned projects as chips. Clicking
 * "Manage" opens a single modal where admins can change role AND
 * the project list in one save.
 */

import { useEffect, useState } from "react";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { Button } from "@/components/ui/button";
import { TeamMemberRow, TeamTableHead } from "@/components/shared/TeamMemberRow";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { InviteModal, type ProjectOption } from "@/components/shared/InviteModal";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import { cn } from "@/lib/utils";
import type { TeamMember } from "@/components/shared/TeamMemberRow";
import type { WorkspaceRole } from "@/components/shared/RoleBadge";
import type { PendingInvite } from "@/components/shared/InviteModal";
import { X, Plus } from "lucide-react";

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
  const [manageId,          setManageId]          = useState<string | null>(null);
  const [actionError,       setActionError]       = useState<string | null>(null);

  const utils = trpc.useUtils();

  const { data: members } = trpc.team.list.useQuery({ workspaceId });
  const { data: invitations } = trpc.team.listInvitations.useQuery(
    { workspaceId }, { enabled: isAdmin }
  );
  const { data: projects } = trpc.project.list.useQuery({ workspaceId });

  const projectOptions: ProjectOption[] = (projects ?? []).map((p) => ({
    id: p.id, name: p.name, status: p.status,
  }));

  const invite = trpc.team.invite.useMutation({
    onSuccess: () => {
      void utils.team.listInvitations.invalidate();
      void utils.team.list.invalidate();
    },
    onError: (err) => setActionError(err.message),
  });

  const deactivate = trpc.team.deactivateMember.useMutation({
    onSuccess: () => void utils.team.list.invalidate(),
    onError:   (err) => setActionError(err.message),
  });

  const cancelInvite = trpc.team.cancelInvite.useMutation({
    onSuccess: () => void utils.team.listInvitations.invalidate(),
    onError:   (err) => setActionError(err.message),
  });

  const resendInvite = trpc.team.resendInvite.useMutation({
    onSuccess: () => void utils.team.listInvitations.invalidate(),
    onError:   (err) => setActionError(err.message),
  });

  const memberRows: TeamMember[] = (members ?? []).map((m) => ({
    id:         m.id,
    name:       m.user.displayName ?? m.user.email,
    email:      m.user.email,
    role:       mapRole(m.role),
    status:     "active" as const,
    lastActive: relTime(m.joinedAt),
  }));

  const pendingInvites: PendingInvite[] = (invitations ?? []).map((inv) => ({
    id:         inv.id,
    email:      inv.email,
    role:       mapRole(inv.role),
    sentAt:     inv.createdAt.toISOString(),
    projectIds: inv.projectIds ?? [],
  }));

  const manageMember = members?.find((m) => m.id === manageId);

  return (
    <>
      <AppTopbar
        title="Team"
        actions={
          isAdmin && (
            <Button size="sm" onClick={() => setShowInvite(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Invite member
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
              {memberRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-[13px] text-grey">
                    No team members yet.
                  </td>
                </tr>
              ) : (
                memberRows.map((member) => {
                  const raw = members?.find((m) => m.id === member.id);
                  const isWorkspaceAdmin = raw?.role === "owner" || raw?.role === "admin";
                  return (
                    <TeamMemberRow
                      key={member.id}
                      member={member}
                      currentUserRole={mapRole(userRole)}
                      onChangeRole={isAdmin ? (id) => setManageId(id) : undefined}
                      onDeactivate={isAdmin ? (id) => {
                        if (confirm("Deactivate this member? They will lose access immediately.")) {
                          deactivate.mutate({ workspaceId, memberId: id });
                        }
                      } : undefined}
                    >
                      {!isWorkspaceAdmin && raw && raw.projects.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {raw.projects.map((p) => (
                            <span key={p.id} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-700">
                              {p.name}
                            </span>
                          ))}
                        </div>
                      )}
                      {!isWorkspaceAdmin && raw && raw.projects.length === 0 && (
                        <p className="mt-1 text-[10px] text-grey italic">No project access yet</p>
                      )}
                    </TeamMemberRow>
                  );
                })
              )}

              {/* Pending invites — same table for column alignment */}
              {isAdmin && pendingInvites.length > 0 && (
                <>
                  <tr>
                    <td colSpan={5} className="bg-grey-light/60 px-4 py-2 border-b border-t border-grey-mid">
                      <p className="text-caption font-bold uppercase tracking-[0.03125rem] text-grey">
                        Pending Invites ({pendingInvites.length})
                      </p>
                    </td>
                  </tr>
                  {pendingInvites.map((inv) => {
                    const isAdminInvite  = inv.role === "admin" || inv.role === "owner";
                    const inviteProjects = (projects ?? []).filter((p) => inv.projectIds.includes(p.id));
                    const isResending    = resendInvite.isPending && resendInvite.variables?.invitationId === inv.id;
                    const isCancelling   = cancelInvite.isPending && cancelInvite.variables?.invitationId === inv.id;
                    return (
                      <tr key={inv.id} className="border-b border-grey-mid last:border-b-0 hover:bg-brand-blue/[0.04] transition-colors">
                        {/* Member — email only, no avatar */}
                        <td className="px-4 py-3">
                          <div className="text-[13px] font-semibold text-surface-dark truncate">{inv.email}</div>
                          {!isAdminInvite && inviteProjects.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {inviteProjects.map((p) => (
                                <span key={p.id} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-700">
                                  {p.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        {/* Role */}
                        <td className="px-4 py-3">
                          <RoleBadge role={mapRole(inv.role)} />
                        </td>
                        {/* Status */}
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-badge px-2 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700">
                            Pending
                          </span>
                        </td>
                        {/* Last Active → sent time */}
                        <td className="px-4 py-3 text-[11px] text-grey">
                          Sent {relTime(inv.sentAt)}
                        </td>
                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={isResending || isCancelling}
                              onClick={() => resendInvite.mutate({ workspaceId, invitationId: inv.id })}
                            >
                              {isResending ? "Resending…" : "Resend"}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={isResending || isCancelling}
                              onClick={() => {
                                if (confirm(`Cancel the invitation to ${inv.email}? They won't be able to use the existing link.`)) {
                                  cancelInvite.mutate({ workspaceId, invitationId: inv.id });
                                }
                              }}
                            >
                              {isCancelling ? "Cancelling…" : "Cancel"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <InviteModal
        isOpen={showInvite}
        onClose={() => setShowInvite(false)}
        onSendInvite={async ({ email, role, projectIds }) => {
          await invite.mutateAsync({
            workspaceId,
            email,
            role: role === "read-only" ? ("read_only" as never) : role,
            projectIds,
          });
        }}
        pendingInvites={pendingInvites}
        projects={projectOptions}
      />

      {manageId && manageMember && (
        <ManageMemberModal
          workspaceId={workspaceId}
          memberId={manageId}
          memberName={manageMember.user.displayName ?? manageMember.user.email}
          initialRole={manageMember.role}
          initialProjectIds={manageMember.projects.map((p) => p.id)}
          projects={projectOptions}
          onClose={() => setManageId(null)}
        />
      )}
    </>
  );
}

// ── Manage member modal (role + project assignments in one save) ──────────

function ManageMemberModal({
  workspaceId, memberId, memberName, initialRole, initialProjectIds, projects, onClose,
}: {
  workspaceId: string;
  memberId: string;
  memberName: string;
  initialRole: string;
  initialProjectIds: string[];
  projects: ProjectOption[];
  onClose: () => void;
}) {
  const [role,  setRole]  = useState<string>(initialRole);
  const [scope, setScope] = useState<"admin" | "user">(
    initialRole === "owner" || initialRole === "admin" ? "admin" : "user"
  );
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(initialProjectIds);
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setScope(role === "owner" || role === "admin" ? "admin" : "user");
  }, [role]);

  const utils = trpc.useUtils();
  const updateRole = trpc.team.updateRole.useMutation();
  const setProjects = trpc.team.setMemberProjects.useMutation();

  const isOwner = initialRole === "owner";

  async function handleSave() {
    setError(null);
    try {
      const dbRole = scope === "admin"
        ? "admin"
        : (role === "manager" || role === "operator" ? role : "operator");

      if (dbRole !== initialRole && !isOwner) {
        await updateRole.mutateAsync({ workspaceId, memberId, role: dbRole as never });
      }
      const finalProjectIds = scope === "admin" ? [] : selectedProjectIds;
      await setProjects.mutateAsync({ workspaceId, memberId, projectIds: finalProjectIds });

      await utils.team.list.invalidate();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }

  function toggleProject(id: string) {
    setSelectedProjectIds((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
  }

  const projectsLookup = new Map(projects.map((p) => [p.id, p]));

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white rounded-panel shadow-device max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-grey-mid">
          <div>
            <h2 className="text-[16px] font-bold text-surface-dark">Manage member</h2>
            <p className="text-[12px] text-grey mt-0.5">{memberName}</p>
          </div>
          <button onClick={onClose} className="text-grey hover:text-surface-dark text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-grey mb-1.5">Scope</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isOwner}
                onClick={() => { setScope("admin"); setRole("admin"); }}
                className={cn(
                  "text-left rounded-btn border-[1.5px] px-3 py-2.5 transition-colors",
                  scope === "admin" ? "border-brand-blue bg-brand-blue/5" : "border-grey-mid hover:border-grey",
                  isOwner && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className={cn("text-[13px] font-semibold", scope === "admin" ? "text-brand-blue" : "text-surface-dark")}>Admin</div>
                <div className="text-[11px] text-grey mt-0.5">Full workspace access</div>
              </button>
              <button
                type="button"
                disabled={isOwner}
                onClick={() => { setScope("user"); if (role === "admin" || role === "owner") setRole("operator"); }}
                className={cn(
                  "text-left rounded-btn border-[1.5px] px-3 py-2.5 transition-colors",
                  scope === "user" ? "border-brand-blue bg-brand-blue/5" : "border-grey-mid hover:border-grey",
                  isOwner && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className={cn("text-[13px] font-semibold", scope === "user" ? "text-brand-blue" : "text-surface-dark")}>User</div>
                <div className="text-[11px] text-grey mt-0.5">Specific projects only</div>
              </button>
            </div>
            {isOwner && <p className="text-[11px] text-grey mt-1.5">Owners can&apos;t be re-scoped from this screen.</p>}
          </div>

          {scope === "user" && (
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-grey mb-1.5">
                Projects {selectedProjectIds.length > 0 && <span className="text-grey font-normal normal-case">· {selectedProjectIds.length} selected</span>}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {selectedProjectIds.map((id) => {
                  const p = projectsLookup.get(id);
                  if (!p) return null;
                  return (
                    <span key={id} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md text-[11px] font-semibold bg-violet-100 text-violet-700">
                      {p.name}
                      <button type="button" onClick={() => toggleProject(id)} className="hover:bg-violet-200 rounded p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setShowPicker((v) => !v)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border border-dashed border-grey-mid text-grey hover:border-brand-blue hover:text-brand-blue"
                >
                  <Plus className="h-3 w-3" />
                  {selectedProjectIds.length === 0 ? "Add projects" : "Add more"}
                </button>
              </div>
              {showPicker && (
                <div className="mt-2 border border-grey-mid rounded-btn max-h-48 overflow-y-auto">
                  {projects.length === 0 ? (
                    <p className="px-3 py-3 text-[12px] text-grey text-center">No projects yet.</p>
                  ) : projects.map((p) => {
                    const checked = selectedProjectIds.includes(p.id);
                    return (
                      <label key={p.id} className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer hover:bg-grey-light/40 border-b border-grey-mid last:border-0">
                        <input type="checkbox" checked={checked} onChange={() => toggleProject(p.id)} className="rounded border-grey-mid accent-brand-blue" />
                        <span className="flex-1 text-surface-dark">{p.name}</span>
                        <span className="text-[10px] text-grey uppercase tracking-wide">{p.status}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {error && <p className="text-[12px] text-status-red">{error}</p>}
        </div>

        <div className="px-6 py-3 bg-grey-light/40 border-t border-grey-mid flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={updateRole.isPending || setProjects.isPending} onClick={handleSave}>
            {updateRole.isPending || setProjects.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </>
  );
}
