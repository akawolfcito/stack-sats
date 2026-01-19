/**
 * Memory security utilities
 * Helps minimize exposure of sensitive data in memory
 */

/**
 * Overwrite a string variable with zeros
 * Note: JavaScript strings are immutable, so this creates a new string
 * and relies on garbage collection. This is a best-effort approach.
 * For true security, consider using Uint8Array for sensitive data.
 */
export function clearString(_str: string): string {
  // Return empty string - the original will be garbage collected
  // In a more secure implementation, we'd use typed arrays
  return "";
}

/**
 * Execute a function with a sensitive value and ensure cleanup
 * This pattern helps ensure we don't forget to clean up
 */
export async function withSecureValue<T, R>(
  getValue: () => Promise<T>,
  operation: (value: T) => Promise<R>,
  cleanup?: (value: T) => void
): Promise<R> {
  let value: T | null = null;
  try {
    value = await getValue();
    return await operation(value);
  } finally {
    if (cleanup && value !== null) {
      cleanup(value);
    }
    value = null;
  }
}

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

/**
 * Schedule garbage collection hint
 * Note: This doesn't guarantee immediate collection
 */
export function scheduleCleanup(): void {
  // Use setTimeout to move cleanup to next tick
  // This helps ensure current stack frames are done with the value
  setTimeout(() => {
    // Hint to GC that now is a good time
    // Note: This is only a hint, not guaranteed
    if (typeof globalThis.gc === "function") {
      globalThis.gc();
    }
  }, 0);
}
