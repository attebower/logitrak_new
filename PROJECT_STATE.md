# PROJECT_STATE.md

## Sprint 3 — Wiring & Polish (2026-04-17)

### Status: Complete ✅

---

## Sprint 1 — Frontend Scaffold (2026-04-14) ✅

### Completed by Nova
- [x] Next.js 14 app scaffolded (TypeScript + Tailwind + shadcn/ui deps)
- [x] Echo design tokens (tailwind.config.ts) — exact copy
- [x] Echo components: Badge, Button, StatCard, StatGrid, AppSidebar, AppTopbar
- [x] App shell: sidebar nav + topbar + responsive layout (sidebar desktop-only)
- [x] Auth pages: sign-in (email/password + magic link tabs), sign-up
- [x] Onboarding wizard: step 1 live (dept name + industry type), steps 2-4 stubbed
- [x] Dashboard: stat cards, activity feed, Quick Actions grid (mock data)
- [x] Supabase client/server stubs

---

## Sprint 2 — tRPC Integration (2026-04-15) ✅

### Completed by Nova + Sage
- [x] All dashboard pages wired to live tRPC routes
- [x] Equipment, Damage, Check-in/out pages fully functional
- [x] Team + Settings + Billing pages wired
- [x] Auth flow integrated with Supabase

---

## Sprint 3 — Wiring & Polish (2026-04-17) ✅

### Completed by Nova

**BUG-019 — Middleware role gate (cd56ffa)**
- `src/middleware.ts`: replaced `app_metadata.role` stub with live DB query
- Queries `workspace_users` via Supabase client (Edge-compatible)
- Admin allow-list: `["owner", "admin", "manager"]`
- Non-admin users blocked from `/admin`, `/team`, `/settings` at page level

**workspace.update + Settings (02f0937)**
- `workspace.update` tRPC procedure added (Admin+)
- Settings page Save Changes wired to live mutation (was fake delay stub)
- `INDUSTRY_OPTIONS` corrected to match Prisma `IndustryType` enum (`film_tv | events`)

**Check-in auto damage reports (02f0937)**
- `checkinout/page.tsx` `handleInConfirm` creates `damage.report` for each item flagged damaged

**TODO cleanup (e7b65bf)**
- Equipment page Report Damage button → `/damage?equipmentId=` (was no-op)
- Damage page reads `?equipmentId` searchParam, pre-fills equipment label
- Billing page: real `equipmentCount` + `memberCount` from `trpc.workspace.get` (was hardcoded)

**Visual polish — Echo brief (5510e97)**
- Emoji → Lucide icons across all 6 files (StatCard, layout, MobileBottomNav, dashboard)
- Quick actions grid: `gap-px bg-grey-mid` → `gap-3 p-4`, rounded cards with brand-blue hover
- Activity feed timestamps: `text-right`
- AppTopbar context: plain span → `/ divider + subdued label`
- Landing page features array: hardcoded hex → design tokens
- Pricing badge: `bg-[#1B4FD8]` → `bg-brand-blue`

### Current State
- `tsc --noEmit`: ✅ zero errors (all commits)
- Branch: `dev` — all changes pushed to `origin/dev`
- No outstanding TODO comments in app pages
- `workspace.delete` intentionally stubbed (destructive; UI guard exists; deferred to Sprint 4)

---

## Sprint 4 — TBD

### Waiting On
- Atlas: Sprint 4 scope
