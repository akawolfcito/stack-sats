# Chrome Web Store Submission Handoff

**Date:** 2026-05-01
**Issue:** #3 — Submit extension to Chrome Web Store
**Milestone:** CWS v1.1.0 Release
**Status:** Ready for upload (pending Google Developer account registration)

## Build artifact

- **File:** `denvault-v1.1.0.zip`
- **Location:** workspace root (next to `denvault-extension/`)
- **Size:** ~847 KB
- **Generated from:** main HEAD `6196745` (PR #23 merge — URL migration)
- **Source commit on this branch:** PR #24 (release:zip rm-f fix)
- **Manifest at root:** verified via `unzip -l`
- **Manifest values:**
  - `name`: `DenVault`
  - `short_name`: `DenVault`
  - `version`: `1.1.0`
  - `description`: `DenVault - Your Bitcoin Layer 2 wallet for the Stacks ecosystem.`
  - `manifest_version`: 3
  - `permissions`: `storage`, `tabs`, `sidePanel`
  - `host_permissions`: `api.hiro.so/*`, `api.testnet.hiro.so/*`, `api.platform.hiro.so/*`
  - `content_security_policy.extension_pages`: includes `wasm-unsafe-eval`

## Verification checks executed

| Check | Command | Result |
|---|---|---|
| Type-check | `pnpm type-check` | clean |
| Build | `pnpm build` (after `rm -rf dist`) | success |
| ZIP regenerated | `pnpm --filter wallet-extension release:zip` | success |
| Manifest at root | `unzip -l denvault-v1.1.0.zip \| grep manifest.json$` | present |
| No legacy assets | grep `screenshot_1` / `Stack-SATs` / `wolfcito\.github\.io` inside extracted ZIP | zero hits |
| No duplicate bundles | only one `assets/SwapView-*.js` in ZIP | ok |
| Store assets | `bash scripts/verify-store-assets.sh` | PASS (icon + 5 cws-* + promo) |
| Privacy URL | `curl -sI https://akawolfcito.github.io/stack-sats/privacy.html` | HTTP 200 |
| Support URL | `curl -sI https://akawolfcito.github.io/stack-sats/support.html` | HTTP 200 |
| Homepage URL | `curl -sI https://akawolfcito.github.io/stack-sats/` | HTTP 200 |
| Privacy content | `curl -s privacy.html \| grep akawolfcito` | links to `github.com/akawolfcito/stack-sats`, `Last Updated: May 2026` |

## Final URLs

- **Homepage:** https://akawolfcito.github.io/stack-sats/
- **Privacy:** https://akawolfcito.github.io/stack-sats/privacy.html
- **Support:** https://akawolfcito.github.io/stack-sats/support.html
- **Source:** https://github.com/akawolfcito/stack-sats

## Pending Chrome Web Store fields

The user must complete these in the dashboard during upload:

- Google Developer account registration ($5 one-time fee)
- Upload `denvault-v1.1.0.zip`
- **Listing name:** `DenVault` (manifest already says so)
- **Summary** (max 132 chars): from `docs/RELEASE.md`
- **Detailed description:** from `docs/RELEASE.md`
- **Category:** Productivity
- **Language:** English
- **Screenshots:** upload `assets/store/cws-01..05.png`
- **Icon:** upload `assets/store/icon_128.png`
- **Promo tile:** upload `assets/store/promo_440x280.png`
- **Privacy Policy URL:** https://akawolfcito.github.io/stack-sats/privacy.html
- **Support URL:** https://akawolfcito.github.io/stack-sats/support.html
- **Single Purpose:** from `docs/RELEASE.md:135`
- **Permission Justifications:** from `docs/RELEASE.md:140-159`
- **Host Permission Justification:** from `docs/RELEASE.md:148-159`
- **Remote Code:** No (declarable; verified — no eval / Function / importScripts)
- **YouTube demo (optional):** none yet

## Issue #3 housekeeping

The body of #3 still lists `Name: Stack-SATs`. Add a comment to clarify
that the canonical brand is `DenVault` (matches manifest after PRs #22/#23/#24).
The issue can stay open until the dashboard upload is done.

## Known gaps (not blocking)

- `#18` — Unlock UI does not recover from temporary lockout after 3 failed
  PIN attempts. Tracked separately. Not a CWS blocker.
- ActionBar Send / Memo input / generic CTA buttons lack `data-roi`. Tests
  use `getByRole` workarounds. Cosmetic.
- `screenshot_1.png` legacy fixture removed (was never part of CWS upload set).

## Rollback

If CWS rejects, fix and re-upload as `1.1.1`:

1. Bump `manifest_version` (1.1.1) in `public/manifest.json` and `package.json`.
2. Update `release:zip` filename or rename produced ZIP.
3. Re-run `pnpm build && pnpm --filter wallet-extension release:zip`.
4. Address rejection reasons before re-submission.

If the published listing must be unpublished, do it from the CWS
developer dashboard. Reverting commits in this repo does not affect a
published listing.
