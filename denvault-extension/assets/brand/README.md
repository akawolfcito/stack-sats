# Brand sources

Master artwork the shipped icons are cut from. Nothing here is bundled:
the folder sits outside `public/` and `src/`, so Vite never copies it.

| File | Size | Role |
|---|---|---|
| `denvault-logo.png` | 1024x1024 | Full mark, transparent. Master for every size above 32px. |
| `denvault-logo16px.png` | 16x16 | Simplified shield, hand-tuned for the toolbar. |
| `denvault-logo32px.png` | 32x32 | Simplified shield. |
| `denvault-logo48px.png` | 48x48 | Simplified shield, kept as reference. |

## Where each shipped icon comes from

Verified by md5 on 2026-08-16:

| Shipped file | Source | Relation |
|---|---|---|
| `public/denvault-16.png` | `denvault-logo16px.png` | byte for byte identical |
| `public/denvault-32.png` | `denvault-logo32px.png` | byte for byte identical |
| `public/denvault-48.png` | `denvault-logo.png` | downscaled, then optimized (does not match `denvault-logo48px.png`) |
| `public/denvault-128.png` | `denvault-logo.png` | downscaled, then optimized |
| `public/denvault-i.png` | `denvault-logo.png` | downscaled, then optimized |
| `public/favicon.ico` | `denvault-logo.png` | multi-size ICO |
| `assets/store/icon_128.png` | same bytes as `public/denvault-128.png` | copy |
| `docs/icon.png` | same bytes as `public/denvault-128.png` | copy |

The exact downscale and optimization commands were run by hand in the
2026-08-16 session and were not scripted. Regenerating an icon means
redoing that by hand from the master, so check the result against
`scripts/verify-store-assets.sh` before committing it.

## Gotcha: promo tiles

`e2e/store-screenshots.spec.ts` embeds `public/denvault-i.png` as base64
to build the Chrome Web Store promo tiles, and those tiles cannot carry
an alpha channel. `verify-store-assets.sh` checks dimensions and alpha,
not content, so a stale logo inside a tile passes the check. Regenerate
tiles with `pnpm ui:store` after any change to the mark.

## Not included

`private/denvault.png` (942x875) stayed out. It is not an input to any
shipped asset and its role is unconfirmed.
