<div align="center">

# LogiTrak

**Equipment tracking built for film &amp; TV production.**

Track every piece of kit from stock to set, sign-out to sign-in, and lend it out on cross hire — with invoices, damage reports, and a full audit trail.

[Quick start](#quick-start) ·
[Features](#features) ·
[Tech stack](#tech-stack) ·
[Project layout](#project-layout) ·
[Contributing](#contributing)

</div>

---

## What is LogiTrak?

LogiTrak is a multi-tenant SaaS for the people who actually move kit around studios — lighting, camera, sound, grip, art, props, SFX. It replaces the spreadsheet, the scribbled hand-over note, and the "which stage is the Technocrane on?" radio call with a single live record per item.

Every asset has a 5-digit serial, a printable QR/barcode label, and a history. Every issue and return is timestamped, attributed to a crew member, and pinned to a precise location (`Studio › Stage › Set › Position`). Damage gets reported inline at check-in, repairs are logged, and items needed by another production can be cross-hired out with proper paperwork attached.

## Features

### Equipment register
- 5-digit serials with QR + barcode labels
- Native label generation for [DYMO](https://www.dymo.com), Brother QL, and StickerMule
- Categories, products (catalog), per-item notes &amp; asset value
- CSV import for bulk add
- Status tracking: available, issued, damaged, under repair, repaired, retired, cross-hired

### Issue &amp; Return
- Serial-scan flow (5-digit auto-fire) with on-screen and hardware scanner support
- Pick destination cascading `Studio › Stage › Set › Position` or "On location"
- Damage flagging happens inline on return, auto-files a damage report on confirm
- Cross-hired items can be returned through the normal flow — the active hire reconciles automatically

### Cross hire
- Loan kit out to external productions with proper customer records
- Per-product daily rates, optional weekly discount applied for hires of 7+ days
- Document-style detail page with summary tiles, progress bar, days-overdue and extra-cost-while-out
- One-click **Invoice** and **Equipment List** PDFs (handover paperwork with signature blocks)
- Cancel a hire and it's permanently deleted, items returned to stock — no zombie records

### Damage &amp; repair
- Damage reports with description, item location and where-it-was-noticed
- Repair log with repaired-by + location
- Items can't be issued while flagged damaged or under repair

### Projects, productions &amp; venues
- Active / wrapped / archived productions
- Studio &gt; Stage &gt; Set hierarchy plus flat "on-location" venues
- Set snapshot PDF — every item assigned to a set in one document

### Reports &amp; dashboard
- Live dashboard: total assets, available, checked out, damaged, cross-hired, low stock, recent activity, most used, active cross hires
- Reports page with print-ready PDF exports

### Roles &amp; access
- Workspaces with `owner`, `admin`, `manager`, `operator`, `read_only` roles
- Project-scoped membership planned (operators get only the projects they're added to) — invite UX in flight, query enforcement to follow

## Screenshots

> Drop screenshots into `docs/screenshots/` and reference them here. The empty placeholders below render fine on GitHub.

| Dashboard | Issue flow | Cross hire detail |
|---|---|---|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Issue flow](docs/screenshots/issue.png) | ![Cross hire detail](docs/screenshots/cross-hire-detail.png) |

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router, RSC where it pays) |
| Language | TypeScript |
| UI | Tailwind CSS · Radix primitives · custom design system |
| API | tRPC v11 (typesafe end-to-end) |
| Database | Postgres (Supabase) |
| ORM | Prisma 5 |
| Auth | Supabase Auth (email + magic-link) |
| PDFs | `@react-pdf/renderer` (invoices, reports, equipment lists, set snapshots) |
| Barcodes / QR | `bwip-js`, `jsbarcode`, `qrcode` |
| Billing | Stripe (subscriptions, customer portal) |
| CI | GitHub Actions (`.github/workflows/ci.yml`) |
| E2E | Playwright (`tests/`) |
| Hosting | Vercel |

## Quick start

### Prerequisites

- Node.js 20+
- npm 10+
- A Supabase project (free tier is fine)
- A Stripe account in test mode (only required for the billing flow)

### Install

```bash
git clone https://github.com/attebower/logitrak_new.git
cd logitrak_new
npm install
```

### Configure

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in the Supabase, database, and Stripe keys. The file is documented inline.

### Database

Apply the schema to your Supabase Postgres instance:

```bash
npx prisma db push
npx prisma generate
```

### Run

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000). Sign up creates a workspace; the first user is the owner.

## Project layout

```
src/
  app/
    (app)/                 # authenticated app shell
      dashboard/           # live KPI + widget grid
      issue/  return/      # check-out + check-in flows
      equipment/           # register, labels, new
      cross-hire/          # list, new, [id] detail, rental rates
      damage/              # active reports + repair log
      projects/            # productions
      reports/             # cross-cutting tables w/ PDF export
      team/  settings/     # admin
    (auth)/  (onboarding)/ # public + first-run flows
    api/                   # tRPC + REST handlers
  server/routers/          # tRPC routers (equipment, crossHire, …)
  components/              # shared/ui
  lib/                     # supabase, prisma, pdf, format, trpc
prisma/
  schema.prisma            # full data model
scripts/                   # one-off maintenance jobs (idempotent)
tests/                     # Playwright E2E
```

## Branching

| Branch | Purpose | Vercel |
|---|---|---|
| `main` | Production-ready | manual deploy |
| `staging` | Pre-production QA | auto preview |
| `dev` | Active development | none |
| `feature/*` | Per-feature branches | preview URL |

Direct pushes to `main` are not allowed. PRs into `dev` first; promote up.

## CI

`.github/workflows/ci.yml` runs on every push and PR:

1. Type-check &mdash; `tsc --noEmit`
2. Lint &mdash; `next lint`
3. Build &mdash; `next build`

All three must pass before a PR can be merged. To skip a Vercel deploy on a checkpoint commit, include `[skip ci]` in the subject line.

## E2E

```bash
npx playwright install chromium      # first time only
npx playwright test                   # run the suite
npx playwright test --ui              # interactive
npx playwright show-report            # last HTML report
```

Tests auto-start a dev server on port 3000, or reuse a running one.

## Contributing

1. Branch from `dev` (e.g. `feature/cross-hire-invoices`)
2. Open a PR back into `dev`
3. CI must pass &mdash; no warnings, no type errors
4. One review, then merge

Never commit `.env.local` or any file containing real secrets.

## License

Proprietary &mdash; all rights reserved. This is closed-source software; the repository is hosted on GitHub for collaboration only.
