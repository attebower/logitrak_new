# DYMO Label File Schema — Reference

> Canonical reference for `.label` file generation. Confirmed working against
> DYMO Connect for Desktop (Windows/Mac), April 2026.
>
> Used by `src/lib/labels/dymo.ts`.

## Critical facts (don't get these wrong)

- **File extension:** `.label` — NOT `.dymo`. DYMO Connect opens `.label` files directly.
- **Root element:** `<DieCutLabel Version="8.0" Units="twips">`. This is the legacy DYMO Label v8 format that DYMO Connect auto-converts on open. Do NOT use `<DesktopLabel>` — that wrapper is rejected.
- **Units:** twips. `1 inch = 1440 twips`, `1mm = 56.69 twips`.
- **Name tag:** `<n>` (lowercase), NOT `<Name>`. This is the single most common cause of "invalid file" errors.
- **Coordinate origin:** top-left of the label. X right, Y down.
- **No UTF-8 BOM** needed.

## Confirmed label SKUs

| SKU | PaperName | Id | Width (twips) | Height (twips) | Physical |
|---|---|---|---|---|---|
| 30252 | `30252 Address` | `Address` | 5040 | 1581 | 89 × 28mm |
| 30334 | `30334 Multi-Purpose` | `MultiPurpose` | 3402 | 1134 | 60 × 20mm |
| 30256 | `30256 Shipping` | `LargeShipping` | 5715 | 3331 | 101 × 59mm |
| 30321 | `30321 Large Address` | `LargeAddress` | 5020 | 2025 | 89 × 36mm |
| 11355 | `11355 Multi-Purpose` | `MultiPurpose2` | 3402 | 2268 | 51 × 19mm |

## Object types

- **TextObject** — styled text. Supports multiple `<Element>` blocks inside `<StyledText>` for mixed fonts/sizes.
- **BarcodeObject** — QR or 1D barcode. Type values: `QRCode`, `Code128Auto`, `Code128A/B/C`, `Code39`, `EAN13`, `EAN8`, `UPCA`, `UPCE`, `ITF`, `Pdf417`.

## Common errors

- "Invalid file" → Wrong root, `<Name>` instead of `<n>`, wrong extension
- QR solid black → DYMO 550 driver bug; update DYMO Connect or switch to Code128
- Objects outside bounds → X+Width or Y+Height exceeds label size in twips

## QR URL format for LogiTrak

```
https://app.logitrack.io/{workspace-slug}/equipment/{serial}
```

## Sources

- DYMO Developer SDK: developers.dymo.com
- DYMO Connect Framework: github.com/dymosoftware/dymo-connect-framework
- Confirmed working template tested April 2026
