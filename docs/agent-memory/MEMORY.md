# MEMORY.md

- [Sprint 1 Frontend Scaffold](project_sprint1.md) — Next.js 14 scaffold committed; Echo design system, auth, app shell, dashboard — mocked data, Supabase stubs pending Flux env vars
- [Sprint 2 UI Pages](project_sprint2.md) — equipment, checkinout, damage, repair log, role middleware — all mock data, tRPC stubs at every data boundary
- [No arrow characters in UI](feedback_no_arrows.md) — never put "→" in labels/links; for "open/go to" affordances use chips styled like status pills
- [Use real Button components](feedback_use_real_buttons.md) — row/form actions must use Button with primary/secondary/destructive variants; never ghost/text-only for actionable controls
- [No dark mode](feedback_no_dark_mode.md) — user rejected a dark-mode toggle in 2026-04. Don't propose, build, or reference it again unless they ask.
- [Roles and access model](project_roles_access_model.md) — owner owns assets; operators get basic ops only, no Cross Hire (except check-in returns); project-scoping not yet schema-backed
- [Cross hire feature status](project_cross_hire_status.md) — drawer pattern, deletion-on-cancel, weekly discount, invoice + equipment-list PDFs, end-date derivation; weeklyRate column actually stores discount %
- [Invite flow + RBAC plan](project_invite_flow_plan.md) — Phase 1 (schema + invite UI + project Crew) SHIPPED; Phase 2 (query enforcement) still pending — operators can still see other projects' data
- [Mobile build kicked off](project_mobile_build_kicked_off.md) — separate session in ~/logitrak-mobile; expect 3 endpoint requests (dashboard.projectStats, push.register/unregisterToken, project.sets.uploadAttachment)
