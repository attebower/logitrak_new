/**
 * LogiTrak InviteModal Component
 *
 * Two-tier invite:
 *   - Admin   → workspace-wide access
 *   - User    → scoped to one or more projects (multi-select chips)
 *
 * Pending invites are listed below the form with their email, scope,
 * and a cancel link.
 */

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WorkspaceRole } from "./RoleBadge";
import { X, Plus } from "lucide-react";

// ── Data shapes ───────────────────────────────────────────────────────────

export interface ProjectOption {
  id:     string;
  name:   string;
  status: string;
}

export interface PendingInvite {
  id:         string;
  email:      string;
  role:       WorkspaceRole;
  sentAt:     string;
  projectIds: string[];
}

export interface InvitePayload {
  email:      string;
  role:       WorkspaceRole;
  projectIds: string[];
}

// ── Component ─────────────────────────────────────────────────────────────

export interface InviteModalProps {
  isOpen:          boolean;
  onClose:         () => void;
  onSendInvite:    (payload: InvitePayload) => Promise<void>;
  pendingInvites?: PendingInvite[];
  onCancelInvite?: (id: string) => void;
  /** Available projects in the workspace (for the project picker). */
  projects?:       ProjectOption[];
  /** Pre-select these projects when the modal opens. Useful when invoked from a project page. */
  initialProjectIds?: string[];
  /** Lock the scope to "user" — used when inviting from inside a project. */
  lockToUser?:     boolean;
}

type Scope = "admin" | "user";

export function InviteModal({
  isOpen, onClose, onSendInvite,
  pendingInvites = [], onCancelInvite,
  projects = [], initialProjectIds = [],
  lockToUser = false,
}: InviteModalProps) {
  const [email,  setEmail]  = useState("");
  const [scope,  setScope]  = useState<Scope>(lockToUser ? "user" : "admin");
  const [selectedProjects, setSelectedProjects] = useState<string[]>(initialProjectIds);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Reset form when the modal opens fresh
  useEffect(() => {
    if (isOpen) {
      setEmail("");
      setScope(lockToUser ? "user" : "admin");
      setSelectedProjects(initialProjectIds);
      setError(null);
      setShowProjectPicker(false);
    }
    // intentionally omit deps to keep this an open-event reset
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  async function handleSend() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await onSendInvite({
        email:      trimmed,
        role:       scope === "admin" ? "admin" : "operator",
        projectIds: scope === "user" ? selectedProjects : [],
      });
      setEmail("");
      setSelectedProjects(lockToUser ? initialProjectIds : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send invite. Try again.");
    } finally {
      setSending(false);
    }
  }

  function toggleProject(id: string) {
    setSelectedProjects((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
  }

  function projectsLookup(ids: string[]): ProjectOption[] {
    const map = new Map(projects.map((p) => [p.id, p]));
    return ids.map((id) => map.get(id)).filter((p): p is ProjectOption => !!p);
  }

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Invite team member"
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white rounded-panel shadow-device max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-grey-mid shrink-0">
          <h2 className="text-[16px] font-bold text-surface-dark">Invite team member</h2>
          <button
            onClick={onClose}
            className="text-grey hover:text-surface-dark text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body — scrolls if needed */}
        <div className="min-h-0 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">

            {/* Email */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-grey mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="name@studio.com"
                className={cn(
                  "w-full bg-grey-light border-[1.5px] rounded-btn px-3 py-2 text-[13px] text-surface-dark",
                  "focus:outline-none focus:border-brand-blue",
                  error ? "border-status-red" : "border-grey-mid"
                )}
                autoFocus
                autoComplete="email"
              />
              {error && <p className="text-[11px] text-status-red mt-1">{error}</p>}
            </div>

            {/* Scope */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-grey mb-1.5">
                Scope
              </label>
              <div className="grid grid-cols-2 gap-2">
                <ScopeOption
                  label="Admin"
                  description="Full access to the workspace"
                  active={scope === "admin"}
                  disabled={lockToUser}
                  onSelect={() => setScope("admin")}
                />
                <ScopeOption
                  label="User"
                  description="Specific projects only"
                  active={scope === "user"}
                  onSelect={() => setScope("user")}
                />
              </div>
            </div>

            {/* Project picker (only when scope === user) */}
            {scope === "user" && (
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-grey mb-1.5">
                  Projects {selectedProjects.length > 0 && <span className="text-grey font-normal normal-case">· {selectedProjects.length} selected</span>}
                </label>

                <div className="flex flex-wrap gap-1.5">
                  {projectsLookup(selectedProjects).map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md text-[11px] font-semibold bg-violet-100 text-violet-700"
                    >
                      {p.name}
                      <button
                        type="button"
                        onClick={() => toggleProject(p.id)}
                        className="hover:bg-violet-200 rounded p-0.5"
                        aria-label={`Remove ${p.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowProjectPicker((v) => !v)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border border-dashed border-grey-mid text-grey hover:border-brand-blue hover:text-brand-blue"
                  >
                    <Plus className="h-3 w-3" />
                    {selectedProjects.length === 0 ? "Add projects" : "Add more"}
                  </button>
                </div>

                {showProjectPicker && (
                  <div className="mt-2 border border-grey-mid rounded-btn max-h-48 overflow-y-auto">
                    {projects.length === 0 ? (
                      <p className="px-3 py-3 text-[12px] text-grey text-center">
                        No projects yet. Create one from /projects first.
                      </p>
                    ) : projects.map((p) => {
                      const checked = selectedProjects.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer hover:bg-grey-light/40 border-b border-grey-mid last:border-0"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleProject(p.id)}
                            className="rounded border-grey-mid accent-brand-blue"
                          />
                          <span className="flex-1 text-surface-dark">{p.name}</span>
                          <span className="text-[10px] text-grey uppercase tracking-wide">{p.status}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                <p className="text-[11px] text-grey mt-1.5">
                  Empty list is fine — you can add them to projects later from the project page.
                </p>
              </div>
            )}

            <Button
              onClick={handleSend}
              disabled={sending || !email.trim()}
              className="w-full"
            >
              {sending ? "Sending…" : "Send invite"}
            </Button>
          </div>

          {/* Pending invites */}
          {pendingInvites.length > 0 && (
            <div className="border-t border-grey-mid pb-3">
              <div className="px-6 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-grey">
                  Pending invites ({pendingInvites.length})
                </p>
              </div>
              <ul className="divide-y divide-grey-mid">
                {pendingInvites.map((invite) => {
                  const isAdmin = invite.role === "admin" || invite.role === "owner";
                  const inviteProjects = projectsLookup(invite.projectIds);
                  return (
                    <li key={invite.id} className="px-6 py-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-medium text-surface-dark truncate">{invite.email}</div>
                          <div className="text-[11px] text-grey">Sent {formatDate(invite.sentAt)}</div>
                        </div>
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide",
                          isAdmin ? "bg-violet-100 text-violet-700" : "bg-grey-mid text-surface-dark"
                        )}>
                          {isAdmin ? "Admin" : "User"}
                        </span>
                        {onCancelInvite && (
                          <button
                            onClick={() => onCancelInvite(invite.id)}
                            className="text-[11px] text-grey hover:text-status-red transition-colors flex-shrink-0"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                      {!isAdmin && inviteProjects.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {inviteProjects.map((p) => (
                            <span key={p.id} className="text-[10px] font-medium bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded">
                              {p.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ScopeOption({
  label, description, active, disabled, onSelect,
}: {
  label: string;
  description: string;
  active: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "text-left rounded-btn border-[1.5px] px-3 py-2.5 transition-colors",
        active
          ? "border-brand-blue bg-brand-blue/5"
          : "border-grey-mid hover:border-grey",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <div className={cn("text-[13px] font-semibold", active ? "text-brand-blue" : "text-surface-dark")}>
        {label}
      </div>
      <div className="text-[11px] text-grey mt-0.5">{description}</div>
    </button>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}
