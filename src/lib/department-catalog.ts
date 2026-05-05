/**
 * Department-specific default category catalogs.
 *
 * Each Film & TV / live events department has its own tailored list of
 * equipment categories. When a workspace is created (or its department is
 * set/changed), these defaults can be auto-installed so users can start
 * tagging equipment immediately instead of building a taxonomy from scratch.
 *
 * Principles:
 *   - Each department sees only what's relevant to them.
 *   - No generic catch-all taxonomy.
 *   - Group name is used for visual grouping in category pickers.
 */

export type DepartmentKey =
  | "lighting"
  | "camera"
  | "sound"
  | "grip"
  | "art"
  | "costume"
  | "props"
  | "sfx"
  | "locations"
  | "production"
  | "other";

export interface CategoryDefault {
  name:      string;
  groupName: string;
}

export const DEPARTMENT_LABELS: Record<DepartmentKey, string> = {
  lighting:   "Lighting",
  camera:     "Camera",
  sound:      "Sound",
  grip:       "Grip",
  art:        "Art",
  costume:    "Costume",
  props:      "Props",
  sfx:        "Special Effects",
  locations:  "Locations",
  production: "Production",
  other:      "Other",
};

// ── Catalogs ──────────────────────────────────────────────────────────────

/** Lighting department — practical / film & TV lighting. */
const LIGHTING_CATEGORIES: CategoryDefault[] = [
  { name: "Lighting Control Equipment", groupName: "Control" },
  { name: "Power Distribution",         groupName: "Power" },
  { name: "Light Fixtures",             groupName: "Fixtures" },
  { name: "Batteries",                  groupName: "Power" },
  { name: "Power Supplies",             groupName: "Power" },
  { name: "Transmitters & Receivers",   groupName: "Wireless" },
  { name: "Voltage Regulators",         groupName: "Power" },
  { name: "Data & Networking",          groupName: "Control" },
  { name: "Lighting Drivers",           groupName: "Control" },
  { name: "Connectors & Adapters",      groupName: "Cables & Connectors" },
  { name: "Rigging & Mounting Hardware",groupName: "Rigging" },
  { name: "Dimmers",                    groupName: "Control" },
  { name: "Testing Equipment",          groupName: "Utility" },
];

// TODO: Fill these out with input from the respective departments.
// Keep lists department-specific — do not share categories across departments.
const PLACEHOLDER_CATEGORIES: CategoryDefault[] = [];

export const DEPARTMENT_CATALOG: Record<DepartmentKey, CategoryDefault[]> = {
  lighting:   LIGHTING_CATEGORIES,
  camera:     PLACEHOLDER_CATEGORIES,
  sound:      PLACEHOLDER_CATEGORIES,
  grip:       PLACEHOLDER_CATEGORIES,
  art:        PLACEHOLDER_CATEGORIES,
  costume:    PLACEHOLDER_CATEGORIES,
  props:      PLACEHOLDER_CATEGORIES,
  sfx:        PLACEHOLDER_CATEGORIES,
  locations:  PLACEHOLDER_CATEGORIES,
  production: PLACEHOLDER_CATEGORIES,
  other:      PLACEHOLDER_CATEGORIES,
};

/** Get defaults for a department — empty array if none defined or unknown key. */
export function getDepartmentCategories(key: string | null | undefined): CategoryDefault[] {
  if (!key) return [];
  const k = key.toLowerCase() as DepartmentKey;
  return DEPARTMENT_CATALOG[k] ?? [];
}
