/**
 * Text normalisation for equipment product names and descriptions.
 *
 * Goals:
 * - Keep naming uniform across the workspace (no "arri skypanel" vs "ARRI SKYPANEL")
 * - Preserve canonical brand/model casing (Arri, RED, ARRI, Canon, Sony, etc.)
 * - Strip extra whitespace, fix common miscapitalisation
 * - Produce a stable `searchKey` for dedupe + fuzzy lookup
 */

// Canonical brand casing — overrides whatever the user typed.
// Left side = lowercase match, right side = canonical form.
const BRAND_CANONICAL: Record<string, string> = {
  arri:      "Arri",
  red:       "RED",
  sony:      "Sony",
  canon:     "Canon",
  panasonic: "Panasonic",
  blackmagic: "Blackmagic",
  nikon:     "Nikon",
  fujifilm:  "Fujifilm",
  fuji:      "Fuji",
  zeiss:     "Zeiss",
  leica:     "Leica",
  sigma:     "Sigma",
  tamron:    "Tamron",
  cooke:     "Cooke",
  atomos:    "Atomos",
  teradek:   "Teradek",
  dji:       "DJI",
  gopro:     "GoPro",
  angenieux: "Angénieux",
  // Lighting
  aputure:   "Aputure",
  godox:     "Godox",
  nanlite:   "Nanlite",
  nanlux:    "Nanlux",
  quasar:    "Quasar",
  astera:    "Astera",
  kino:      "Kino",
  "kino flo": "Kino Flo",
  arrilux:   "ArriLux",
  mole:      "Mole",
  "mole richardson": "Mole-Richardson",
  // Sound
  sennheiser: "Sennheiser",
  shure:     "Shure",
  rode:      "Røde",
  neumann:   "Neumann",
  lectrosonics: "Lectrosonics",
  zoom:      "Zoom",
  sound: "Sound",
  // Grip / stands
  manfrotto: "Manfrotto",
  avenger:   "Avenger",
  matthews:  "Matthews",
  // Other
  sachtler:  "Sachtler",
  oconnor:   "O'Connor",
  "o'connor": "O'Connor",
};

// Model suffix patterns that should be preserved in uppercase or specific casing.
// Applied after brand canonicalisation.
function preserveModelCasing(word: string): string {
  // Pure alphanumeric codes that are mostly digits → uppercase (S60-C, M18, 5D)
  if (/^[A-Za-z]?\d+[A-Za-z-]*$/.test(word) || /^\d+[A-Za-z]+$/.test(word)) {
    return word.toUpperCase();
  }
  // Common suffix indicators — -C, -K, -HD, -XL etc.
  if (/^-[A-Z0-9]+$/i.test(word)) {
    return word.toUpperCase();
  }
  return word;
}

/**
 * Normalise an equipment name:
 *  - Collapse whitespace
 *  - Canonical brand casing
 *  - Title-case everything else
 *  - Preserve model codes (S60-C, M18)
 */
export function normaliseProductName(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, " ");
  if (!cleaned) return "";

  // First pass: check multi-word brand prefixes (e.g. "Kino Flo", "Mole Richardson")
  const lower = cleaned.toLowerCase();
  let prefixReplaced = cleaned;
  for (const [match, canonical] of Object.entries(BRAND_CANONICAL)) {
    if (match.includes(" ") && lower.startsWith(match)) {
      prefixReplaced = canonical + cleaned.slice(match.length);
      break;
    }
  }

  const words = prefixReplaced.split(" ");
  const out = words.map((w, idx) => {
    const wLower = w.toLowerCase();

    // Brand canonicalisation (single-word only here; multi-word handled above)
    if (BRAND_CANONICAL[wLower] && !BRAND_CANONICAL[wLower].includes(" ")) {
      return BRAND_CANONICAL[wLower];
    }

    // Preserve model casing if it looks like a model code
    const preserved = preserveModelCasing(w);
    if (preserved !== w) return preserved;

    // Short all-caps like "LED" / "USB" / "XLR" / "HD" / "4K"
    if (/^[A-Z0-9]{2,4}$/.test(w)) return w;
    if (/^\d+K$/i.test(w)) return w.toUpperCase();

    // Otherwise title-case, but keep first-letter caps for non-first words too
    if (idx === 0 || w.length > 2) {
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }
    return w.toLowerCase();
  });

  return out.join(" ");
}

/**
 * Produce a stable search key for dedupe + fuzzy matching.
 * Lowercase, alphanumerics + spaces only, collapsed whitespace.
 */
export function productSearchKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalise a description — trim, collapse internal whitespace, keep user's case.
 */
export function normaliseDescription(raw: string): string {
  return raw.trim().replace(/\s{2,}/g, " ").replace(/\n{3,}/g, "\n\n");
}
