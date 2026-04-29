---
name: Use real Button components, not ghost/text-only buttons
description: For row actions and form actions in this app, use the styled Button component with primary/secondary/destructive variants — never ghost or bare text links
type: feedback
originSessionId: 289b21d8-a562-49c9-8a26-ec4272bbb472
---
When adding action affordances to list rows, table rows, modal footers, or anywhere a user clicks to do something (save, cancel, resend, delete, edit, etc.), use the `<Button>` component from `@/components/ui/button` with one of the visible variants:

- **Primary** (no variant prop, default) — confirm / save / primary CTA, blue
- **`variant="secondary"`** — neutral / supporting actions like "Resend", "Edit", filled with subtle border
- **`variant="destructive"`** — red, for cancel-the-thing / delete / deactivate
- **`variant="ghost"`** — only for nav-style affordances inside topbars (e.g. AppTopbar back/manage links). Don't use for row actions.

**Why:** the user has called this out as a recurring annoyance. Ghost/text-only buttons read as labels rather than clickable controls, especially when sitting next to data. Real buttons match the rest of the app's theme and make the actionable nature obvious.

**How to apply:** when in doubt between secondary vs destructive vs ghost for a row action — pick `secondary` or `destructive`, not `ghost`. Examples:

- Pending invites row → Resend = `secondary`, Cancel = `destructive`
- Cross hire detail → Cancel Hire = `destructive`, Open Page = primary
- Modal footer → Save = primary, Cancel = `secondary`
