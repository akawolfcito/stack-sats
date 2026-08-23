/**
 * What the user is told when an approved request does not go through.
 *
 * The confirmation window forwarded the error to the dApp and closed
 * itself 150ms later. So approving a contract deploy from an account with
 * no balance ended with the window gone, Activity empty, and nothing said:
 * no transaction, no error, no clue that anything had been attempted. The
 * dApp learned what happened; the person who pressed Approve did not.
 *
 * A wallet may refuse. It may not refuse silently, because silence is
 * indistinguishable from having worked, and the usual next move is to try
 * again.
 *
 * The mapping lives apart from the screen so that both the wording and the
 * decision of what counts as recoverable can be tested without mounting
 * anything.
 */

/** JSON-RPC codes this wallet raises, beyond the standard ones. */
export const RPC_ERROR_CODES = {
  /** The account cannot cover the transfer or its fee. */
  INSUFFICIENT_FUNDS: -31002,
  /** An address in the request is not valid on the selected network. */
  INVALID_ADDRESS: -32001,
} as const;

export interface FailureReport {
  /** Short, plain, and about what happened rather than about JSON-RPC. */
  title: string;
  /** What the user can do, or the node's own words when nothing else fits. */
  detail: string;
  /** Whether going back and changing something could plausibly help. */
  recoverable: boolean;
}

/** Substrings the Stacks node uses to say there is not enough money. */
const NOT_ENOUGH_FUNDS = [
  "notenoughfunds",
  "insufficient",
  "no such account",
  "costtoohigh",
];

const BAD_NONCE = ["badnonce", "conflictingnoncein"];

/**
 * Compare without spacing or case, because the same reason arrives as
 * "NotEnoughFunds", "not_enough_funds" and "not enough funds" depending on
 * which layer is speaking. Both sides are flattened, or a needle written
 * with spaces would never match a flattened haystack.
 */
function flatten(text: string): string {
  return text.toLowerCase().replace(/[\s_-]/g, "");
}

function saysAny(haystack: string, needles: string[]): boolean {
  const text = flatten(haystack);
  return needles.some((needle) => text.includes(flatten(needle)));
}

/**
 * Turn whatever came back into something worth reading.
 *
 * @param code the JSON-RPC code, when there is one
 * @param message the node's or handler's message
 */
export function describeFailure(code: number | undefined, message: string): FailureReport {
  const raw = (message || "").trim();

  if (code === RPC_ERROR_CODES.INSUFFICIENT_FUNDS || saysAny(raw, NOT_ENOUGH_FUNDS)) {
    return {
      title: "Not enough balance",
      detail: "This account cannot cover the amount plus the network fee.",
      recoverable: true,
    };
  }

  if (code === RPC_ERROR_CODES.INVALID_ADDRESS) {
    return {
      title: "Address not valid",
      detail: "That address does not belong to the selected network.",
      recoverable: true,
    };
  }

  if (saysAny(raw, BAD_NONCE)) {
    return {
      title: "Already in flight",
      detail: "Another transaction from this account is still pending. Wait for it to confirm.",
      recoverable: true,
    };
  }

  if (code === 4001) {
    return { title: "Request rejected", detail: "Nothing was sent.", recoverable: false };
  }

  // Anything unrecognised keeps the node's own words. A wrong explanation
  // is worse than an unfamiliar one, and "Unknown error" for everything is
  // what makes a wallet impossible to integrate against.
  return {
    title: "Transaction failed",
    detail: raw || "The network rejected this transaction and gave no reason.",
    recoverable: false,
  };
}
