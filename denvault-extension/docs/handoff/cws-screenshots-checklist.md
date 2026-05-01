# CWS Screenshots Checklist

**Date:** 2026-05-01
**Version:** DenVault v1.1.0
**Verifier:** `bash scripts/verify-store-assets.sh`

## Summary

| Result | Count |
|---|---|
| PASS | 5 (icon, promo, cws-01, cws-02, cws-04) |
| FAIL | 2 (cws-03, cws-05) |
| Not provided | 1 (marquee 1400x560 — optional) |
| Missing experience | 1 (dApp/RPC confirmation) |

The dimensions check passes (`verify-store-assets.sh` returns PASS for the seven required files), but two screenshots render the wrong screen for their caption and one user-requested experience is not represented.

## Asset matrix

| # | File | Spec | What it should show | What it actually shows | Result | Notes |
|---|---|---|---|---|---|---|
| 1 | `icon_128.png` | 128x128 PNG | DenVault shield mark | DenVault shield mark on dark background | PASS | Clean, no legacy branding |
| 2 | `promo_440x280.png` | 440x280 PNG | Brand mark + tagline | DenVault icon + "Bitcoin L2 Wallet" caption | PASS | No legacy refs |
| 3 | `cws-01-start.png` | 1280x800 | Start/onboarding hero | Start screen with "Set Up Your Wallet", Create / Import CTAs, "END-TO-END ENCRYPTED" badge | PASS | Caption "Your Gateway to Stacks" matches image |
| 4 | `cws-02-home.png` | 1280x800 | Wallet overview (balance, assets) | Account 1, Devnet chip, 94.67 STX, $0.00 USD, Send/Receive, Assets tab with STX/BTC/Runes | PASS | Address `STC5KHM...8T330BQ` derived from the public test mnemonic; not a real user address |
| 5 | `cws-03-send.png` | 1280x800 | Send form (recipient + amount + fee + Continue) | Same wallet home view as cws-02 (balance + assets) | **FAIL** | Spec navigates to `/send` without hash; vue-router falls back. Caption "Send STX Instantly" does not match image — risk: misleading-description rejection |
| 6 | `cws-04-receive.png` | 1280x800 | Receive flow with QR + Copy Address | Receive sheet open, STX/BTC tabs, QR code, "Copy Address" CTA | PASS | Correct flow rendered via `afterNav: openReceiveModal` |
| 7 | `cws-05-settings.png` | 1280x800 | UserMenu / settings / network switcher | Same wallet home view as cws-02 | **FAIL** | Spec navigates to `/usermenu` without hash; same routing issue as cws-03. Caption "Full Control / Network switching, security settings..." does not match image |
| 8 | `cws-marquee_1400x560.png` | 1400x560 PNG | Marquee promo tile | Not present in `assets/store/` | Not provided | Optional CWS asset; not blocking submission |

## Content audit (across all five cws-* screenshots)

| Concern | Result | Detail |
|---|---|---|
| `Stack-SATs` text | Clean | Logo overlay reads "DENVAULT"; no Stack-SATs strings |
| `wolfcito` references | Clean | No URLs visible in any screenshot |
| Sensitive user data | Clean | The visible address is derived from the public BIP39 test mnemonic (`abandon abandon ... about`); not a real wallet |
| Console error indicators | Clean | No error banners, red states, or browser DevTools artifacts |
| "Coming soon" as primary feature | Clean | Swap is not in the captured set; no preview-only feature is foregrounded |
| Sharpness / scaling | Clean | All cws-* PNGs render crisply at 1280x800 |
| Network indicator | Observation | Home shows `Devnet` chip. Not a blocker — DenVault officially supports Devnet — but the user-facing first impression is a developer network. Consider switching to Mainnet/Testnet for the home/send/settings cards before re-shooting |

## User experience coverage vs request

| User-requested experience | Mapped to | Status |
|---|---|---|
| Wallet overview | cws-02 | Covered |
| Receive / copy address | cws-04 | Covered |
| Send flow | cws-03 | **Not covered** — image shows home, not send form |
| dApp / RPC confirmation | none | **Not covered** — no card exists for this experience |
| Security / settings / backup | cws-05 | **Not covered** — image shows home, not settings |

The current set covers 2 of 5 requested experiences. Onboarding (cws-01) is the fifth slot but does not appear in the user's request list.

## Root cause of cws-03 / cws-05 failures

`e2e/store-screenshots.spec.ts` calls `page.goto(card.route)` for routes like `/send`, `/usermenu`. The popup uses `createWebHashHistory`, so the correct form is `page.goto('/#' + card.route)`. Without the `#`, Vite serves index.html and the router defaults to `/`, which (with snapshot mode active) lands on the home view. The capture fires before any hash-based navigation occurs, so the resulting screenshot is the home dashboard regardless of `card.route`.

`cws-04-receive` works because it routes to `/user` (which renders correctly through Vite's SPA fallback) and then opens the receive modal in-place via `afterNav`.

## Recommended remediation (separate PR, requires user approval before regenerating)

1. Patch `e2e/store-screenshots.spec.ts` so navigation uses the hash form: `await page.goto('/#' + card.route);`.
2. Decide whether to:
   - **Swap** `cws-01-start.png` for a dApp/RPC confirmation card (covers all 5 requested experiences, drops onboarding from the listing), or
   - Replace `cws-05-settings.png` with the dApp confirmation card and accept that "settings/backup" is not represented.
3. Optionally: switch the Devnet chip to Mainnet/Testnet for the home/send/settings cards so end-users see a production-looking wallet.
4. Re-run `pnpm exec playwright test e2e/store-screenshots.spec.ts --project=chromium` to regenerate.
5. Re-run `bash scripts/verify-store-assets.sh` (PASS expected).
6. Re-inspect each PNG visually to confirm the captured screen matches the caption.

## Exit criteria evaluation

| Criterion | Status |
|---|---|
| 5 screenshots valid 1280x800 | Dimensions OK; **content fails for cws-03 and cws-05** |
| Promo tile 440x280 | OK |
| Icon 128x128 | OK |
| No legacy branding | OK |
| No sensitive information | OK |
| No blurry / distorted screenshots | OK |
| Final exit criteria met | **NOT YET** — content of cws-03 and cws-05 must match their captions before submission |

## Action items before CWS upload

- [ ] Fix the hash-routing bug in `store-screenshots.spec.ts` and regenerate cws-03 + cws-05.
- [ ] Decide whether to add a dApp/RPC confirmation card (replacing cws-01 or cws-05).
- [ ] (Optional) Switch the active network from Devnet to Mainnet/Testnet before regeneration.
- [ ] (Optional) Generate a 1400x560 marquee promo tile for the CWS marquee slot.
- [ ] Re-run `verify-store-assets.sh` and visual review.
- [ ] Update this checklist with the new PASS results.
