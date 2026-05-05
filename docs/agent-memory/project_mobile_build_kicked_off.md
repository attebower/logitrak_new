---
name: Mobile build kicked off (separate session)
description: A separate Claude Code session in ~/logitrak-mobile is building the Expo/React Native phone app — three endpoint requests will land here for the desktop session to action
type: project
originSessionId: d8dd368d-2394-4eae-962a-f28d1e079b7d
---
On 2026-04-29 the user spun up a separate working directory at `~/logitrak-mobile` for the LogiTrak phone-app build (spec copied in as `SPEC.md`, agreed 12-phase plan saved to that project's auto-memory). The mobile session is hard-blocked from editing this desktop codebase per SPEC §0 — any backend change must come through this desktop session.

**Why:** SPEC enforces strict separation of mobile vs desktop builds to keep this Next.js / tRPC / Supabase product as the single source of truth and avoid two agents drifting the same code.

**How to apply:** Expect three endpoint requests to land in this session. When they arrive, treat them as normal feature work on the desktop:

1. **`dashboard.projectStats({ workspaceId, projectId })`** — mirrors `dashboard.stats` but project-scoped. Includes both all-user recent activity (last 10) and `myRecentScans` (last 10, filtered by `actorId === ctx.session.user.id`).

2. **`push.registerToken({ token, platform })` + `push.unregisterToken({ token })`** — token is the Expo push token (`ExponentPushToken[xxxx]`), not raw APNs/FCM. Needs new `PushDeviceToken` table joining tokens to users + a `sendExpoPush(tokens, payload)` helper in `src/lib/push/` posting to `https://exp.host/--/api/v2/push/send`. No APNs/FCM credentials managed here.

3. **`project.sets.uploadAttachment`** + new Supabase Storage bucket `set-attachments` (public-within-workspace).

**Optional (nice-to-have, not blocking):** `equipment.lookupBySerial({ workspaceId, serial })` — single round-trip lookup. The phone currently uses `equipment.list({ search })`.

**Related desktop-side TODO** that came up during spec drafting (NOT mobile work):
- Set snapshot history view in the project detail page — list every `SetSnapshot` row per set with timestamp + saver. Phone reads the same data so design the query to serve both surfaces.
