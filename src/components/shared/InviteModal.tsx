/**
 * LogiTrak InviteModal Component
 * Modal for inviting a new team member. Email input + role selector.
 * Pending invites list shown below the form.
 *
 * Usage:
 *   <InviteModal
 *     isOpen={showInvite}
 *     onClose={() => setShowInvite(false)}
 *     onSendInvite={async ({ email, role }) => await sendInvite({ email, role })}
 *     pendingInvites={pendingInvites}
 *     onCancelInvite={(id) => cancelInvite(id)}
 *   />
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RoleBadge, ROLE_OPTIONS } from "./RoleBadge";
import type { WorkspaceRole } from "./RoleBadge";
import { cn } from "@/lib/utils";

// ── Data shapes ───────────────────────────────────────────────────────────

export interface PendingInvite {
  id:        string;
  email:     string;
  role:      WorkspaceRole;
  sentAt:    string; // ISO string
}

export interface InvitePayload {
  email: string;
  role:  WorkspaceRole;
}

// ── Component ─────────────────────────────────────────────────────────────

export interface InviteModalProps {
  isOpen:          boolean;
  onClose:         () => void;
  onSendInvite:    (payload: InvitePayload) => Promise<void>;
  pendingInvites?: PendingInvite[];
  onCancelInvite?: (id: string) => void;
}

export function InviteModal({
  isOpen,
  onClose,
  onSendInvite,
  pendingInvites = [],
  onCancelInvite,
}: InviteModalProps) {
  const [email, setEmail]   = useState("");
  const [role, setRole]     = useState<WorkspaceRole>("operator");
  const [sending, setSending] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  async function handleSend() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await onSendInvite({ email: trimmed, role });
      setEmail("");
      setRole("operator");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send invite. Try again.");
    } finally {
      setSending(false);
    }
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        aria-hidden
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Invite team member"
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white rounded-panel shadow-device"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-grey-mid">
          <h2 className="text-[16px] font-bold text-surface-dark">Invite team member</h2>
          <button
            onClick={onClose}
            className="text-grey hover:text-surface-dark text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* ── Form ── */}
        <div className="px-6 py-5 space-y-4">
          {/* Email */}
          <div>
            <label className="block text-caption text-grey uppercase mb-1.5">
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
            {error && (
              <p className="text-[11px] text-status-red mt-1">{error}</p>
            )}
          </div>

          {/* Role */}
          <div>
            <label className="block text-caption text-grey uppercase mb-1.5">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as WorkspaceRole)}
              className="w-full bg-grey-light border-[1.5px] border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue"
            >
              {ROLE_OPTIONS.filter((r) => r.value !== "owner").map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <p className="text-[11px] text-grey mt-1.5">
              {roleHelpText[role]}
            </p>
          </div>

          {/* Send button */}
          <Button
            variant="primary"
            onClick={handleSend}
            disabled={sending || !email.trim()}
            className="w-full"
          >
            {sending ? "Sending…" : "Send invite"}
          </Button>
        </div>

        {/* ── Pending invites ── */}
        {pendingInvites.length > 0 && (
          <div className="border-t border-grey-mid">
            <div className="px-6 py-3">
              <p className="text-caption text-grey uppercase">
                Pending invites ({pendingInvites.length})
              </p>
            </div>
            <ul className="max-h-48 overflow-y-auto">
              {pendingInvites.map((invite) => (
                <li
                  key={invite.id}
                  className="flex items-center gap-3 px-6 py-2.5 border-t border-grey-mid first:border-t-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-surface-dark truncate">
                      {invite.email}
                    </div>
                    <div className="text-[11px] text-grey">
                      Sent {formatDate(invite.sentAt)}
                    </div>
                  </div>
                  <RoleBadge role={invite.role} />
                  {onCancelInvite && (
                    <button
                      onClick={() => onCancelInvite(invite.id)}
                      className="text-[11px] text-grey hover:text-status-red transition-colors flex-shrink-0"
                      aria-label={`Cancel invite for ${invite.email}`}
                    >
                      Cancel
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

const roleHelpText: Record<WorkspaceRole, string> = {
  owner:     "Full access including billing. Typically one per workspace.",
  admin:     "Can manage equipment, team, and settings. Cannot manage billing.",
  manager:   "Can check equipment in/out, run reports, and manage locations.",
  operator:  "Can check equipment in/out and report damage. Cannot manage settings.",
  "read-only": "Can view equipment and reports. Cannot make any changes.",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch {
    return iso;
  }
}
