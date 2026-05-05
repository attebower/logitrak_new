---
name: Cross hire feature — status as of 2026-04-27
description: Cross-hire flow shipped end-to-end (drawer pattern, deletion-on-cancel, weekly discount, invoice/equipment-list PDFs, end-date derivation). Cancellation now permanently deletes.
type: project
originSessionId: facd680a-5a17-4f92-ba12-4ccc18f3af43
---
Where the cross-hire feature is as of the end of session on 2026-04-27.

**Behaviour**
- `/cross-hire` list, `/cross-hire/new` form, `/cross-hire/[id]` detail page, `/cross-hire/rental-rates` all live.
- Detail page redesigned as a "document" layout: hero with status / invoice number / status pill in the eyebrow, big production title, action row with Create Invoice and Create Equipment List buttons, summary tiles (items on hire, days, daily rate, period total), customer + terms cards, items table with totals, danger zone bottom card.
- List rows are clickable and open `CrossHireDetailPanel` — the same drawer pattern as Equipment Register. Drawer groups items by product name; multi-item groups expand to reveal serials.
- Cancelling a cross hire **permanently deletes** the event (CrossHireItem rows cascade-delete via schema). Items still on hire flip back to `available`. Detail page redirects to `/cross-hire`; drawer closes. The `cancelled` status enum value is now dead but harmless.
- Issue/Return split into `/issue` and `/return`. Cross-hired items can be returned via `/return` and the `checkEvent.checkIn` mutation auto-reconciles the corresponding `CrossHireItem.returnedAt` and flips the event to `returned` if it was the last outstanding item.

**Why:** This is the work the user has been iterating on through this session — they want cross hire to feel like a real commercial flow with proper documents and clean lifecycle.

**How to apply:**
- When touching cross hire, keep the document-style layout consistent (hero + summary tiles + sectioned cards).
- Weekly rate logic: `CrossHireItem.weeklyRate` actually stores a **discount percentage (0–100)** despite the column name. Apply as `lineGross × (1 − pct/100)` only when `totalDays >= 7`. This is reflected in the detail page period total, the totals footer, and the invoice PDF (per-line discount note + Gross/Discount/Subtotal in the totals block).
- `endDate` is now always derived on save: explicit if the user picked one, otherwise `startDate + totalDays`. Display layer also has a fallback for any remaining null rows. Don't go back to the "endDate optional" model.
- One-off scripts in `scripts/` for reconcile/backfill/purge — they take `set -a; source .env.local; set +a; npx tsx scripts/...` to load DB env. Idempotent.
