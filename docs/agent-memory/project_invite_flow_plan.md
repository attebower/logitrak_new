---
name: Invite flow + RBAC — Phase 1 SHIPPED, Phase 2 still pending
description: Two-tier invite (Admin = full / User = specific projects) with schema + invite UI + project-page Crew section built. Query enforcement (Phase 2) not yet wired — operators can still see other projects' data.
type: project
originSessionId: facd680a-5a17-4f92-ba12-4ccc18f3af43
---
Plan agreed with the user on 2026-04-27. **Phase 1 is shipped. Phase 2 is not.**

## What was built (Phase 1, on `dev` branch as of 2026-04-27)

- Schema: `ProjectMembership` join + `WorkspaceInvitation.projectIds String[]` + relations on `WorkspaceUser` and `Project`. Pushed via `prisma db push`.
- Server (`src/server/routers/team.ts`): `invite` accepts `projectIds`; `acceptInvite` upserts memberships; `list` returns each member's `projects[]`; new `setMemberProjects`, `addMemberToProject`, `removeMemberFromProject`, `listProjectMembers` (all admin/owner gated).
- UI: `/team` invite modal has Admin/User scope toggle + project chips; member rows show project chips inline; Manage modal handles role + projects in one save. `/projects` Project Detail has a new Crew section under Sets.

## What's still pending (Phase 2)

- **Query enforcement.** Project-scoped users can still see other projects' data because the equipment / cross-hire / damage / report list queries don't filter by accessible project IDs. Operators get full read on everything in the workspace.
- A `ctx.accessibleProjectIds` helper on the tRPC context, computed once per request, would make this less repetitive when wiring the gate.
- Hide Cross Hire surfaces (sidebar entry, dashboard widget, stat card, quick action) for `operator` role.
- Consider an "Invite from project" flow on the Project Detail page — open the existing InviteModal pre-filled with this project so PMs don't have to bounce to /team.

The original plan (kept below for reference):

**The model** (per the access-model memory):
- **Owner** owns the workspace and all assets.
- **Admin** = full workspace access.
- **Operator (project-scoped)** = only the projects they've been added to. No Cross Hire surfaces (except returning cross-hired items via `/return`, which goes through `checkEvent.checkIn` and is fine for operators).

**Phase 1 — invite UX + data (chosen by user, ship first)**
Schema additions (Prisma migration):
- `ProjectMembership { id, workspaceUserId, projectId, createdAt }` with `@@unique([workspaceUserId, projectId])`.
- `WorkspaceInvitation.projectIds` — either `String[]` or a normalised `InvitationProject` join. Pick whichever's lighter; the user didn't specify.

Server (`src/server/routers/team.ts`):
- `team.invite` accepts `role: "admin" | "operator"` + optional `projectIds[]`. Reject `projectIds` when role=admin (admins are workspace-wide).
- `team.acceptInvite` creates the `ProjectMembership` rows from the invite's `projectIds` after the `WorkspaceUser` is upserted.
- New `team.updateMemberProjects` for editing scope post-acceptance.
- `team.list` includes each member's `projectMemberships` so the UI can render scope.

UI:
- Onboarding step 2 (`src/app/(onboarding)/onboarding/page.tsx`): per-row scope toggle — **Admin** (full) or **Projects** (multi-select chips of existing workspace projects). Skippable as today.
- Settings → Team: same scope picker in the invite modal. Member rows show their scope ("Admin" or "Projects: A, B, C").

**Phase 2 — enforcement (deferred, second pass)**
Until Phase 2 ships, the schema is a paper trail; project-scoped users can still see other projects' data via the existing tRPC list queries. Phase 2 is gating those queries:
- Equipment / damage / check-event / cross-hire list queries take the user's accessible-project-ids into account.
- Sidebar / dashboard widgets / quick actions hide Cross Hire for `operator` (already noted in `project_roles_access_model.md`).
- A `ctx.accessibleProjectIds` helper on the tRPC context, computed once per request, would make this less repetitive.

**Why both phases:** Building Phase 2 alongside Phase 1 risks accidentally hiding data from owners and admins. Better to ship the invite UX first, validate the data model, then layer enforcement deliberately.

**How to apply:**
- When the user says "let's do that" (the invite flow), start with the schema migration, then the team router, then onboarding, then Settings/Team. The detail-page-style chip multi-select pattern (used in /cross-hire/new) is a good fit for the project picker.
- Don't ship Phase 1 without an explicit "Phase 2 needed for enforcement" note in the commit/PR body so it's not accidentally treated as complete.
