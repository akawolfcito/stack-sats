# DenVault Production Hardening v1.1 -- Design Document

**Date:** 2026-02-12
**Author:** wolfcito + adversarial review
**Status:** Approved
**Approach:** Security-First Sprint (Enfoque A)

## Context

DenVault is a Stacks wallet browser extension (Chrome Manifest V3) at v1.0.2. It has a premium UI, functional send/receive for STX/BTC, partial dApp support, and DenSignal v0.1 integration. The goal is to ship to Chrome Web Store for public distribution.

An adversarial security review identified **12 CRITICAL**, **22 HIGH**, **18 MEDIUM**, and **12 LOW** findings across four surfaces: encryption/vault, extension message passing, wallet/transaction logic, and test coverage.

This design addresses all CRITICAL and HIGH findings, completes dApp method support, and establishes a test foundation before release.

## Target

- **Distribution:** Chrome Web Store (public)
- **dApp scope:** Full support (all stx_* methods)
- **Pricing:** Fiat prices via CoinGecko free tier
- **Version:** 1.1.0

---

## Section 1: Security Architecture (CRITICAL Fixes)

### 1.1 Eliminate Snapshot Mode Backdoor

**Problem:** `session.ts:70-84` checks `localStorage.__UI_SNAPSHOT_MODE__` and auto-unlocks without PIN. No build-time guard exists -- this ships to production.

**Solution:**
- Wrap the snapshot block in `if (import.meta.env.DEV)`
- Add Vite define: `__UI_SNAPSHOT__: JSON.stringify(mode === 'development')` for dead-code elimination
- Post-build verification: grep dist/ to confirm `__UI_SNAPSHOT_MODE__` string is absent

### 1.2 Strengthen Authentication: PIN + Device Secret

**Problem:** 6-digit PIN = ~20 bits entropy. With PBKDF2 at 100k iterations, the entire keyspace is brute-forcible in <2 minutes on GPU.

**Solution:**
- Keep 6-digit PIN (familiar UX) but combine with a **device secret** (256 bits)
- Device secret: `crypto.getRandomValues(new Uint8Array(32))`, stored in `chrome.storage.session` (memory-only, not persisted to disk)
- Key derivation: `PBKDF2(PIN + deviceSecret, salt, 600000, SHA-256)` -- 600k iterations per OWASP 2023
- On wallet creation: generate device secret, store in `chrome.storage.session`
- On browser restart: device secret is gone, user must re-enter PIN (which re-derives from the on-disk encrypted blob using a new device secret cycle)
- **Migration:** On first v1.1 open, prompt for current PIN, decrypt with old scheme, re-encrypt with new scheme

### 1.3 Restrict dApp Origins

**Problem:** `background.js` allowlist regex `/^https:\/\/.+$/` accepts every HTTPS origin. Auto-approve cache in `chrome.storage.session` never expires.

**Solution:**
- Remove universal HTTPS regex
- Per-origin approval system:
  - First request from unknown origin: popup with hostname, approve/reject
  - Approved origins stored in `chrome.storage.local` under `approved_origins`
  - Auto-approve cache expires after 24 hours
  - Settings UI to view/revoke approved origins
- Hardcoded trusted origins: `explorer.hiro.so`, `app.stacks.co` (skip popup)

### 1.4 Restrict Network baseUrl

**Problem:** dApp can supply arbitrary `params.network.client.baseUrl`, redirecting signed transactions to attacker-controlled servers.

**Solution:**
- Strict allowlist in `network/index.ts`:
  ```
  ALLOWED_API_HOSTS = ['api.hiro.so', 'api.testnet.hiro.so', 'api.platform.hiro.so', 'localhost']
  ```
- Validate URL scheme (https only, except localhost)
- Reject requests with unlisted baseUrl with clear error

### 1.5 Validate dApp Payloads with Zod

**Problem:** Message payloads from content script to background to popup are never schema-validated. TypeScript `as` casts provide zero runtime protection.

**Solution:**
- New file: `stxmethods/schemas.ts` with Zod schemas per method:
  - `TransferStxParamsSchema`: recipient (STX address regex), amount (positive bigint string), memo (optional, max 34 bytes), network (optional, validated host)
  - `CallContractParamsSchema`: contract (format `address.name`), functionName (string), functionArgs (array of ClarityValue-compatible)
  - `SignMessageParamsSchema`: message (string, max 1MB)
  - `GetAddressesParamsSchema`: minimal
- Validate at two boundaries: background.js (before enqueue) and stxmethods handler (before execution)

---

## Section 2: Memory & Cryptography Security (HIGH Fixes)

### 2.1 SecureBuffer for Sensitive Data

**Problem:** Mnemonic and private keys stored as immutable JS strings. `clearSensitiveString()` is non-functional theater. Memory is never actually cleared.

**Solution:**
- New utility class `security/secure-buffer.ts`:
  - Wraps `Uint8Array` internally
  - `zero()`: overwrites buffer with `\0`, marks invalidated
  - `toString()`: temporary string extraction (caller must not persist)
  - `isValid()`: check if buffer has been zeroed
- `SessionManager._decryptedMnemonic`: change from `string | null` to `SecureBuffer | null`
- On `lock()`: call `this._decryptedMnemonic.zero()` then set to `null`
- In stxmethods handlers: extract key in minimal scope, zero in `finally`
- Remove dead code: `clearSensitiveString()`, `withSecureValue()`, `scheduleCleanup()` (all non-functional)

### 2.2 Real Brute-Force Lockout

**Problem:** `MAX_UNLOCK_ATTEMPTS = 3` with a comment `// Could implement temporary lockout here`. No actual lockout. Counter resets on reload.

**Solution:**
- Persist failed attempt count and `lockoutUntil` timestamp in `chrome.storage.session`
- Escalating lockout: 30s -> 2min -> 10min -> 1 hour
- UI: show countdown timer in `UnlockView.vue` during lockout
- Counter resets to 0 on successful unlock
- Counter survives popup reload (stored in session, not memory)

### 2.3 Eliminate Duplicate Mnemonic Storage

**Problem:** Both `WalletVault._decryptedMnemonic` and `SessionManager._decryptedMnemonic` hold the mnemonic independently. Locking one doesn't clear the other.

**Solution:**
- Remove `WalletVault._decryptedMnemonic` field entirely
- Vault becomes stateless for decrypted data: `vault.decrypt(pin)` returns `SecureBuffer`, vault forgets
- Only `SessionManager` holds the decrypted mnemonic
- Single `lock()` path clears everything

### 2.4 Fix `encrypt()` Phantom Salt

**Problem:** `encrypt()` generates a random salt stored in output but never used for key derivation. Misleading.

**Solution:**
- Make `encrypt()` private (not exported)
- Only export `encryptWithPIN()` / `decryptWithPIN()` as public API
- Remove salt generation from the inner `encrypt()` function

### 2.5 Cryptographic Wallet IDs

**Problem:** `vault_${Date.now()}_${Math.random()...}` -- predictable, collision-prone.

**Solution:**
- Replace with `crypto.randomUUID()` in both `vault.ts` and `wallets/index.ts`

---

## Section 3: Transaction Validation (HIGH Fixes)

### 3.1 Address Checksum Verification

**Problem:** STX addresses validated by character set only (no c32check checksum). BTC addresses validated by format only (no Base58Check/Bech32 checksum). Typos pass validation -> permanent fund loss.

**Solution:**
- **STX:** Use `c32addressDecode()` from `c32check` (already a dependency) for checksum + network match verification
- **BTC:** Use `bitcoinjs-lib` address module (already a dependency) for full checksum verification
- Apply in BOTH flows: manual transfer (`transfer/index.ts`) AND dApp (`stxmethods/index.ts`)

### 3.2 Amount Validation

**Problem:** dApp flow accepts any amount without validation. Bitcoin uses `number` (floating point) risking precision loss.

**Solution:**
- Validate: positive, non-zero, does not exceed sender balance, sanity cap against total supply
- Use `BigInt` exclusively for all amounts (STX and BTC)
- Migrate `BtcBalance` interface from `number` to `bigint` (satoshis)
- Shared validation function used by both manual and dApp flows

### 3.3 Dynamic STX Fees

**Problem:** Fee hardcoded at `10000n` (0.01 STX) with comment "for devnet" but used in production.

**Solution:**
- Call `estimateTransactionFeeWithFallback()` from `@stacks/transactions`
- Fallback to hardcoded fee only if estimation fails, with visible warning to user
- Show fee in confirmation UI (both manual and dApp flows)

### 3.4 Improved Confirmation UI

**Problem:** Amounts shown in microSTX. Subtitle says "view your balances" for ALL methods including transfers. Misleading and phishing-friendly.

**Solution:**
- Display amounts in STX using existing `microStxToStx()` conversion
- Dynamic subtitle per method type:
  - `getAddresses`: "Share your wallet addresses with this app"
  - `stx_transferStx`: "Send {amount} STX to {recipient}"
  - `stx_callContract`: "Call {contract}.{function}"
  - `stx_signMessage`: "Sign a message for this app"
- Warning badge if amount > 50% of balance
- Show: origin hostname, amount in STX, fee in STX, recipient, network (mainnet/testnet indicator)

### 3.5 Eliminate URL Payload Leak

**Problem:** `background.js:openPopupConfirmation` passes full message payload as URL parameters. Visible in browser history, URL bar, and to other extensions.

**Solution:**
- Use exclusively `chrome.storage.session` for passing payloads to confirmation popup
- Remove URL params fallback entirely

---

## Section 4: Feature Completion

### 4.1 Complete dApp Methods

| Method | Priority | Notes |
|--------|----------|-------|
| `stx_signStructuredData` | High | SIP-018 structured data signing |
| `stx_deployContract` | Medium | Deploy Clarity contracts |
| `stx_getAccounts` | High | Many dApps use this |
| `stx_transferSip10Ft` | High | SIP-010 fungible token transfers |
| `stx_signTransaction` | Medium | Generic transaction signing |
| `signPsbt` | Low | Bitcoin PSBT signing, few dApps use it |

Each method follows the pattern:
1. Zod schema validation (from 1.5)
2. Handler in `stxmethods/index.ts`
3. Confirmation UI with method-specific details
4. Sign with user's key
5. Broadcast (or return signed tx)

Account selector: implement UI dropdown so user can choose which derived account to use (not hardcode index 0).

### 4.2 Fiat Prices (CoinGecko Free Tier)

- New module: `utils/prices/index.ts`
- Endpoint: `https://api.coingecko.com/api/v3/simple/price?ids=blockstack,bitcoin&vs_currencies=usd`
- 5-minute in-memory cache (no storage)
- Fallback: display "Price unavailable" if API unreachable
- Show in: `UserHomeView.vue` balance header, transaction confirmation dialog

---

## Section 5: Test Foundation

### 5.1 Critical Unit Tests

| Module | Required Tests |
|--------|---------------|
| `encryption.ts` | Round-trip encrypt/decrypt, wrong PIN rejection, corrupted ciphertext handling, PBKDF2 iteration count verification |
| `vault.ts` | saveMnemonic, loadMnemonic, deleteEntry, migration from legacy, importEntry with malicious data |
| `session.ts` | unlock/lock flow, auto-lock timer, lockout escalation, snapshot mode disabled in prod build |
| `accounts/index.ts` | Key derivation with known test vectors (standard mnemonic -> expected address) |
| `stxmethods/index.ts` | Each handler with valid and invalid inputs, rejected baseUrl, malicious payloads |
| `stxmethods/schemas.ts` | Zod schemas accept valid params, reject invalid/malicious params |

### 5.2 Security-Focused Tests

- Malicious input: XSS payloads in addresses, overflow amounts, 10MB strings
- Build verification: production dist/ does not contain `__UI_SNAPSHOT_MODE__`, sensitive `console.log`, `devLog`
- Property-based tests with `fast-check`: amount conversion round-trips (`stxToMicroStx` <-> `microStxToStx`)

### 5.3 E2E Against Built Extension

- Change Playwright config to load extension from `dist/` (not Vite dev server)
- E2E flows: create wallet -> unlock -> send STX -> lock -> unlock again
- dApp rejection test: simulate malicious dApp with invalid payloads, verify rejection

### 5.4 Coverage Thresholds

- Add to `vitest.config.ts`: `coverage.thresholds: { branches: 70, functions: 80, lines: 75 }`
- CI fails if coverage drops below thresholds

---

## Section 6: Cleanup & Release

### 6.1 Remove Legacy Code

- Delete sync wallet functions from `wallets/index.ts` (localStorage-based)
- Remove `clipboardRead` from manifest.json (unused)
- Evaluate replacing `tabs` with `activeTab` permission

### 6.2 Build Hardening

- Vite define flags for dead-code elimination in production
- Pre-release script: `pnpm verify` + build scan for secrets + verify snapshot mode absent in dist/

### 6.3 Release

- Bump version to 1.1.0 in `package.json` and `manifest.json`
- Update `RELEASE_CHECKLIST.md` with new security checks
- Update `NOTES_TO_REVIEWER.md` with new security architecture description
- Generate ZIP, verify contents
- Submit to Chrome Web Store

---

## Execution Order

```
Phase 1: Hardening        Phase 2: Tests           Phase 3: Features       Phase 4: Release
(~1-2 weeks)              (~1 week)                (~1-2 weeks)            (~1 week)

1.1 Snapshot fix          5.1 Unit tests           4.1 dApp methods        6.1 Cleanup
1.2 PIN + device secret   5.2 Security tests       4.2 Fiat prices         6.2 Build harden
1.3 Origin restriction    5.3 E2E extension        3.4 Confirmation UI     6.3 Release
1.4 baseUrl allowlist     5.4 Coverage gates
1.5 Zod schemas
2.1 SecureBuffer
2.2 Real lockout
2.3 Dedup mnemonic
2.4 Salt fix
2.5 Crypto UUIDs
3.1 Checksum addresses
3.2 Amount validation
3.3 Dynamic fees
3.5 No URL payloads
```

## Adversarial Review Summary

| Surface | CRIT | HIGH | MED | LOW |
|---------|------|------|-----|-----|
| Encryption & Vault | 4 | 6 | 7 | 7 |
| Extension Scripts | 3 | 7 | 7 | 4 |
| Wallet & Transactions | 5 | 10 | 10 | 5 |
| Test Coverage | 8 | 9 | 8 | 5 |
| **Total** | **12** | **22** | **18** | **12** |

All CRITICAL and HIGH findings are addressed by this design. MEDIUM findings are addressed where they overlap with the work above. LOW findings are deferred to v1.2.
