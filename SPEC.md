# LogiTrak — Phone App Spec

> Build spec for the **native mobile companion** to the LogiTrak desktop SaaS. The desktop app (`logitrak_new` repo, `dev` branch) is the source of truth for data, billing, settings, and admin work. This phone app lets operators do the on-set jobs without firing up a laptop.

---

## 1. Goal

Operators on a film/TV/event/touring production should be able to:

- Sign in to their workspace.
- See the projects they're a member of.
- Issue a piece of kit to a destination.
- Return kit (and flag damage if needed).
- Look up any item by serial.
- Get a project-scoped overview of what's where.

That's it. **Nothing else lives on the phone.**

## 2. Stack

**Decision (2026-04-29): React Native via Expo.**

- Real native codebase, native camera + barcode SDK, native push, OTA updates without re-reviewing.
- Expo Router for navigation, Expo Application Services (EAS) for builds + App Store / Play submission.
- TypeScript throughout.

**Backend (no change):** the phone app calls the same tRPC API (`logitrak-app` Next.js repo), uses the same Supabase Auth, talks to the same Postgres. **No separate backend.** Authentication uses the existing Supabase JWT issued at sign-in; the tRPC client attaches the bearer token to every request.

**Recommended libraries:**

- `@trpc/react-query` + `@tanstack/react-query` — same as desktop. Reuse the AppRouter types via a path alias or shared workspace package.
- `@supabase/supabase-js` with `expo-secure-store` adapter for session persistence.
- `nativewind` — Tailwind classes in React Native (keeps the design language consistent with desktop).
- `expo-camera` + `expo-barcode-scanner` for camera scanning.
- `expo-notifications` for push (registration + handling).
- `expo-linking` / Expo Router for deep links + universal links.
- `react-native-reanimated` for the row-flash and other transitions.

**Repo layout:** new `logitrak-mobile` repo (or `apps/mobile` in a Turborepo monorepo with the existing Next.js app). The build agent should pick whichever they prefer — both work; monorepo gives free type sharing, separate repo gives cleaner CI.

## 3. Features

### 3.1 Sign in
- Email + password (matches desktop Supabase Auth flow).
- Optional: magic-link via deep link (Resend invitation emails should open the app if installed; falls back to web).
- Persisted session via secure storage (Keychain / EncryptedSharedPreferences). No timeout — Supabase refresh tokens handle re-auth.
- Sign-up **disabled on the phone** — new owners create their workspace on the desktop; operators sign in to a workspace they've been invited to.

### 3.2 Project-scoped dashboard
The first screen after sign in. Shows a project picker at the top (the user's `ProjectMembership` rows; if exactly one, no picker — auto-selected) and below it KPIs scoped to that project:

- **Items checked out** to this project.
- **Items damaged** in the last 7 days on this project.
- **Recent activity** (last 10 events) on this project.
- **Sets covered** vs total sets on this project.

> **(NEEDS ANSWER)** Anything else operators want to glance at?

A new tRPC endpoint is needed: `dashboard.projectStats({ workspaceId, projectId })`. It mirrors the existing `dashboard.stats` but filters by project membership.

### 3.3 Issue
Same flow as desktop `/issue`:

- Scan a serial (camera-based barcode/QR by default; Bluetooth handheld scanner if connected).
- Validate the item against the same server-side rules: must be `available`, not `damaged`, not on cross-hire (existing `equipment.list` lookup is reused).
- Pick destination cascading **Studio › Stage › Set › Position**, or flat **On-location**. Existing `LocationPicker` data shapes apply.
- Confirm and fire `checkEvent.checkOut` (existing endpoint).
- Show success animation and reset for the next scan.

### 3.4 Return
Same flow as desktop `/return`:

- Scan a serial.
- Inline damage flag with description + item-location + where-noticed (matches desktop `InlineDamageEditor`).
- Cross-hired items return through the same flow — server reconciles the open `CrossHireItem` automatically (already wired desktop-side).
- Confirm fires `checkEvent.checkIn` (existing endpoint).

### 3.5 Equipment lookup
Scan or type a serial → show:

- Status (available / issued / damaged / under repair / cross-hired / retired).
- Current location (if issued).
- Item history: last 5 check-events, last damage report, last repair log.
- Cross-hire context if currently cross-hired.

Reuses `equipment.getDetail` on the existing tRPC API.

### 3.6 Projects section
Lists only the projects the operator is a member of (server filters by `ProjectMembership` for non-admins). Tapping a project drills into:

- Project meta (name, type, status, dates, notes).
- Sets list (existing project sets).
- Crew list (other members of this project).
- Equipment currently issued to this project.

> **(NEEDS ANSWER)** Confirm read-only on phone, or do operators need to add/edit sets here? Recommend **read-only v1**.

## 4. Out of scope (NOT on the phone)

The phone app is deliberately narrow. None of these ship:

- Cross hire (creation, list, detail, invoicing) — desktop only.
- Equipment register editing — `/equipment/new`, CSV import, label printing all stay desktop.
- Settings (business profile, billing, invoicing, documents, locations, categories, catalog) — desktop only.
- Team management / invitations — desktop only.
- Reports — desktop only.
- Damage admin (the queue + repair log views) — operators **flag** damage during return; the admin queue + repair-logging UI stays desktop.
- Onboarding wizard — owners onboard on desktop. Phone users land in the workspace they were invited to.

## 5. Push notifications

The desktop spec defines what events trigger push (overdue cross hire, damage report, item issued >X days, low stock, invitation accepted). The phone app is the **delivery channel**.

Build requirements:

- Register the device with APNs (iOS) / FCM (Android) on first sign-in. Persist the token on the user / workspace.
- A new tRPC endpoint: `push.registerToken({ token, platform })` and `push.unregisterToken({ token })`.
- Tap a notification → deep link into the relevant screen (e.g. damage notification opens equipment detail; overdue cross hire opens cross hire detail *on the desktop web URL*, since cross hire is desktop-only).
- Quiet hours / per-event opt-out toggles in the phone's Settings screen.

> **(NEEDS ANSWER)** Push provider: raw APNs+FCM via Expo Notifications, or OneSignal / Firebase Cloud Messaging directly?

## 6. Offline behaviour

**No offline support in v1.** When there's no connection the app shows a clear "reconnect" message and disables scanning. Scans are not queued. Reconsider once we have signal-deadzone data from real users.

## 7. Hardware

- **Camera scanner** — primary. Use the platform's barcode SDK (VisionKit on iOS, ML Kit on Android via Expo / RN modules) for QR + Code 128 + Code 39.
- **Bluetooth handheld scanner** — secondary. Treats keyboard-emulating scanners (Socket / Zebra etc.) as text input into the focused field — works the same as the desktop scan input.

> **(NEEDS ANSWER)** Any specific scanner hardware to test against (Socket S700 / Zebra MC2200 / etc.)?

## 8. Auth, sessions, deep links

- **Sign in** uses Supabase Auth email-and-password (existing). Bearer token attached to every tRPC call.
- **Magic-link** support: when a user receives a Resend invitation email, tapping the accept link should open the app if installed (universal links / app links), otherwise fall through to the desktop web flow. The token-based `team.acceptInvite` endpoint already exists.
- **Deep-link routes** to define:
  - `logitrak://invite/<token>` → accept invite + sign-in
  - `logitrak://equipment/<serial>` → equipment lookup
  - `logitrak://project/<id>` → project detail
- **Session persistence** via secure storage. No idle timeout.

## 9. UI conventions (carry from desktop)

The desktop has an established design system. Phone should feel like the same product:

- Primary blue (`#1B4FD8`), violet for cross-hire (not relevant on phone), green for success, red for damage / destructive.
- Card-based layouts with rounded corners, hairline borders, subtle shadows.
- Status pills (`text-[11px] font-semibold uppercase tracking-wider`) for asset status.
- No "→" arrow characters on buttons (project preference).
- Buttons: real button components with `primary / secondary / destructive` variants. No ghost-styled actions for primary intents.
- 5-digit serial inputs auto-fire on completion.
- Scanned-row light-green flash for ~600ms when an item joins a batch.

## 10. Tier limits

The phone respects the same workspace-level caps as the desktop (Free 1 user / 25 assets, Starter 5 / 500, Pro 20 / 10k, Enterprise unlimited). The phone doesn't show plan UI — but a user on a Free plan can still use the phone if they're the workspace owner.

## 11. Open questions for the build agent

1. ~~**Stack**~~ ✅ Decided — React Native (Expo).
2. **Push provider**: Expo Notifications, OneSignal, or direct APNs/FCM?
3. **Project-dashboard KPIs**: are the four listed enough, or anything missing?
4. **Projects section**: read-only v1 confirmed?
5. **Specific scanner hardware** to test against?
6. **App-store metadata**: name, icon, screenshots — separate task or deliver alongside?

## 12. Reference: shared backend

The phone app talks to the existing Next.js / tRPC backend. Endpoints already in place that the phone reuses:

- `equipment.list`, `equipment.getDetail`
- `checkEvent.checkOut`, `checkEvent.checkIn`
- `project.list`, `project.sets.list`
- `team.list`, `team.listProjectMembers`
- `dashboard.stats` (workspace-wide — phone needs the project-scoped version)
- `damage.report.create`
- `location.studio.list`, `location.stage.list`, `location.set.list`

New endpoints to add for the phone (small):

- `dashboard.projectStats({ workspaceId, projectId })` — KPIs scoped to one project.
- `push.registerToken({ token, platform })` / `push.unregisterToken({ token })`.
- (Optional) `equipment.lookupBySerial({ workspaceId, serial })` — if we want a single round-trip lookup vs the existing `list({ search })`.

## 13. Done state

The phone app is ready to ship to TestFlight / Play Internal Testing when:

- All 6 features in §3 work end to end against the production tRPC API.
- Push notifications fire for overdue cross hire + damage report at minimum, and tapping deep-links into the right screen.
- Sign in / sign out / session persistence works on real iOS + Android.
- Camera scanner reliably reads QR + Code 128 generated by the desktop label flow.
- Bluetooth scanner input flows into the focused scan field.
- Visual style matches §9.

Production launch (App Store + Play Store live) is a separate gate — needs marketing copy, screenshots, privacy policy URL, etc.

---

*This spec is purpose-built for a fresh agent picking up the phone-app build. The desktop product is documented in the repo's `README.md` and the `~/.claude/projects/.../memory/` files (`project_cross_hire_status.md`, `project_invite_flow_plan.md`, `project_roles_access_model.md`) — read those for context but don't try to modify the desktop from this build.*
