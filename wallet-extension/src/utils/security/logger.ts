/**
 * Secure logging module
 * Only logs in development mode and sanitizes sensitive data
 */

// Check if DEBUG mode is enabled
const DEBUG = import.meta.env.VITE_DEBUG === "true";

// Sensitive field names that should never be logged
const SENSITIVE_FIELDS = [
  "mnemonic",
  "seed",
  "seedPhrase",
  "privateKey",
  "privkey",
  "stxPrivateKey",
  "secretKey",
  "password",
  "pin",
  "secret",
];

/**
 * Sanitize an object by replacing sensitive fields with [REDACTED]
 */
export function sanitizeForLog(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "string") {
    // Check if string looks like a mnemonic (multiple words)
    const words = obj.trim().split(/\s+/);
    if (words.length >= 12 && words.length <= 24) {
      return "[REDACTED - possible mnemonic]";
    }
    // Check if it looks like a private key (hex string of certain length)
    if (/^[0-9a-fA-F]{64,}$/.test(obj)) {
      return "[REDACTED - possible private key]";
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForLog(item));
  }

  if (typeof obj === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (SENSITIVE_FIELDS.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = sanitizeForLog(value);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Secure log - only logs in DEBUG mode with sanitized data
 */
export function secureLog(message: string, data?: unknown): void {
  if (!DEBUG) return;

  const timestamp = new Date().toISOString();
  const prefix = `[StacksWallet ${timestamp}]`;

  if (data !== undefined) {
    const sanitizedData = sanitizeForLog(data);
    console.log(prefix, message, sanitizedData);
  } else {
    console.log(prefix, message);
  }
}

/**
 * Secure warning - only logs in DEBUG mode with sanitized data
 */
export function secureWarn(message: string, data?: unknown): void {
  if (!DEBUG) return;

  const timestamp = new Date().toISOString();
  const prefix = `[StacksWallet ${timestamp}]`;

  if (data !== undefined) {
    const sanitizedData = sanitizeForLog(data);
    console.warn(prefix, message, sanitizedData);
  } else {
    console.warn(prefix, message);
  }
}

/**
 * Secure error - always logs errors but sanitizes data
 */
export function secureError(message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  const prefix = `[StacksWallet ${timestamp}]`;

  if (data !== undefined) {
    const sanitizedData = sanitizeForLog(data);
    console.error(prefix, message, sanitizedData);
  } else {
    console.error(prefix, message);
  }
}

/**
 * Log only in development - no sanitization needed for non-sensitive info
 */
export function devLog(message: string, ...args: unknown[]): void {
  if (!DEBUG) return;
  console.log(`[StacksWallet]`, message, ...args);
}

/**
 * Check if DEBUG mode is enabled
 */
export function isDebugMode(): boolean {
  return DEBUG;
}
