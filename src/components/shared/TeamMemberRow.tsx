/**
 * LogiTrak TeamMemberRow Component
 * A single row in the Team Management table.
 *
 * Shows: avatar initials, name, email, role badge, last active, actions menu.
 * Actions: change role, deactivate, resend invite (conditional on status).
 *
 * Usage:
 *   <table>
 *     <TeamTableHead />
 *     <tbody>
 *       {members.map(m => (
 *         <TeamMemberRow
 *           key={m.id}
 *           member={m}
 *           currentUserRole="admin"
 *           onChangeRole={(id) => openRoleModal(id)}
 *           onDeactivate={(id) => confirmDeactivate(id)}
 *           onResendInvite={(id) => resendInvite(id)}
 *         />
 *       ))}
 *     </tbody>
 *   </table>
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { RoleBadge } from "./RoleBadge";
import type { WorkspaceRole } from "./RoleBadge";
import { cn } from "@/lib/utils";

// ── Data shape ────────────────────────────────────────────────────────────

export type MemberStatus = "active" | "invited" | "deactivated";

export interface TeamMember {
  id:          string;
  name:        string;
  email:       string;
  role:        WorkspaceRole;
  status:      MemberStatus;
  /** Human-readable, e.g. "2h ago" or "Never" */
  lastActive?: string;
}

// ── Table head ────────────────────────────────────────────────────────────

export function TeamTableHead() {
  return (
    <thead>
      <tr>
        {["Member", "Role", "Status", "Last Active", ""].map((h) => (
          <th
            key={h}
            className="bg-grey-light px-4 py-2.5 text-left text-caption text-grey uppercase tracking-[0.03125rem] border-b border-grey-mid font-bold"
          >
            {h}
          </th>
        ))}
      </tr>
    </thead>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────

export interface TeamMemberRowProps {
  member:           TeamMember;
  /** The current logged-in user's role — used to gate actions */
  currentUserRole?: WorkspaceRole;
  onChangeRole?:    (id: string) => void;
  onDeactivate?:    (id: string) => void;
  onResendInvite?:  (id: string) => void;
  /** Optional content slotted below the member's name/email (e.g. project chips). */
  children?:        React.ReactNode;
}

const statusPill: Record<MemberStatus, { label: string; cls: string }> = {
  active:      { label: "Active",      cls: "bg-status-green-light text-status-green" },
  invited:     { label: "Invited",     cls: "bg-status-amber-light text-status-amber" },
  deactivated: { label: "Deactivated", cls: "bg-grey-mid text-grey" },
};

export function TeamMemberRow({
  member,
  currentUserRole,
  onChangeRole,
  onDeactivate,
  onResendInvite,
  children,
}: TeamMemberRowProps) {
  const pill = statusPill[member.status];

  // Derive initials
  const initials = member.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <tr className={cn(
      "border-b border-grey-mid last:border-b-0 hover:bg-brand-blue/[0.04] transition-colors",
      member.status === "deactivated" && "opacity-50"
    )}>
      {/* Member (avatar + name + email) */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-blue flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-surface-dark">{member.name}</div>
            <div className="text-[11px] text-grey">{member.email}</div>
            {children}
          </div>
        </div>
      </td>

      {/* Role */}
      <td className="px-4 py-3">
        <RoleBadge role={member.role} />
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <span className={cn(
          "inline-flex items-center rounded-badge px-2 py-0.5 text-[11px] font-semibold",
          pill.cls
        )}>
          {pill.label}
        </span>
      </td>

      {/* Last active */}
      <td className="px-4 py-3 text-[11px] text-grey">
        {member.lastActive ?? "—"}
      </td>

      {/* Actions menu */}
      <td className="px-4 py-3">
        <ActionsMenu
          member={member}
          currentUserRole={currentUserRole}
          onChangeRole={onChangeRole}
          onDeactivate={onDeactivate}
          onResendInvite={onResendInvite}
        />
      </td>
    </tr>
  );
}

// ── Actions dropdown menu ─────────────────────────────────────────────────

function ActionsMenu({
  member,
  currentUserRole,
  onChangeRole,
  onDeactivate,
  onResendInvite,
}: Pick<TeamMemberRowProps, "member" | "currentUserRole" | "onChangeRole" | "onDeactivate" | "onResendInvite">) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Owners can only be managed by other owners
  const canManage = currentUserRole === "owner" || currentUserRole === "admin";

  if (!canManage) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-grey hover:text-surface-dark text-lg leading-none px-1 rounded focus:outline-none focus:ring-2 focus:ring-brand-blue"
        aria-label={`Actions for ${member.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        ⋯
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-7 z-20 bg-white border border-grey-mid rounded-[8px] shadow-card py-1 min-w-[160px]"
        >
          {/* Change role */}
          {member.status !== "deactivated" && onChangeRole && (
            <MenuItem
              onClick={() => { onChangeRole(member.id); setOpen(false); }}
            >
              Change role…
            </MenuItem>
          )}

          {/* Resend invite */}
          {member.status === "invited" && onResendInvite && (
            <MenuItem
              onClick={() => { onResendInvite(member.id); setOpen(false); }}
            >
              Resend invite
            </MenuItem>
          )}

          {/* Deactivate / reactivate */}
          {member.status !== "deactivated" && onDeactivate && member.role !== "owner" && (
            <MenuItem
              onClick={() => { onDeactivate(member.id); setOpen(false); }}
              danger
            >
              Deactivate…
            </MenuItem>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  danger,
  children,
}: {
  onClick:  () => void;
  danger?:  boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={cn(
        "w-full text-left px-3.5 py-2 text-[13px] hover:bg-grey-light transition-colors",
        danger ? "text-status-red" : "text-surface-dark"
      )}
    >
      {children}
    </button>
  );
}
