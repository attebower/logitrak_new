---
name: No "→" arrow characters in UI strings
description: User dislikes arrow characters (→, ⇒, ➝) in button labels, link text, and UI copy. Prefer chips, icons, or plain text instead.
type: feedback
originSessionId: facd680a-5a17-4f92-ba12-4ccc18f3af43
---
Don't use "→" (or other arrow characters) in button labels, link text, or any UI strings. The user finds them visually noisy.

**Why:** Stated preference — they explicitly said "i dont like the arrows --> that have been used through" while reviewing the cross-hire / equipment UI in 2026-04. They asked to convert an arrow-suffixed link into a chip instead.

**How to apply:**
- When writing new UI text in this project, never append "→" to button or link labels (e.g. write "Issue 3 items" instead of "Issue 3 items →", "Open cross hire" instead of "Open cross hire →").
- When refactoring existing UI, strip arrow suffixes wherever you see them.
- For "go to / open / back" affordances, default to the `<Button variant="primary" size="sm">` blue button (wrapped in `<Link href>` when navigating). No leading icon, no arrow suffix — just the destination label (e.g. "All Cross Hires", "Open page"). Don't reach for `variant="ghost"`, `variant="secondary"`, or a chip/pill unless the user has asked for that specific styling. Reason: user explicitly corrected an "Open cross hire" chip → button, and a `variant="ghost"` "All Cross Hires" → primary blue, telling me to keep nav buttons consistent.
