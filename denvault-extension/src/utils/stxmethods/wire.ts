/**
 * Carrying Clarity values across the extension bridge.
 *
 * A Clarity uint holds a BigInt, and the page talks to the wallet through
 * chrome.runtime.sendMessage, which serializes as JSON. JSON has no
 * BigInt, so the whole request was dropped with "Could not serialize
 * message" before it reached background: stx_signStructuredMessage never
 * worked, and any method carrying a uint object would have failed the
 * same way.
 *
 * injection.js tags BigInts on the way out; this undoes it on the way in.
 * The tag is deliberately ugly so it cannot collide with a real key.
 */

/** Marker written by injection.js. Keep both sides in step. */
export const BIGINT_TAG = "__denvault_bigint__";

/** Restore tagged BigInts anywhere in a structure. */
export function decodeBigInts(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(decodeBigInts);
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  const record = value as Record<string, unknown>;
  const tagged = record[BIGINT_TAG];

  if (typeof tagged === "string" && Object.keys(record).length === 1) {
    try {
      return BigInt(tagged);
    } catch {
      // Not a number after all: hand it back untouched rather than
      // throwing from inside a signing routine.
      return value;
    }
  }

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(record)) {
    out[key] = decodeBigInts(item);
  }
  return out;
}
