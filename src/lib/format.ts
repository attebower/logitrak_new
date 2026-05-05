/**
 * Formatting helpers for display of DB enum values, dates, and durations.
 */

// ── Position type (LocationPicker / CheckEvent) ───────────────────────────

const POSITION_LABELS: Record<string, string> = {
  on_set:                    "On Set",
  rigged_to_outside_of_set:  "Rigged outside set",
  inside_prop_make:          "Inside Prop Make",
  in_prop_dressing:          "In Prop Dressing",
};

export function prettyPosition(v?: string | null): string | undefined {
  if (!v) return undefined;
  return POSITION_LABELS[v] ?? titleCaseEnum(v);
}

// ── Generic enum prettifier: snake_case / kebab-case → Title Case ─────────

export function titleCaseEnum(v: string): string {
  return v
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// ── Dates ─────────────────────────────────────────────────────────────────

export function formatDateTime(iso: string | Date): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day:    "numeric",
      month:  "short",
      year:   "numeric",
      hour:   "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

export function formatDate(iso: string | Date): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day:   "numeric",
      month: "short",
      year:  "numeric",
    });
  } catch {
    return String(iso);
  }
}

// ── Durations ────────────────────────────────────────────────────────────

export function durationFromNow(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  return humaniseMs(ms);
}

export function durationBetween(
  from: string | Date | null | undefined,
  to:   string | Date | null | undefined,
): string {
  if (!from || !to) return "—";
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (ms < 0) return "—";
  return humaniseMs(ms);
}

function humaniseMs(ms: number): string {
  const mins = Math.floor(ms / 60000);
  if (mins < 1)     return "just now";
  if (mins < 60)    return `${mins} min${mins !== 1 ? "s" : ""}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)     return `${hrs} hour${hrs !== 1 ? "s" : ""}`;
  const days = Math.floor(hrs / 24);
  if (days < 14)    return `${days} day${days !== 1 ? "s" : ""}`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8)    return `${weeks} week${weeks !== 1 ? "s" : ""}`;
  const months = Math.floor(days / 30);
  return `${months} month${months !== 1 ? "s" : ""}`;
}

export function locationChain(parts: (string | null | undefined)[]): string {
  const cleaned = parts.map((p) => (p ? prettyPosition(p) ?? p : null)).filter(Boolean);
  return cleaned.join(" → ");
}
