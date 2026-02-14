# DenVault - Stacks Wallet Extension

Self-custodial Stacks (STX) and Bitcoin wallet browser extension, built with Vue 3 and Vite.

Compatible with Chrome [extensions](https://developer.chrome.com/docs/extensions) via Manifest V3. Key extension scripts in `/public`:

- `content.js` - Communication layer between the web page and `background.js`
- `background.js` - Communication layer between `content.js` and the popup
- `injection.js` - Provides `window.StacksWallet` to web pages

The `/src` folder houses all the scripts used in the extension popup.

## Features

- Generate or import mnemonic seed phrase
- Create Stacks and Bitcoin addresses (multi-account)
- AES-256-GCM encryption with PBKDF2 (600k iterations)
- Supports @stacks/connect v8 RPC methods
- Network switching (mainnet, testnet, devnet)
- Fiat price display (CoinGecko)
- QR code receive flow

## Build & Load Extension

```bash
pnpm install
pnpm build
```

Then load in Chrome:
1. Go to [chrome://extensions](chrome://extensions/)
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `dist/` folder

## Development

```bash
pnpm dev          # Dev server with hot-reload
pnpm test         # Unit tests (vitest, 415 tests)
pnpm test:e2e     # E2E tests (Playwright)
pnpm type-check   # TypeScript checking
pnpm lint         # ESLint with auto-fix
```

## UI Snapshots

```bash
pnpm ui:shots     # Golden matrix snapshots (24 screenshots)
pnpm ui:store     # CWS store cards (5 screenshots, 1280x800)
pnpm ui:verify    # Verify snapshots match golden files
pnpm ui:accept    # Accept new snapshots as golden
```

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## DenLabs Integration (DenSignal v0.1)

DenVault emits DenSignal v0.1 events for operational telemetry.

Dev-only helpers (available in the browser console when running in dev mode):

- `window.__denlabsEmitEvent(event)` - Maps a DenVault DV_* event into DenSignal and stores it.
- `window.__denlabsExportSignals()` - Downloads `densignals_v01.json` from `chrome.storage.local`.

Storage key: `denlabs_densignals_v01`.
