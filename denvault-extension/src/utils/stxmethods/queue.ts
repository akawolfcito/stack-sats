import type { Result } from "@/utils/types";

/**
 * A JSON-RPC response envelope, the shape every handler in this module
 * returns inside Result.data.
 */
type RpcEnvelope = { jsonrpc: string; id: string; result: unknown };

function isRpcEnvelope(value: unknown): value is RpcEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    "jsonrpc" in value &&
    "result" in value
  );
}

/** A JSON-RPC error response. Also an answer, not a malfunction. */
export interface RpcErrorEnvelope {
  error: { code: number; message: string; data?: unknown };
}

/**
 * Did the handler answer with an error rather than a result?
 *
 * The handlers return status COMPLETE either way: a dApp that sends bad
 * parameters gets a -32602 envelope, and that is a legitimate reply.
 * Feeding it to toQueueApproveResult replaced a precise message with an
 * internal one about envelopes, which is exactly what a user saw when
 * Hiro's sandbox sent its network as a string.
 */
export function isRpcErrorEnvelope(value: unknown): value is RpcErrorEnvelope {
  if (typeof value !== "object" || value === null || !("error" in value)) {
    return false;
  }
  const error = (value as { error?: unknown }).error;
  return typeof error === "object" && error !== null && "message" in error;
}

/**
 * The payload the popup hands to background as DAPP_APPROVE.result.
 *
 * The method handlers return a complete JSON-RPC envelope, and background
 * builds an envelope of its own around whatever the popup sends
 * (handleDappApprove in public/background.js). Forwarding the envelope
 * untouched nests it inside itself, so the dApp looks for
 * response.result.addresses and the addresses actually sit at
 * response.result.result.addresses. @stacks/connect then fails with
 * "No STX address found in response".
 *
 * Queue mode therefore sends the inner result only. Legacy URL mode never
 * passes through background and keeps sending Result.data whole.
 *
 * @throws when the handler did not produce an envelope, so a malformed
 * approval surfaces as an explicit JSON-RPC error instead of a response
 * the dApp cannot read.
 */
export function toQueueApproveResult(data: Result["data"]): unknown {
  if (!isRpcEnvelope(data)) {
    throw new Error(
      "Approve payload is not a JSON-RPC response envelope"
    );
  }

  return data.result;
}
