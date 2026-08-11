/**
 * Canonical request fetcher (P0-3 mitigation).
 *
 * Background.js holds the single source of truth for the params of the
 * active dApp request. The popup must source signing bytes from here,
 * NEVER from `props.payload`, because the prop ref can be mutated
 * between display and approval (XSS, race, compromised popup).
 *
 * Legacy URL-payload mode bypasses the queue and has no background
 * counterpart; in that case this returns null and the caller should
 * fall back to its local payload (still the only source available).
 */

import type { JsonRpcRequest } from "@/utils/types";

export interface CanonicalRequest {
  id: string;
  method: string;
  params: unknown;
  origin?: string;
}

export type CanonicalResponse =
  | { ok: true; request: CanonicalRequest }
  | { ok: false; error?: { code: number; message: string } };

/**
 * Ask background.js for the canonical params of the active request.
 *
 * @param requestId - The id the popup believes is active. Background
 *   verifies it matches activeRequest.id; on mismatch it returns
 *   `{ ok: false }` and this function resolves to `null`.
 * @returns A JsonRpcRequest reconstructed from canonical fields, or
 *   `null` if no canonical request can be retrieved.
 */
export async function fetchCanonicalRequest(
  requestId: string | undefined
): Promise<JsonRpcRequest | null> {
  if (!requestId) return null;
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return null;
  }

  try {
    const response = (await chrome.runtime.sendMessage({
      type: "GET_ACTIVE_REQUEST",
      requestId,
    })) as CanonicalResponse | undefined;

    if (!response || !response.ok) return null;

    const canonical = response.request;
    if (canonical.id !== requestId) return null;

    return {
      jsonrpc: "2.0",
      id: canonical.id,
      method: canonical.method,
      params: canonical.params,
    } as JsonRpcRequest;
  } catch {
    return null;
  }
}

/** Where the payload being rendered came from. */
export type DisplaySource = "canonical" | "local";

export interface DisplayPayload {
  payload: JsonRpcRequest;
  source: DisplaySource;
}

/**
 * Resolve which payload the confirmation screen should render.
 *
 * Signing already sources its bytes from background (see
 * `fetchCanonicalRequest`). The display must do the same, otherwise the
 * user reviews `props.payload` while approving different bytes — the
 * "see one thing, sign another" gap.
 *
 * Legacy URL mode has no background queue entry, so the local payload is
 * the only source available and is returned as-is. In queue mode a failed
 * fetch also degrades to the local payload: `handleConfirm` performs its
 * own fetch and aborts, so nothing can be signed from that state.
 */
export async function resolveDisplayPayload(opts: {
  payload: JsonRpcRequest;
  isQueueMode?: boolean;
  requestId?: string;
}): Promise<DisplayPayload> {
  if (!opts.isQueueMode || !opts.requestId) {
    return { payload: opts.payload, source: "local" };
  }

  const canonical = await fetchCanonicalRequest(opts.requestId);
  if (!canonical) {
    return { payload: opts.payload, source: "local" };
  }

  return { payload: canonical, source: "canonical" };
}
