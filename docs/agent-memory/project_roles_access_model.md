---
name: Roles and access model
description: Owner owns all assets in a workspace. Users can be added project-scoped or as workspace admin. Operators cannot use Cross Hire except check-in.
type: project
originSessionId: facd680a-5a17-4f92-ba12-4ccc18f3af43
---
The intended access model for LogiTrak workspaces:

- **Owner** is the person who buys the software / sets up the workspace. They own all assets (Equipment, Projects, CrossHireEvents, HireCustomers etc.) inside that workspace.
- Users added to the workspace come in two shapes:
  - **Project-scoped users** — added to specific projects only. They see/work with that project's stuff.
  - **Workspace admins** — full access across the whole workspace.
- **Basic users (operator role)** can do day-to-day stuff (issue/return/scan), but they **cannot use Cross Hire** for creating, viewing, cancelling, or rate management. The one exception is **checking back in a cross-hired item via `/return`** — that path is allowed because returning items shouldn't be gated.

**Why:** The user described this model on 2026-04-27 while reviewing the cross-hire flow. Cross hire is a commercial/billing surface (invoices, customer records, rates) and shouldn't be exposed to operator-level crew.

**Important refinement (2026-04-27, after building Phase 1):** The user clarified that **all assets are open to all users for issue/return** — assets are not project-scoped. The desktop app is mostly for admins; operators will primarily use a phone app for issue/return. So "what does project-scoping actually gate?" is much narrower than originally sketched:

- **Projects page (`/projects`)** — only show the projects they're a member of (so an operator on Production A doesn't see Production B in the list).
- **Cross hire surfaces** — operators don't see Cross Hire at all (sidebar, dashboard widget, stat card, quick action).
- **NOT asset-related queries** — equipment list, issue, return, damage, reports all stay open to all roles.

**How to apply:**
- Server: when adding endpoints in `src/server/routers/crossHire.ts`, gate them with `requireRole(ctx.userRole, MANAGER_ROLES)` (owner/admin/manager). The `checkEvent.checkIn` reconcile path that flips `CrossHireItem.returnedAt` is already operator-allowed and should stay that way — operators returning kit don't need cross-hire perms.
- Server: `project.list` should filter to `accessibleProjectIds` (memberships) for non-admin users. Other list queries (equipment, damage, etc.) stay workspace-wide.
- Client: hide the Cross Hire sidebar entry, dashboard widget, and quick action for users with role=`operator` (and `read_only`). The Issue/Return links stay visible.

**Current state of code (as of 2026-04-27, Phase 1 shipped):**
- `WorkspaceRole` enum has `owner | admin | manager | operator | read_only`. The helper arrays `OPERATOR_ROLES` / `MANAGER_ROLES` / `ADMIN_ROLES` are defined per-router (e.g. `checkEvent.ts:6-7`, `project.ts:6`).
- `ProjectMembership` table exists; `team.list` returns each user's project list.
- `src/server/routers/crossHire.ts` still has **no `requireRole` calls** — every endpoint is open to any authenticated workspace member. Gap to close.
- `src/server/routers/project.list` still returns every project regardless of role. Gap to close — but trivially: filter by `{ memberships: { some: { workspaceUserId: ctx.workspaceUserId } } }` for non-admins.
- Sidebar (`src/app/(app)/layout.tsx`) shows Cross Hire to all roles — needs role-aware filtering.
