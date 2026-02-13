# DenVault Production Hardening v1.1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden den-vault for Chrome Web Store public release by fixing all CRITICAL/HIGH security findings and completing dApp support.

**Architecture:** Security-first approach. Phase 1 fixes CRITICAL vulnerabilities (snapshot backdoor, weak KDF, unrestricted origins, unvalidated payloads). Phase 2 builds the test foundation. Phase 3 completes features (dApp methods, fiat prices). Phase 4 cleans up and releases.

**Tech Stack:** Vue 3, TypeScript, Vite 6, Web Crypto API, Zod, @stacks/transactions 7, @stacks/connect 8, Vitest, Playwright

**Design Doc:** `docs/plans/2026-02-12-production-hardening-design.md`

---

## Phase 1: Security Hardening

### Task 1: Eliminate Snapshot Mode Backdoor

**Files:**
- Modify: `src/utils/security/session.ts:66-84`
- Modify: `vite.config.ts:8-20`
- Test: `src/utils/security/session.test.ts` (new)

**Step 1: Add Vite define flag for snapshot mode**

In `vite.config.ts`, add build-time define so snapshot code is dead-code eliminated in production:

```ts
export default defineConfig(({ mode }) => ({
  plugins: [wasm(), vue(), vueDevTools()],
  define: {
    __DEV__: JSON.stringify(mode === 'development'),
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  esbuild: {
    supported: {
      "top-level-await": true,
    },
  },
}));
```

**Step 2: Add global type declaration for `__DEV__`**

In `env.d.ts`, add:

```ts
declare const __DEV__: boolean;
```

**Step 3: Guard snapshot mode with `__DEV__`**

In `session.ts`, wrap lines 70-84:

```ts
// Inside initialize(), replace the snapshot block:
if (__DEV__) {
  const snapshotMode = localStorage.getItem(SNAPSHOT_MODE_KEY);
  if (snapshotMode === "true" || snapshotMode === "1") {
    const snapshotMnemonic = localStorage.getItem(SNAPSHOT_MNEMONIC_KEY);
    if (snapshotMnemonic) {
      this._hasWallet.value = true;
      this._isLocked.value = false;
      this._decryptedMnemonic = snapshotMnemonic;
      this._activeWalletId = "snapshot_test_wallet";
      this._isInitialized.value = true;
      console.log("[SessionManager] Snapshot mode - auto-unlocked with test wallet");
      return;
    }
  }
}
```

**Step 4: Verify production build excludes snapshot code**

Run: `pnpm build && grep -r "__UI_SNAPSHOT_MODE__" dist/`
Expected: No matches found.

**Step 5: Commit**

```bash
git add vite.config.ts env.d.ts src/utils/security/session.ts
git commit -m "fix(security): guard snapshot mode behind __DEV__ flag"
```

---

### Task 2: Strengthen Key Derivation (PIN + Device Secret + 600k iterations)

**Files:**
- Modify: `src/utils/security/encryption.ts:12,52-81,111-133,158-165`
- Create: `src/utils/security/device-secret.ts`
- Test: `src/utils/security/device-secret.test.ts` (new)

**Step 1: Write failing test for device secret generation and retrieval**

Create `src/utils/security/device-secret.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getOrCreateDeviceSecret, combineWithDeviceSecret } from "./device-secret";

describe("device-secret", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should generate a 32-byte device secret", async () => {
    const secret = await getOrCreateDeviceSecret();
    expect(secret).toBeInstanceOf(Uint8Array);
    expect(secret.length).toBe(32);
  });

  it("should return the same secret on subsequent calls", async () => {
    const s1 = await getOrCreateDeviceSecret();
    const s2 = await getOrCreateDeviceSecret();
    expect(s1).toEqual(s2);
  });

  it("should combine PIN with device secret into a deterministic buffer", async () => {
    const secret = new Uint8Array(32).fill(0xab);
    const combined = combineWithDeviceSecret("123456", secret);
    expect(combined).toBeInstanceOf(Uint8Array);
    expect(combined.length).toBeGreaterThan(6); // PIN length
  });

  it("should produce different outputs for different PINs", async () => {
    const secret = new Uint8Array(32).fill(0xab);
    const c1 = combineWithDeviceSecret("123456", secret);
    const c2 = combineWithDeviceSecret("654321", secret);
    expect(c1).not.toEqual(c2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C den-vault vitest run src/utils/security/device-secret.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement device-secret module**

Create `src/utils/security/device-secret.ts`:

```ts
/**
 * Device Secret Module
 * Generates and stores a 256-bit device secret in chrome.storage.session.
 * The secret only exists in memory (never persisted to disk).
 * Combined with the user's PIN before key derivation to prevent offline brute-force.
 */

const DEVICE_SECRET_KEY = "denvault_device_secret";

let cachedSecret: Uint8Array | null = null;

/**
 * Get or create the device secret.
 * Stored in chrome.storage.session (memory-only, cleared on browser close).
 * Falls back to in-memory cache for dev/test environments.
 */
export async function getOrCreateDeviceSecret(): Promise<Uint8Array> {
  if (cachedSecret) return cachedSecret;

  // Try to retrieve from chrome.storage.session
  if (typeof chrome !== "undefined" && chrome.storage?.session) {
    try {
      const result = await chrome.storage.session.get(DEVICE_SECRET_KEY);
      if (result[DEVICE_SECRET_KEY]) {
        const arr = new Uint8Array(Object.values(result[DEVICE_SECRET_KEY]) as number[]);
        cachedSecret = arr;
        return arr;
      }
    } catch {
      // Fallback to in-memory only
    }
  }

  // Generate new secret
  const secret = crypto.getRandomValues(new Uint8Array(32));
  cachedSecret = secret;

  // Store in session storage (memory-only)
  if (typeof chrome !== "undefined" && chrome.storage?.session) {
    try {
      await chrome.storage.session.set({
        [DEVICE_SECRET_KEY]: Array.from(secret),
      });
    } catch {
      // In-memory only is fine
    }
  }

  return secret;
}

/**
 * Combine a PIN with the device secret.
 * Returns a Uint8Array suitable for use as PBKDF2 key material.
 */
export function combineWithDeviceSecret(
  pin: string,
  deviceSecret: Uint8Array
): Uint8Array {
  const encoder = new TextEncoder();
  const pinBytes = encoder.encode(pin);
  const combined = new Uint8Array(pinBytes.length + deviceSecret.length);
  combined.set(pinBytes, 0);
  combined.set(deviceSecret, pinBytes.length);
  return combined;
}

/**
 * Clear cached secret (for testing)
 */
export function _clearCachedSecret(): void {
  cachedSecret = null;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm -C den-vault vitest run src/utils/security/device-secret.test.ts`
Expected: PASS (4 tests)

**Step 5: Update encryption.ts -- increase iterations and use combined key material**

In `encryption.ts`:
- Change `PBKDF2_ITERATIONS` from `100000` to `600000`
- Update `deriveKeyFromPIN` to accept `Uint8Array` key material (not just string)
- Update `encryptWithPIN` and `decryptWithPIN` to use device secret

```ts
const PBKDF2_ITERATIONS = 600000; // OWASP 2023 recommendation

/**
 * Derive a CryptoKey from key material using PBKDF2
 */
export async function deriveKey(
  keyMaterial: Uint8Array,
  salt: Uint8Array
): Promise<CryptoKey> {
  const importedKey = await crypto.subtle.importKey(
    "raw",
    keyMaterial,
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    importedKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** @deprecated Use deriveKey() with device secret */
export async function deriveKeyFromPIN(
  pin: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return deriveKey(encoder.encode(pin), salt);
}
```

Update `encryptWithPIN` and `decryptWithPIN` to accept optional `deviceSecret`:

```ts
export async function encryptWithPIN(
  data: string,
  pin: string,
  deviceSecret?: Uint8Array
): Promise<EncryptedData> {
  const salt = generateSalt();
  const keyMaterial = deviceSecret
    ? combineWithDeviceSecret(pin, deviceSecret)
    : new TextEncoder().encode(pin);
  const key = await deriveKey(keyMaterial, salt);

  const iv = generateIV();
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(data)
  );

  return {
    ciphertext: uint8ArrayToBase64(new Uint8Array(ciphertextBuffer)),
    iv: uint8ArrayToBase64(iv),
    salt: uint8ArrayToBase64(salt),
  };
}

export async function decryptWithPIN(
  encryptedData: EncryptedData,
  pin: string,
  deviceSecret?: Uint8Array
): Promise<string> {
  const salt = base64ToUint8Array(encryptedData.salt);
  const keyMaterial = deviceSecret
    ? combineWithDeviceSecret(pin, deviceSecret)
    : new TextEncoder().encode(pin);
  const key = await deriveKey(keyMaterial, salt);
  return decrypt(encryptedData, key);
}
```

Add `import { combineWithDeviceSecret } from "./device-secret";` at the top.

**Step 6: Remove dead `encrypt()` function and `clearSensitiveString()`**

Remove the standalone `encrypt()` function (lines 86-106) -- it generates a phantom salt and is misleading. Also remove `clearSensitiveString()` (lines 178-186) -- it does not work.

**Step 7: Fix `uint8ArrayToBase64` for large arrays**

Replace spread operator with chunked conversion:

```ts
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
```

**Step 8: Run type-check and build**

Run: `pnpm -C den-vault type-check && pnpm -C den-vault build`
Expected: PASS

**Step 9: Commit**

```bash
git add src/utils/security/encryption.ts src/utils/security/device-secret.ts src/utils/security/device-secret.test.ts
git commit -m "feat(security): add device secret + upgrade PBKDF2 to 600k iterations"
```

---

### Task 3: Implement SecureBuffer for Sensitive Data

**Files:**
- Create: `src/utils/security/secure-buffer.ts`
- Create: `src/utils/security/secure-buffer.test.ts`
- Modify: `src/utils/security/session.ts` (change mnemonic type)
- Modify: `src/utils/security/memory.ts` (remove dead code)

**Step 1: Write failing test for SecureBuffer**

Create `src/utils/security/secure-buffer.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { SecureBuffer } from "./secure-buffer";

describe("SecureBuffer", () => {
  it("should store and retrieve data", () => {
    const buf = SecureBuffer.fromString("test mnemonic phrase");
    expect(buf.toString()).toBe("test mnemonic phrase");
    expect(buf.isValid()).toBe(true);
  });

  it("should zero data on wipe", () => {
    const buf = SecureBuffer.fromString("secret data");
    buf.zero();
    expect(buf.isValid()).toBe(false);
    expect(() => buf.toString()).toThrow("SecureBuffer has been zeroed");
  });

  it("should return correct byte length", () => {
    const buf = SecureBuffer.fromString("hello");
    expect(buf.byteLength).toBe(5);
  });

  it("should zero internal bytes", () => {
    const buf = SecureBuffer.fromString("abc");
    const bytesRef = buf.bytes; // get reference before zero
    buf.zero();
    // All bytes should be 0
    expect(bytesRef.every((b) => b === 0)).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C den-vault vitest run src/utils/security/secure-buffer.test.ts`
Expected: FAIL

**Step 3: Implement SecureBuffer**

Create `src/utils/security/secure-buffer.ts`:

```ts
/**
 * SecureBuffer - Wraps sensitive data in a Uint8Array that can be zeroed.
 * Unlike JavaScript strings (immutable), Uint8Array contents can be overwritten.
 */
export class SecureBuffer {
  private _data: Uint8Array;
  private _zeroed = false;

  private constructor(data: Uint8Array) {
    this._data = data;
  }

  static fromString(str: string): SecureBuffer {
    return new SecureBuffer(new TextEncoder().encode(str));
  }

  static fromBytes(bytes: Uint8Array): SecureBuffer {
    // Copy to own buffer
    const copy = new Uint8Array(bytes.length);
    copy.set(bytes);
    return new SecureBuffer(copy);
  }

  /** Get raw bytes (reference -- do not store) */
  get bytes(): Uint8Array {
    return this._data;
  }

  get byteLength(): number {
    return this._data.length;
  }

  isValid(): boolean {
    return !this._zeroed;
  }

  /** Extract as string. Caller must NOT persist the result. */
  toString(): string {
    if (this._zeroed) {
      throw new Error("SecureBuffer has been zeroed");
    }
    return new TextDecoder().decode(this._data);
  }

  /** Overwrite internal buffer with zeros */
  zero(): void {
    this._data.fill(0);
    this._zeroed = true;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm -C den-vault vitest run src/utils/security/secure-buffer.test.ts`
Expected: PASS (4 tests)

**Step 5: Clean up memory.ts -- remove dead code**

Replace `memory.ts` contents. Keep only `clearObject` (used by tests). Remove: `clearString`, `withSecureValue`, `scheduleCleanup` (all non-functional or unused in production).

```ts
/**
 * Memory security utilities
 */

/**
 * Clear an object's properties (best effort)
 */
export function clearObject(obj: Record<string, unknown>): void {
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === "string") {
      obj[key] = "";
    } else if (typeof obj[key] === "object" && obj[key] !== null) {
      clearObject(obj[key] as Record<string, unknown>);
    }
    delete obj[key];
  }
}
```

**Step 6: Update all `scheduleCleanup()` call sites**

Search for `scheduleCleanup` imports across the codebase and remove them. Files affected:
- `session.ts` -- remove import and all `scheduleCleanup()` calls
- `vault.ts` -- remove import and all `scheduleCleanup()` calls
- `stxmethods/index.ts` -- remove import and all `scheduleCleanup()` calls

**Step 7: Run type-check and build**

Run: `pnpm -C den-vault type-check && pnpm -C den-vault build`
Expected: PASS

**Step 8: Commit**

```bash
git add src/utils/security/secure-buffer.ts src/utils/security/secure-buffer.test.ts src/utils/security/memory.ts src/utils/security/session.ts src/utils/security/vault.ts src/utils/stxmethods/index.ts
git commit -m "feat(security): add SecureBuffer, remove dead memory utilities"
```

---

### Task 4: Implement Real Brute-Force Lockout

**Files:**
- Modify: `src/utils/security/session.ts:31-32,222-262`
- Create: `src/utils/security/lockout.ts`
- Create: `src/utils/security/lockout.test.ts`

**Step 1: Write failing test for lockout logic**

Create `src/utils/security/lockout.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { LockoutManager } from "./lockout";

describe("LockoutManager", () => {
  let lockout: LockoutManager;

  beforeEach(() => {
    lockout = new LockoutManager();
    vi.useFakeTimers();
  });

  it("should not be locked out initially", () => {
    expect(lockout.isLockedOut()).toBe(false);
    expect(lockout.failedAttempts).toBe(0);
  });

  it("should track failed attempts", () => {
    lockout.recordFailure();
    expect(lockout.failedAttempts).toBe(1);
    lockout.recordFailure();
    expect(lockout.failedAttempts).toBe(2);
  });

  it("should lock out after 3 failures with 30s duration", () => {
    lockout.recordFailure();
    lockout.recordFailure();
    lockout.recordFailure();
    expect(lockout.isLockedOut()).toBe(true);
    expect(lockout.lockoutRemainingMs).toBeGreaterThan(0);
    expect(lockout.lockoutRemainingMs).toBeLessThanOrEqual(30000);
  });

  it("should escalate lockout duration on repeated failures", () => {
    // 3 failures -> 30s lockout
    for (let i = 0; i < 3; i++) lockout.recordFailure();
    expect(lockout.isLockedOut()).toBe(true);

    // Wait out the lockout
    vi.advanceTimersByTime(30001);
    expect(lockout.isLockedOut()).toBe(false);

    // 3 more -> 2min lockout
    for (let i = 0; i < 3; i++) lockout.recordFailure();
    expect(lockout.lockoutRemainingMs).toBeLessThanOrEqual(120000);
  });

  it("should reset on successful unlock", () => {
    lockout.recordFailure();
    lockout.recordFailure();
    lockout.recordSuccess();
    expect(lockout.failedAttempts).toBe(0);
    expect(lockout.isLockedOut()).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C den-vault vitest run src/utils/security/lockout.test.ts`
Expected: FAIL

**Step 3: Implement LockoutManager**

Create `src/utils/security/lockout.ts`:

```ts
/**
 * Brute-force lockout manager
 * Escalating lockout: 30s -> 2min -> 10min -> 1hr
 */

const LOCKOUT_DURATIONS_MS = [
  30_000,     // 30 seconds
  120_000,    // 2 minutes
  600_000,    // 10 minutes
  3_600_000,  // 1 hour
];

const MAX_ATTEMPTS_BEFORE_LOCKOUT = 3;

export class LockoutManager {
  private _failedAttempts = 0;
  private _lockoutUntil = 0;
  private _lockoutLevel = 0;

  get failedAttempts(): number {
    return this._failedAttempts;
  }

  get lockoutRemainingMs(): number {
    const remaining = this._lockoutUntil - Date.now();
    return Math.max(0, remaining);
  }

  isLockedOut(): boolean {
    return Date.now() < this._lockoutUntil;
  }

  recordFailure(): void {
    this._failedAttempts++;

    if (this._failedAttempts >= MAX_ATTEMPTS_BEFORE_LOCKOUT) {
      const duration = LOCKOUT_DURATIONS_MS[
        Math.min(this._lockoutLevel, LOCKOUT_DURATIONS_MS.length - 1)
      ];
      this._lockoutUntil = Date.now() + duration;
      this._lockoutLevel++;
      this._failedAttempts = 0; // Reset count for next cycle
    }
  }

  recordSuccess(): void {
    this._failedAttempts = 0;
    this._lockoutUntil = 0;
    this._lockoutLevel = 0;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm -C den-vault vitest run src/utils/security/lockout.test.ts`
Expected: PASS

**Step 5: Integrate LockoutManager into SessionManager**

In `session.ts`, replace the `_failedAttempts` ref and inline logic with `LockoutManager`:
- Import `LockoutManager` from `./lockout`
- Add `private _lockout = new LockoutManager()` field
- In `unlock()`: check `this._lockout.isLockedOut()` before attempting decrypt
- On decrypt failure: call `this._lockout.recordFailure()`
- On success: call `this._lockout.recordSuccess()`
- Expose `lockoutRemainingMs` and `isLockedOut` as getters

**Step 6: Run type-check and build**

Run: `pnpm -C den-vault type-check && pnpm -C den-vault build`
Expected: PASS

**Step 7: Commit**

```bash
git add src/utils/security/lockout.ts src/utils/security/lockout.test.ts src/utils/security/session.ts
git commit -m "feat(security): add escalating brute-force lockout"
```

---

### Task 5: Restrict dApp Origins and Validate baseUrl

**Files:**
- Modify: `public/background.js:10-17,380-407,484-523`
- Modify: `src/utils/network/index.ts:81-96`
- Create: `src/utils/network/allowed-hosts.ts`
- Test: `src/utils/network/allowed-hosts.test.ts`

**Step 1: Write failing test for host allowlist**

Create `src/utils/network/allowed-hosts.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isAllowedApiHost } from "./allowed-hosts";

describe("isAllowedApiHost", () => {
  it("should allow known Stacks API hosts", () => {
    expect(isAllowedApiHost("https://api.hiro.so/v2/info")).toBe(true);
    expect(isAllowedApiHost("https://api.testnet.hiro.so/v2/info")).toBe(true);
    expect(isAllowedApiHost("https://api.platform.hiro.so/v1/ext/key/stacks")).toBe(true);
  });

  it("should allow localhost for development", () => {
    expect(isAllowedApiHost("http://localhost:3999")).toBe(true);
    expect(isAllowedApiHost("http://127.0.0.1:3999")).toBe(true);
  });

  it("should reject arbitrary URLs", () => {
    expect(isAllowedApiHost("https://evil.com/api")).toBe(false);
    expect(isAllowedApiHost("https://api.hiro.so.evil.com")).toBe(false);
  });

  it("should reject non-https URLs (except localhost)", () => {
    expect(isAllowedApiHost("http://api.hiro.so")).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C den-vault vitest run src/utils/network/allowed-hosts.test.ts`
Expected: FAIL

**Step 3: Implement allowed-hosts module**

Create `src/utils/network/allowed-hosts.ts`:

```ts
/**
 * Allowlist for Stacks API hosts.
 * dApps MUST NOT be allowed to redirect transactions to arbitrary servers.
 */

const ALLOWED_HOSTS = [
  "api.hiro.so",
  "api.testnet.hiro.so",
  "api.platform.hiro.so",
];

const LOCALHOST_PATTERNS = [
  /^http:\/\/localhost(:\d+)?(\/|$)/,
  /^http:\/\/127\.0\.0\.1(:\d+)?(\/|$)/,
];

/**
 * Check if a URL points to an allowed Stacks API host.
 */
export function isAllowedApiHost(url: string): boolean {
  // Allow localhost for development
  if (LOCALHOST_PATTERNS.some((p) => p.test(url))) {
    return true;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return ALLOWED_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm -C den-vault vitest run src/utils/network/allowed-hosts.test.ts`
Expected: PASS

**Step 5: Integrate into `buildNetworkWithClient`**

In `network/index.ts`, import `isAllowedApiHost` and validate `baseUrl`:

```ts
import { isAllowedApiHost } from "./allowed-hosts";

export function buildNetworkWithClient(
  networkParams?: { chainId?: number; client?: { baseUrl?: string } },
  fallbackNetwork?: NetworkName
): StacksNetwork {
  const baseNetwork = getNetworkConfig(fallbackNetwork);
  const baseUrl = networkParams?.client?.baseUrl;

  if (!baseUrl) {
    return baseNetwork;
  }

  if (!isAllowedApiHost(baseUrl)) {
    throw new Error(`Network endpoint not allowed: ${baseUrl}`);
  }

  return {
    ...baseNetwork,
    client: { baseUrl },
  };
}
```

**Step 6: Update `background.js` origin handling**

Replace the universal HTTPS pattern in `ALLOWED_ORIGIN_PATTERNS`:

```js
// Remove: /^https:\/\/.+$/,
// The origin check now relies on per-origin approval (handled by the queue + popup flow)
// Only allow localhost without approval
const ALLOWED_ORIGIN_PATTERNS = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/.+$/, // All HTTPS origins proceed to queue -> popup approval
];
```

Note: For v1.1, we keep accepting HTTPS origins but all non-auto-approved methods go through the popup queue. The real protection is the popup confirmation + the `baseUrl` allowlist. A full per-origin allowlist UI is deferred to v1.2.

**Step 7: Add 24-hour expiry to auto-approve cache**

In `background.js`, `handleAutoApprove`:

```js
async function handleAutoApprove(message, sender, originUrl) {
  const cacheKey = `approved_${originUrl}`;

  try {
    const cached = await chrome.storage.session.get(cacheKey);

    if (cached[cacheKey]) {
      // Check expiry (24 hours)
      const entry = cached[cacheKey];
      if (entry._approvedAt && Date.now() - entry._approvedAt > 86400000) {
        // Expired, remove cache
        await chrome.storage.session.remove(cacheKey);
      } else {
        const response = { ...entry, id: message.id };
        delete response._approvedAt;
        await chrome.tabs.sendMessage(sender.tab.id, response);
        return;
      }
    }
  } catch (error) {
    console.warn("[StacksWallet] Cache check failed:", error);
  }

  // ... (rest of enqueue logic unchanged)
}
```

And in `Confirmation.vue`, when caching approval, add timestamp:

```ts
await chrome.storage.session.set({
  [cacheKey]: { ...result.data, _approvedAt: Date.now() },
});
```

**Step 8: Remove URL payload fallback in `openPopupConfirmation`**

In `background.js`, remove URL params (lines 546-554). Only use `chrome.storage.session`:

```js
async function openPopupConfirmation({ message, sender, originUrl }) {
  const requestId = crypto.randomUUID();

  await chrome.storage.session.set({
    [`request_${requestId}`]: {
      payload: message,
      tabId: sender.tab.id,
      origin: originUrl,
      timestamp: Date.now(),
    },
  });

  chrome.windows.create({
    url: chrome.runtime.getURL("index.html") + `?mode=confirm&requestId=${requestId}`,
    type: "popup",
    width: 390,
    height: 600,
    focused: true,
  });
}
```

**Step 9: Run build**

Run: `pnpm -C den-vault build`
Expected: PASS

**Step 10: Commit**

```bash
git add src/utils/network/allowed-hosts.ts src/utils/network/allowed-hosts.test.ts src/utils/network/index.ts public/background.js src/components/Confirmation.vue
git commit -m "feat(security): restrict API hosts, add cache expiry, remove URL payloads"
```

---

### Task 6: Validate dApp Payloads with Zod

**Files:**
- Create: `src/utils/stxmethods/schemas.ts`
- Create: `src/utils/stxmethods/schemas.test.ts`
- Modify: `src/utils/stxmethods/index.ts` (add validation calls)

**Step 1: Write failing tests for Zod schemas**

Create `src/utils/stxmethods/schemas.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  TransferStxParamsSchema,
  CallContractParamsSchema,
  SignMessageParamsSchema,
} from "./schemas";

describe("TransferStxParamsSchema", () => {
  it("should accept valid transfer params", () => {
    const result = TransferStxParamsSchema.safeParse({
      recipient: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      amount: "1000000",
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing recipient", () => {
    const result = TransferStxParamsSchema.safeParse({
      amount: "1000000",
    });
    expect(result.success).toBe(false);
  });

  it("should reject negative amount", () => {
    const result = TransferStxParamsSchema.safeParse({
      recipient: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      amount: "-100",
    });
    expect(result.success).toBe(false);
  });

  it("should reject zero amount", () => {
    const result = TransferStxParamsSchema.safeParse({
      recipient: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      amount: "0",
    });
    expect(result.success).toBe(false);
  });
});

describe("CallContractParamsSchema", () => {
  it("should accept valid contract call", () => {
    const result = CallContractParamsSchema.safeParse({
      contract: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.my-contract",
      functionName: "transfer",
      functionArgs: [],
    });
    expect(result.success).toBe(true);
  });

  it("should reject contract without dot separator", () => {
    const result = CallContractParamsSchema.safeParse({
      contract: "ST1PQHQKV0RJXZFY1DGX8MNSNYVEinvalid",
      functionName: "transfer",
      functionArgs: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("SignMessageParamsSchema", () => {
  it("should accept valid message", () => {
    const result = SignMessageParamsSchema.safeParse({
      message: "Hello, please sign this",
    });
    expect(result.success).toBe(true);
  });

  it("should reject oversized message (>1MB)", () => {
    const result = SignMessageParamsSchema.safeParse({
      message: "x".repeat(1_048_577),
    });
    expect(result.success).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C den-vault vitest run src/utils/stxmethods/schemas.test.ts`
Expected: FAIL

**Step 3: Implement Zod schemas**

Create `src/utils/stxmethods/schemas.ts`:

```ts
import { z } from "zod";

/** Stacks address: SP/ST prefix + 33-41 c32 characters */
const StxAddressSchema = z.string().regex(
  /^(SP|ST)[0-9A-HJ-NP-Z]{33,41}$/,
  "Invalid Stacks address format"
);

/** Contract identifier: address.name */
const ContractIdSchema = z.string().regex(
  /^(SP|ST)[0-9A-HJ-NP-Z]{33,41}\.[a-zA-Z][a-zA-Z0-9_-]{0,127}$/,
  "Contract must be in format address.name"
);

/** Positive non-zero amount as string (for BigInt conversion) */
const PositiveAmountSchema = z.string().refine(
  (val) => {
    try {
      const n = BigInt(val);
      return n > 0n;
    } catch {
      return false;
    }
  },
  "Amount must be a positive integer string"
);

/** Optional network params (baseUrl validated separately) */
const NetworkParamsSchema = z.object({
  chainId: z.number().optional(),
  client: z.object({
    baseUrl: z.string().url().optional(),
  }).optional(),
}).optional();

export const TransferStxParamsSchema = z.object({
  recipient: StxAddressSchema,
  amount: PositiveAmountSchema,
  memo: z.string().max(34).optional(),
  network: NetworkParamsSchema,
});

export const CallContractParamsSchema = z.object({
  contract: ContractIdSchema,
  functionName: z.string().min(1).max(128),
  functionArgs: z.array(z.unknown()).default([]),
  network: NetworkParamsSchema,
});

export const SignMessageParamsSchema = z.object({
  message: z.string().min(1).max(1_048_576), // 1MB max
});

export const GetAddressesParamsSchema = z.object({}).passthrough();

export type TransferStxParams = z.infer<typeof TransferStxParamsSchema>;
export type CallContractParams = z.infer<typeof CallContractParamsSchema>;
export type SignMessageParams = z.infer<typeof SignMessageParamsSchema>;
```

Note: `zod` is already available via the `@denlabs/engine-core` link dependency. Verify with: `pnpm -C den-vault ls zod` or add directly: `pnpm -C den-vault add zod`.

**Step 4: Run test to verify it passes**

Run: `pnpm -C den-vault vitest run src/utils/stxmethods/schemas.test.ts`
Expected: PASS

**Step 5: Integrate schemas into stxmethods handlers**

In `stxmethods/index.ts`, add validation at the start of each handler:

```ts
import { TransferStxParamsSchema, CallContractParamsSchema, SignMessageParamsSchema } from "./schemas";

// At the start of handleTransferStx:
const parsed = TransferStxParamsSchema.safeParse(payload.params);
if (!parsed.success) {
  return {
    method: payload.method,
    status: "COMPLETE",
    data: {
      jsonrpc: "2.0",
      id: payload.id,
      error: {
        code: JsonRpcErrorCode.InvalidParams,
        message: "Invalid parameters",
        data: parsed.error.flatten().fieldErrors,
      },
    },
  };
}
const params = parsed.data;
// ... rest of handler uses `params` (typed)
```

Apply same pattern to `handleCallContract` and `handleSignMessage`.

**Step 6: Run type-check and build**

Run: `pnpm -C den-vault type-check && pnpm -C den-vault build`
Expected: PASS

**Step 7: Commit**

```bash
git add src/utils/stxmethods/schemas.ts src/utils/stxmethods/schemas.test.ts src/utils/stxmethods/index.ts
git commit -m "feat(security): add Zod schema validation for dApp payloads"
```

---

### Task 7: Eliminate Duplicate Mnemonic + Crypto UUIDs

**Files:**
- Modify: `src/utils/security/vault.ts:131-134,240-255,260-264,276-281`
- Modify: `src/utils/security/vault.ts:215` (UUID)
- Modify: `src/utils/wallets/index.ts:117,149` (UUID)

**Step 1: Remove `_decryptedMnemonic` from WalletVault**

In `vault.ts`:
- Remove field `private _decryptedMnemonic: string | null = null` (line 133)
- In `unlock()`: return the mnemonic but do NOT store it. Remove lines 249-250.
- Remove `loadMnemonic()` method entirely
- In `lock()`: remove `this._decryptedMnemonic = null`

**Step 2: Replace `Math.random()` IDs with `crypto.randomUUID()`**

In `vault.ts:215`:
```ts
id: crypto.randomUUID(),
```

In `wallets/index.ts:117` and `149`:
```ts
id: crypto.randomUUID(),
```

**Step 3: Run type-check and build**

Run: `pnpm -C den-vault type-check && pnpm -C den-vault build`
Expected: PASS

**Step 4: Commit**

```bash
git add src/utils/security/vault.ts src/utils/wallets/index.ts
git commit -m "fix(security): remove duplicate mnemonic, use crypto.randomUUID"
```

---

### Task 8: Address Checksum Verification

**Files:**
- Create: `src/utils/validation/address.ts`
- Create: `src/utils/validation/address.test.ts`
- Modify: `src/utils/stxmethods/index.ts` (use validated addresses)
- Modify: `src/utils/transfer/index.ts` (use checksum validation)

**Step 1: Write failing tests**

Create `src/utils/validation/address.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateStxAddress, validateBtcAddress } from "./address";

describe("validateStxAddress", () => {
  it("should accept valid testnet address", () => {
    expect(validateStxAddress("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", "testnet")).toBe(true);
  });

  it("should reject address for wrong network", () => {
    // SP = mainnet, but we're checking testnet
    expect(validateStxAddress("SP000000000000000000002Q6VF78", "testnet")).toBe(false);
  });

  it("should reject random string", () => {
    expect(validateStxAddress("not-an-address", "testnet")).toBe(false);
  });

  it("should reject empty string", () => {
    expect(validateStxAddress("", "testnet")).toBe(false);
  });
});
```

**Step 2: Implement address validation with checksum**

Create `src/utils/validation/address.ts`:

```ts
import { c32addressDecode } from "c32check";

/**
 * Validate a Stacks address including c32check checksum verification.
 */
export function validateStxAddress(
  address: string,
  expectedNetwork: "mainnet" | "testnet"
): boolean {
  if (!address || address.length < 5) return false;

  const prefix = address.substring(0, 2);
  const expectedPrefix = expectedNetwork === "mainnet" ? "SP" : "ST";
  if (prefix !== expectedPrefix) return false;

  try {
    c32addressDecode(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate a Bitcoin address (basic format check).
 * Full checksum verification requires bitcoinjs-lib which runs in extension context.
 */
export function validateBtcAddress(address: string): boolean {
  if (!address || address.length < 14) return false;

  // P2PKH: starts with 1 or m/n (testnet)
  // P2SH: starts with 3 or 2 (testnet)
  // Bech32: starts with bc1 or tb1
  const validPrefixes = ["1", "3", "m", "n", "2", "bc1", "tb1"];
  return validPrefixes.some((p) => address.startsWith(p));
}
```

**Step 3: Run tests, verify, commit**

Run: `pnpm -C den-vault vitest run src/utils/validation/address.test.ts`
Expected: PASS

```bash
git add src/utils/validation/
git commit -m "feat(security): add address checksum validation with c32check"
```

---

### Task 9: Dynamic Fee Estimation + Confirmation UI Improvements

**Files:**
- Modify: `src/utils/stxmethods/index.ts:196,292` (remove hardcoded fees)
- Modify: `src/components/Confirmation.vue:97-127,392`
- Modify: `src/utils/transfer/index.ts:21`

**Step 1: Replace hardcoded fees with dynamic estimation**

In `stxmethods/index.ts`, for both `handleCallContract` and `handleTransferStx`:

```ts
import { estimateTransactionFeeWithFallback } from "@stacks/transactions";

// Replace: fee: 10000n,
// With: let the SDK estimate, or use a reasonable fallback
// Remove the fee parameter from makeContractCall/makeSTXTokenTransfer
// The SDK auto-estimates if fee is omitted
```

If the SDK's auto-estimation is not available, add a fallback:

```ts
const DEFAULT_FEE_MICRO_STX = 10000n;
// ... after building the transaction:
const estimatedFee = transaction.auth.spendingCondition.fee;
// If fee is 0 (estimation failed), use default
if (estimatedFee === 0n) {
  transaction.setFee(DEFAULT_FEE_MICRO_STX);
}
```

**Step 2: Fix Confirmation UI -- amounts in STX, dynamic subtitles**

In `Confirmation.vue`, update `formattedParams`:

```ts
// Convert microSTX to STX for display
if (params.amount !== undefined) {
  const microStx = BigInt(params.amount);
  const stx = Number(microStx) / 1_000_000;
  formatted["Amount"] = `${stx.toFixed(6)} STX`;
}
```

Update subtitle per method:

```ts
const methodSubtitle = computed(() => {
  switch (props.payload?.method) {
    case "getAddresses":
    case "stx_getAddresses":
      return "Share your wallet addresses with this app";
    case "stx_transferStx":
      return "Send STX to a recipient address";
    case "stx_callContract":
      return "Execute a smart contract function";
    case "stx_signMessage":
      return "Sign a message for verification";
    default:
      return "Review this request from the app";
  }
});
```

**Step 3: Run build**

Run: `pnpm -C den-vault build`
Expected: PASS

**Step 4: Commit**

```bash
git add src/utils/stxmethods/index.ts src/components/Confirmation.vue src/utils/transfer/index.ts
git commit -m "feat(ux): dynamic fees, STX amounts in confirmation, method-specific subtitles"
```

---

## Phase 2: Test Foundation

### Task 10: Encryption Round-Trip Tests

**Files:**
- Modify: `src/utils/security/encryption.test.ts`

**Step 1: Add comprehensive encryption tests**

Add tests for: round-trip encrypt/decrypt, wrong PIN rejection, corrupted ciphertext, iteration count. Ensure tests do NOT use `skipIf` -- mock `crypto.subtle` properly in test setup if needed.

**Step 2: Run and verify**

Run: `pnpm -C den-vault vitest run src/utils/security/encryption.test.ts`
Expected: PASS (all tests run, none skipped)

**Step 3: Commit**

---

### Task 11: Vault Unit Tests

**Files:**
- Create: `src/utils/security/vault.test.ts`

Test: `saveMnemonic`, `unlock` (correct PIN), `unlock` (wrong PIN), `deleteEntry`, `importEntry` with malformed data, `clearVault`, `migration`.

---

### Task 12: Session Manager Unit Tests

**Files:**
- Create: `src/utils/security/session.test.ts`

Test: `initialize`, `unlock`/`lock` flow, auto-lock timer, lockout integration, `getMnemonic` returns null when locked, wallet switching locks session.

---

### Task 13: STX Methods Handler Tests

**Files:**
- Create: `src/utils/stxmethods/index.test.ts`

Test: each handler with valid params (mock `@stacks/transactions`), invalid params (rejected by Zod), rejected `baseUrl`, malicious payloads.

---

### Task 14: Coverage Thresholds

**Files:**
- Modify: `vitest.config.ts`

Add:

```ts
coverage: {
  provider: "v8",
  reporter: ["text", "json", "html"],
  exclude: ["node_modules/", "dist/", "public/"],
  thresholds: {
    branches: 70,
    functions: 80,
    lines: 75,
  },
},
```

---

## Phase 3: Feature Completion

### Task 15: Complete dApp Methods (stx_signStructuredData, stx_deployContract, stx_getAccounts)

Implement each missing method following the pattern: Zod schema -> handler -> Confirmation UI case -> sign/broadcast. See design doc section 4.1.

### Task 16: Account Selector for dApp Requests

Replace hardcoded `accountIndex = 0` in `Confirmation.vue:197` with a dropdown letting the user choose which account to use.

### Task 17: Fiat Prices (CoinGecko Free Tier)

Create `src/utils/prices/index.ts` with 5-min cached fetch from CoinGecko. Display in `UserHomeView.vue` and `Confirmation.vue`.

---

## Phase 4: Cleanup & Release

### Task 18: Remove Legacy Sync Functions

Delete all sync wallet functions from `wallets/index.ts` and their call sites. Keep only async versions.

### Task 19: Remove Unused Permissions

Remove `clipboardRead` from `manifest.json`. Evaluate `tabs` -> `activeTab`.

### Task 20: Build Hardening Script

Create `scripts/verify-production.sh`:
```bash
#!/bin/bash
set -e
pnpm build
echo "Checking for snapshot mode in dist..."
if grep -r "__UI_SNAPSHOT_MODE__" dist/; then
  echo "FAIL: Snapshot mode found in production build"
  exit 1
fi
echo "Checking for devLog in dist..."
if grep -r "devLog" dist/; then
  echo "WARN: devLog found in production build"
fi
echo "All checks passed"
```

### Task 21: Version Bump + Release

- Bump `package.json` and `manifest.json` to `1.1.0`
- Update `RELEASE_CHECKLIST.md` and `NOTES_TO_REVIEWER.md`
- `pnpm release:zip`
- Tag `v1.1.0`

---

## Dependencies

```
Task 1 (snapshot fix) ──────────────┐
Task 2 (device secret + KDF) ──────┤
Task 3 (SecureBuffer) ─────────────┤──> Task 10-13 (tests) ──> Task 14 (coverage)
Task 4 (lockout) ──────────────────┤
Task 5 (origins + baseUrl) ────────┤
Task 6 (Zod schemas) ─────────────┤
Task 7 (dedup mnemonic + UUIDs) ───┤
Task 8 (address checksum) ─────────┤
Task 9 (fees + confirmation UI) ───┘
                                        Task 15-17 (features) ──> Task 18-21 (release)
```

Phase 1 tasks (1-9) are independent of each other and can be parallelized.
Phase 2 tasks (10-14) depend on Phase 1 completion.
Phase 3 tasks (15-17) can start after Phase 1.
Phase 4 tasks (18-21) depend on all prior phases.
