/**
 * Reading what the node actually said.
 *
 * broadcastTransaction does not throw when a transaction is refused. On a
 * non-2xx it returns the node's JSON, so the result is a union: either
 * { txid } or { error, reason, reason_data }. Every call site read
 * `.txid` straight off it, which on a refusal is undefined. The wallet
 * then answered "success, txid undefined": the dApp was told it worked,
 * the send screen showed a confirmation, and the approval window closed
 * onto an Activity list with nothing in it.
 *
 * Reported while redeploying a contract name that already existed, which
 * the node refuses with ContractAlreadyExists. Nothing on screen said so.
 */

export type BroadcastOutcome =
  | { ok: true; txid: string }
  /** The node refused it. `reason` is its machine word, when it gave one. */
  | { ok: false; reason: string; detail: string };

interface RejectionShape {
  error?: unknown;
  reason?: unknown;
  reason_data?: unknown;
  txid?: unknown;
}

const text = (value: unknown): string =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : "";

/**
 * A rejection can still carry a txid, so its presence proves nothing. What
 * marks a refusal is the node saying error or reason.
 */
export function readBroadcast(result: unknown): BroadcastOutcome {
  const body = (result ?? {}) as RejectionShape;

  const reason = text(body.reason);
  const error = text(body.error);
  const txid = text(body.txid);

  if (reason || error) {
    return {
      ok: false,
      reason: reason || error,
      detail: describeRejection(reason, error, body.reason_data),
    };
  }

  if (!txid) {
    return {
      ok: false,
      reason: "no-txid",
      detail: "The node accepted nothing and returned no transaction id.",
    };
  }

  return { ok: true, txid };
}

/**
 * The node's own words, kept. Inventing our own text for a reason we do
 * not recognise hides the one detail that would explain the refusal.
 */
function describeRejection(
  reason: string,
  error: string,
  reasonData: unknown
): string {
  const parts = [reason, error].filter(Boolean);

  const contract = readContractIdentifier(reasonData);
  if (contract) parts.push(contract);

  return parts.join(": ") || "The node refused this transaction.";
}

function readContractIdentifier(reasonData: unknown): string {
  if (!reasonData || typeof reasonData !== "object") return "";
  const id = (reasonData as { contract_identifier?: unknown }).contract_identifier;
  return text(id);
}
