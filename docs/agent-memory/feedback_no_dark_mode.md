---
name: No dark mode for the desktop app
description: User trialled a Light/Auto/Dark toggle on 2026-04-29 and rejected it. Don't propose, build, or reference dark mode again unless the user asks first.
type: feedback
originSessionId: facd680a-5a17-4f92-ba12-4ccc18f3af43
---
Don't propose, build, or mention dark mode for the LogiTrak desktop app.

**Why:** Built a foundation pass on 2026-04-29 (CSS-variable colour tokens + Light/Auto/Dark segmented toggle in the sidebar). The user disliked it and asked for the buttons removed. Their words: *"lets loose the buttons and not reference that again"*. Reverted via `git checkout pre-dark-mode -- …` and removed `src/components/shared/ThemeToggle.tsx`.

**How to apply:**
- Don't volunteer dark mode as a polish suggestion or "things we could add" item.
- Don't bring it up when listing pending or future work.
- Tailwind config stays with hardcoded hex tokens (no CSS-variable rework).
- If the user explicitly asks for dark mode in the future, that overrides this — but they have to raise it.
