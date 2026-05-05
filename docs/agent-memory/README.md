# Agent memory

This folder is the **portable, version-controlled copy** of context that the user wants every Claude agent to read before working on this codebase. Treat it like project lore: decisions, conventions, status snapshots, things the user has explicitly asked us not to do.

## Why this exists

Claude Code stores per-project memory at `~/.claude/projects/<path>/memory/` on the local filesystem. That works on one machine but doesn't survive a fresh `git clone`, a different laptop, or a different Claude product (web / mobile / API). Putting these files inside the repo means:

- A new agent on any machine reads them after cloning.
- They show up in PR reviews and on GitHub like any other docs.
- Git history shows when conventions changed.

## How to use it (for agents)

Read [`MEMORY.md`](./MEMORY.md) first — it's the index, with a one-line hook for each entry. Then read whichever files match the work you're about to do.

The two **most-cited** files for everyday work:

- [`feedback_*`](./) — UX conventions the user has explicitly stated (no arrows on buttons, no dark mode, use real Button components). These take precedence over generic best-practice instincts.
- [`project_*`](./) — current status of the major features and what's pending.

## How to keep it in sync (for the human)

The local `~/.claude/projects/.../memory/` folder is what Claude Code writes to during conversations. This `docs/agent-memory/` folder is what gets committed.

When new memory entries are saved during a session, they go into the local folder. Periodically (e.g. before pushing a checkpoint commit), copy the local folder's `.md` files into here:

```bash
cp ~/.claude/projects/-Users-matt-logitrak-app/memory/*.md docs/agent-memory/
git add docs/agent-memory && git commit -m "chore(memory): sync agent memory"
```

This is a manual sync — no script yet. Easy to add one if it becomes tedious.

## What does NOT live here

- Anything containing real secrets (API keys, DB passwords). The current files are clean — a quick scan before each sync is good practice.
- Conversation transcripts. Memory entries are the *distilled decisions*, not the raw chat.
- TODO lists for the immediate task — those go in conversation, not memory.
