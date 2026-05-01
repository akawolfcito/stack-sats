# CWS Screenshots Checklist

**Date:** 2026-05-01 (revised after remediation)
**Version:** DenVault v1.1.0
**Verifier:** `bash scripts/verify-store-assets.sh`

## Summary

| Result | Count |
|---|---|
| PASS | 7 (icon, promo, cws-01..05) |
| FAIL | 0 |
| Not provided | 1 (marquee 1400x560 — optional) |

All required assets pass dimension and content checks. Submission GO.

## Asset matrix

| # | File | Spec | What it should show | What it actually shows | Result |
|---|---|---|---|---|---|
| 1 | `icon_128.png` | 128x128 PNG | DenVault shield mark | DenVault shield mark on dark background | PASS |
| 2 | `promo_440x280.png` | 440x280 PNG | Brand mark + tagline | DenVault icon + "Bitcoin L2 Wallet" caption | PASS |
| 3 | `cws-01-start.png` | 1280x800 | Onboarding hero | "Set Up Your Wallet" with Create / Import CTAs and END-TO-END ENCRYPTED badge. Caption: "Your Gateway to Stacks" | PASS |
| 4 | `cws-02-home.png` | 1280x800 | Wallet overview | Account 1, Testnet chip, 94.67 STX, $0.00 USD, Send/Receive, Assets list (STX/BTC/Runes). Caption: "Manage Your Assets" | PASS |
| 5 | `cws-03-send.png` | 1280x800 | Send STX form | Real Send STX form: account header with available balance, To field, Amount with MAX, Memo, Network Fee 0.01 STX, Continue. Caption: "Send STX Instantly" | PASS |
| 6 | `cws-04-receive.png` | 1280x800 | Receive flow | Receive sheet open, STX/BTC tabs, QR code, "Copy Address" CTA, "View in Explorer". Caption: "Receive with QR Code" | PASS |
| 7 | `cws-05-settings.png` | 1280x800 | Settings / UserMenu | Settings screen: Manage Wallets, Manage Accounts, Security & Backup (Export Secret Key, Import Wallet), Manage Tokens, Density toggle, Danger Zone. Caption: "Full Control" | PASS |
| 8 | `cws-marquee_1400x560.png` | 1400x560 PNG | Marquee promo tile | Not present | Not provided (optional) |

## Content audit

| Concern | Result |
|---|---|
| `Stack-SATs` text | Clean — overlay reads "DENVAULT"; no Stack-SATs strings |
| `wolfcito` references | Clean — no URLs visible |
| Sensitive user data | Clean — visible address derived from public BIP39 test mnemonic; not a real wallet |
| Console error indicators | Clean — no error banners or DevTools artifacts |
| "Coming soon" as primary feature | Clean — no preview-only feature is foregrounded |
| Sharpness / scaling | Clean — all PNGs render crisply at 1280x800 |
| Network indicator | Resolved — home/send cards now show `Testnet` (was `Devnet`); production-looking first impression |
| Settings card wallet count shows "0 wallets - No wallet" | Cosmetic only — snapshot mode auto-unlocks via mnemonic without writing a vault entry. Settings still demonstrates the feature surface (Manage Wallets, Accounts, Security & Backup, Tokens). Not a CWS blocker |

## User experience coverage vs request

| User-requested experience | Mapped to | Status |
|---|---|---|
| Wallet overview | cws-02 | Covered |
| Receive / copy address | cws-04 | Covered |
| Send flow | cws-03 | Covered (real send form rendered) |
| Security / settings / backup | cws-05 | Covered (real Settings screen with Export Secret Key / Import Wallet) |
| dApp / RPC confirmation | none | Deferred per user decision (kept onboarding card cws-01 instead) |

Onboarding (cws-01) occupies the fifth slot.

## Remediation applied

1. `e2e/store-screenshots.spec.ts` — `page.goto(card.route)` rewritten to `page.goto('/#' + card.route)` so non-`/` routes resolve through the popup's `createWebHashHistory` instead of falling back to `/`.
2. `setupUnlockedWallet` fixture — `selected_network` switched from `devnet` to `testnet` so the Network chip and SendView render testnet branding for end users.
3. Regenerated `cws-01..05.png` via `pnpm exec playwright test e2e/store-screenshots.spec.ts --project=chromium` (5/5 passed).

No product code touched.

## Exit criteria evaluation

| Criterion | Status |
|---|---|
| 5 screenshots valid 1280x800 | PASS — content matches each caption |
| Promo tile 440x280 | PASS |
| Icon 128x128 | PASS |
| No legacy branding | PASS |
| No sensitive information | PASS |
| No blurry / distorted screenshots | PASS |
| `verify-store-assets.sh` passes | PASS |
| **GO / NO-GO** | **GO** |

## Action items remaining

- [x] Fix hash-routing bug in `store-screenshots.spec.ts`.
- [x] Regenerate cws-03 + cws-05 with the real screens.
- [x] Switch network chip to Testnet for the home/send cards.
- [x] Re-run `verify-store-assets.sh` and visual review.
- [ ] (Optional, follow-up) Generate a 1400x560 marquee promo tile.
- [ ] (Optional, follow-up) Add a sixth dApp/RPC confirmation card if CWS adds slots or reviewer asks.
