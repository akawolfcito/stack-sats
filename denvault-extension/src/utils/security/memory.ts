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
