/**
 * Device Secret Module
 *
 * Generates and manages a 256-bit device secret stored in browser session memory.
 * The secret is combined with the user's PIN to create key material for PBKDF2,
 * making offline brute-force attacks infeasible even with a short numeric PIN.
 *
 * Storage strategy:
 * - Chrome extension: chrome.storage.session (memory-only, cleared on browser restart)
 * - Dev/test: in-memory cache (same lifetime as the process)
 */

const DEVICE_SECRET_KEY = "den_device_secret";
const SECRET_LENGTH = 32; // 256 bits

/** In-memory cache for dev/test environments or as a fast lookup */
let cachedSecret: Uint8Array | null = null;

/**
 * Check if chrome.storage.session is available (Chrome extension context)
 */
function isChromeSessionAvailable(): boolean {
  return (
    typeof chrome !== "undefined" &&
    chrome.storage?.session !== undefined &&
    typeof chrome.storage.session.get === "function" &&
    typeof chrome.storage.session.set === "function"
  );
}

/**
 * Generate a new 256-bit device secret
 */
function generateSecret(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SECRET_LENGTH));
}

/**
 * Store device secret in chrome.storage.session
 */
async function storeInSession(secret: Uint8Array): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    chrome.storage.session.set(
      { [DEVICE_SECRET_KEY]: Array.from(secret) },
      () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lastError = (chrome.runtime as any).lastError;
        if (lastError) {
          reject(new Error(lastError.message || "Failed to store device secret"));
        } else {
          resolve();
        }
      }
    );
  });
}

/**
 * Load device secret from chrome.storage.session
 */
async function loadFromSession(): Promise<Uint8Array | null> {
  return new Promise<Uint8Array | null>((resolve) => {
    chrome.storage.session.get([DEVICE_SECRET_KEY], (result) => {
      const stored = result[DEVICE_SECRET_KEY];
      if (stored && Array.isArray(stored) && stored.length === SECRET_LENGTH) {
        resolve(new Uint8Array(stored));
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Get or create a 256-bit device secret.
 *
 * In Chrome extension context, the secret is stored in chrome.storage.session
 * (memory-only, not persisted to disk). In dev/test environments, it falls back
 * to an in-memory cache with the same lifetime as the process.
 *
 * @returns The device secret as a 32-byte Uint8Array
 */
export async function getOrCreateDeviceSecret(): Promise<Uint8Array> {
  // Fast path: return cached secret
  if (cachedSecret !== null) {
    return cachedSecret;
  }

  // Try loading from chrome.storage.session
  if (isChromeSessionAvailable()) {
    const stored = await loadFromSession();
    if (stored !== null) {
      cachedSecret = stored;
      return cachedSecret;
    }
  }

  // Generate a new secret
  const secret = generateSecret();
  cachedSecret = secret;

  // Persist to chrome.storage.session if available
  if (isChromeSessionAvailable()) {
    try {
      await storeInSession(secret);
    } catch {
      // Silently fall back to in-memory only.
      // The secret is still cached and usable for this session.
    }
  }

  return cachedSecret;
}

/**
 * Combine a PIN string with a device secret to produce key material.
 *
 * The result is the concatenation of the UTF-8 encoded PIN bytes followed by
 * the device secret bytes. This ensures that knowledge of both the PIN and
 * the device secret is required to derive the encryption key.
 *
 * @param pin - The user's PIN string
 * @param deviceSecret - The 256-bit device secret
 * @returns Combined key material as a Uint8Array
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
 * Clear the cached device secret (for testing only).
 *
 * WARNING: This does NOT clear the secret from chrome.storage.session.
 * It only clears the in-memory cache, forcing the next call to
 * getOrCreateDeviceSecret() to reload or regenerate.
 */
export function _clearCachedSecret(): void {
  cachedSecret = null;
}
