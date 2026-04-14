# PROJECT_STATE.md

## Sprint 1 — Frontend Scaffold (2026-04-14)

### Status: Complete (pending push)

### Completed by Nova
- [x] Next.js 14 app scaffolded (TypeScript + Tailwind + shadcn/ui deps)
- [x] Echo design tokens (tailwind.config.ts) — exact copy
- [x] Echo components: Badge, Button, StatCard, StatGrid, AppSidebar, AppTopbar
- [x] App shell: sidebar nav + topbar + responsive layout (sidebar desktop-only)
- [x] Auth pages: sign-in (email/password + magic link tabs), sign-up
- [x] Onboarding wizard: step 1 live (dept name + industry type), steps 2-4 stubbed
- [x] Dashboard: stat cards, activity feed, Quick Actions grid (mock data)
- [x] Supabase client/server stubs (env vars needed from Flux)

### Waiting On
- Flux: NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
- Flux: remote repo URL for push
- Sage: tRPC layer (Sprint 2) — all data mocked for now

### Spec Compliance
- Active nav: 3px left border brand-blue (not bg-only) ✅
- Nav font-weight: 500 (medium) ✅
- Page background: #F8FAFC (grey-light) ✅
- Topbar buttons: size="sm" ✅
- Sidebar desktop-only (hidden lg:flex) ✅
